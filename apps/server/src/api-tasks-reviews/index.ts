import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import { ThreadLifecycleStore } from '../thread-lifecycle/store.js';
import type { ThreadLifecycle } from '../thread-lifecycle/types.js';
import { ReviewCoreStore, type ReviewFinding, type ReviewRun, type ReviewSettings } from '../review-core/index.js';

type Row = Record<string, any>;
export interface TaskAlias { id: string; code: string; title: string; status: string; ownerId: string; archivedAt: string | null; updatedFromThread: true }
export interface TaskMessage { id: string; seq: number; kind: string; at: string; source: string; payload: unknown }
export interface ReviewRound { run: ReviewRun; findings: ReviewFinding[] }
export interface ReviewPull { repo: string; prNumber: number; run: ReviewRun | null; findings: ReviewFinding[]; readiness: unknown }
const task = (t: ThreadLifecycle): TaskAlias => ({ id: t.id, code: t.code, title: t.title, status: t.status, ownerId: t.ownerId, archivedAt: t.archivedAt, updatedFromThread: true });
const reviewRun = (r: Row): ReviewRun => ({ id: r.id, repo: r.repo, prNumber: r.pr_number, headSha: r.head_sha, baseSha: r.base_sha, round: r.round, status: r.status, source: r.source, instructions: r.instructions, effort: r.effort, credits: r.credits, adapter: r.adapter, connectionId: r.connection_id, readOnly: r.read_only, checkoutExactHead: r.checkout_exact_head, readyOverride: r.ready_override, lastReviewedSha: r.last_reviewed_sha, createdAt: r.created_at?.toISOString?.() ?? String(r.created_at) });
const reviewFinding = (x: Row): ReviewFinding => ({ id: x.id, runId: x.run_id, repo: x.repo, prNumber: x.pr_number, round: x.round, kind: x.kind, category: x.category, severity: x.severity, confidence: x.confidence, file: x.file, line: x.line, body: x.body, fingerprint: x.fingerprint, status: x.status, githubThreadState: x.github_thread_state, posted: x.posted, superseded: x.superseded });
const msg = (r: Row): TaskMessage => ({ id: r.id, seq: r.seq, kind: r.kind, at: r.at.toISOString(), source: r.source, payload: r.payload });

/** Legacy task aliases and stable public review API wrappers over the durable thread/review foundations. */
export class ApiTasksReviewsStore {
  readonly reviews: ReviewCoreStore;
  private readonly lifecycleStore: ThreadLifecycleStore;
  constructor(readonly pool: pg.Pool, readonly databaseUrl: string) {
    this.reviews = new ReviewCoreStore(pool);
    this.lifecycleStore = new ThreadLifecycleStore(databaseUrl);
  }
  private lifecycle() { return this.lifecycleStore; }
  async listTasks(userId: string): Promise<{ items: TaskAlias[] }> { return { items: (await this.lifecycle().list(userId, 'all')).map(task) }; }
  async getTask(userId: string, id: string): Promise<TaskAlias> { return task(await this.lifecycle().view(id, userId)); }
  async taskMessages(userId: string, id: string, cursorInput?: string, limitInput?: number): Promise<{ items: TaskMessage[]; nextCursor: string | null }> {
    const after = cursorInput === undefined ? 0 : Number(cursorInput);
    if (!Number.isSafeInteger(after) || after < 0) throw new ApiFailure('ValidationFailed', 'cursor must be a non-negative message sequence');
    if (limitInput !== undefined && (!Number.isSafeInteger(limitInput) || limitInput < 1)) throw new ApiFailure('ValidationFailed', 'limit must be a positive integer');
    const limit = Math.min(limitInput ?? 500, 500);
    const rows = (await this.pool.query(`WITH access AS (
        SELECT 1 FROM threads t LEFT JOIN thread_members m ON m.thread_id=t.id AND m.user_id=$2
        WHERE t.id=$1 AND (t.owner_id=$2 OR t.visibility='shared' OR m.joined)
      )
      SELECT e.id,e.seq,e.kind,e.at,e.source,e.payload,(SELECT count(*)::int FROM access) access_count
      FROM events e WHERE e.thread_id=$1 AND e.kind IN ('user.message','agent.message','agent.delta') AND e.seq>$3 AND EXISTS (SELECT 1 FROM access)
      ORDER BY e.seq LIMIT $4`, [id, userId, after, limit + 1])).rows as Row[];
    if (!rows.length) {
      const [access] = (await this.pool.query(`SELECT 1 FROM threads t LEFT JOIN thread_members m ON m.thread_id=t.id AND m.user_id=$2 WHERE t.id=$1 AND (t.owner_id=$2 OR t.visibility='shared' OR m.joined)`, [id, userId])).rows as Row[];
      if (!access) throw new ApiFailure('NotFound', 'task not found');
    }
    const page = rows.slice(0, limit);
    return { items: page.map(msg), nextCursor: rows.length > limit ? String(page.at(-1)?.seq ?? after) : null };
  }
  reviewSettings(userId: string, repo: string, input?: Row): Promise<ReviewSettings> { return this.reviews.settings(userId, repo, input); }
  startReview(userId: string, input: Row): Promise<ReviewRun> { return this.reviews.start(userId, input, 'api'); }
  async round(userId: string, runId: string): Promise<ReviewRound> {
    const [r] = (await this.pool.query('SELECT * FROM review_runs WHERE id=$1 AND owner_id=$2', [runId, userId])).rows as Row[];
    if (!r) throw new ApiFailure('NotFound', 'review run not found');
    const findings = (await this.pool.query('SELECT * FROM review_findings WHERE run_id=$1 AND owner_id=$2 ORDER BY file,line,id', [runId, userId])).rows as Row[];
    return { run: reviewRun(r), findings: findings.map(reviewFinding) };
  }
  async pull(userId: string, repo: string, prNumber: number): Promise<ReviewPull> { return { repo, prNumber, ...(await this.reviews.state(userId, repo, prNumber)) }; }
  async updateFindingStatuses(userId: string, input: Row): Promise<{ items: ReviewFinding[] }> {
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw new ApiFailure('ValidationFailed', 'items must list 1-100 finding updates');
    const updates = input.items as Row[];
    if (new Set(updates.map((x) => x.id)).size !== updates.length) throw new ApiFailure('ValidationFailed', 'finding ids must be unique');
    for (const item of updates) {
      if (typeof item.id !== 'string') throw new ApiFailure('ValidationFailed', 'each finding update needs an id');
      if (!['open', 'resolved', 'irrelevant'].includes(String(item.status))) throw new ApiFailure('ValidationFailed', 'invalid triage status');
    }
    const client = await this.pool.connect(); const out: ReviewFinding[] = [];
    try {
      await client.query('BEGIN');
      for (const item of updates) {
        const r = (await client.query(`UPDATE review_findings SET status=$3,github_thread_state=CASE WHEN $3='open' THEN 'open' ELSE 'resolved' END,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`, [item.id, userId, item.status])).rows[0] as Row | undefined;
        if (!r) throw new ApiFailure('NotFound', 'review finding not found');
        out.push(reviewFinding(r));
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
    return { items: out };
  }
}
