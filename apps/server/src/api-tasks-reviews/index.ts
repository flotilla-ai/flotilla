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
  async taskMessages(userId: string, id: string): Promise<{ items: TaskMessage[] }> {
    await this.lifecycle().view(id, userId);
    const rows = (await this.pool.query(`SELECT id,seq,kind,at,source,payload FROM events WHERE thread_id=$1 AND kind IN ('user.message','agent.message') ORDER BY seq LIMIT 1000`, [id])).rows as Row[];
    return { items: rows.map(msg) };
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
    const out: ReviewFinding[] = [];
    for (const item of input.items as Row[]) {
      if (typeof item.id !== 'string') throw new ApiFailure('ValidationFailed', 'each finding update needs an id');
      out.push(await this.reviews.triage(userId, item.id, item.status));
    }
    return { items: out };
  }
}
