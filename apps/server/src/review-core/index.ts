import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export type ReviewSource = 'pr-page' | 'mention' | 'api' | 'push';
export type ReviewEffort = 'low' | 'medium' | 'high' | 'flex';
export type FindingStatus = 'open' | 'resolved' | 'irrelevant';
export interface ReviewSettings { repo: string; automaticMode: 'off' | 'once' | 'every-push'; postingThreshold: 'low' | 'medium' | 'high'; includeInvestigate: boolean; includeNotes: boolean }
export interface ReviewRun { id: string; repo: string; prNumber: number; headSha: string; baseSha: string | null; round: number; status: string; source: ReviewSource; instructions: string | null; effort: ReviewEffort; credits: number; adapter: string; connectionId: string | null; readOnly: true; checkoutExactHead: true; readyOverride: boolean; lastReviewedSha: string | null; createdAt: string }
export interface ReviewFinding { id: string; runId: string; repo: string; prNumber: number; round: number; kind: 'finding' | 'note'; category: string | null; severity: string | null; confidence: string | null; file: string; line: number; body: string; fingerprint: string; status: FindingStatus; githubThreadState: 'open' | 'resolved'; posted: boolean; superseded: boolean }
type Row = Record<string, any>;
const id = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;
const sha = (v: unknown) => { const s = String(v ?? ''); if (!/^[0-9a-f]{7,40}$/i.test(s)) throw new ApiFailure('ValidationFailed', 'headSha must be a hexadecimal git sha'); return s.toLowerCase() };
const repoName = (v: unknown) => { const s = String(v ?? ''); if (!/^[^\s/]+\/[^\s/]+$/.test(s)) throw new ApiFailure('ValidationFailed', 'repo must be owner/repo'); return s };
const prNumber = (v: unknown) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new ApiFailure('ValidationFailed', 'prNumber must be a positive integer'); return n };
export function reviewCredits(effort: ReviewEffort, round: number): number { return effort === 'low' ? 1 : effort === 'medium' ? 5 : effort === 'high' ? 10 : round === 1 ? 5 : 1 }
const run = (r: Row): ReviewRun => ({ id: r.id, repo: r.repo, prNumber: r.pr_number, headSha: r.head_sha, baseSha: r.base_sha, round: r.round, status: r.status, source: r.source, instructions: r.instructions, effort: r.effort, credits: r.credits, adapter: r.adapter, connectionId: r.connection_id, readOnly: r.read_only, checkoutExactHead: r.checkout_exact_head, readyOverride: r.ready_override, lastReviewedSha: r.last_reviewed_sha, createdAt: r.created_at?.toISOString?.() ?? String(r.created_at) });
const finding = (r: Row): ReviewFinding => ({ id: r.id, runId: r.run_id, repo: r.repo, prNumber: r.pr_number, round: r.round, kind: r.kind, category: r.category, severity: r.severity, confidence: r.confidence, file: r.file, line: r.line, body: r.body, fingerprint: r.fingerprint, status: r.status, githubThreadState: r.github_thread_state, posted: r.posted, superseded: r.superseded });
const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };

export class ReviewCoreStore {
  constructor(readonly pool: pg.Pool) {}
  private async q(sql: string, args: unknown[] = []) { return (await this.pool.query(sql, args)).rows as Row[] }
  async settings(userId: string, repoInput: string, input: Row = {}): Promise<ReviewSettings> {
    const repo = repoName(repoInput);
    if (Object.keys(input).length) {
      const mode = input.automaticMode ?? 'off'; if (!['off','once','every-push'].includes(String(mode))) throw new ApiFailure('ValidationFailed', 'automaticMode must be off, once or every-push');
      const threshold = input.postingThreshold ?? 'medium'; if (!['low','medium','high'].includes(String(threshold))) throw new ApiFailure('ValidationFailed', 'postingThreshold must be low, medium or high');
      await this.pool.query(`INSERT INTO review_settings (owner_id,repo,automatic_mode,posting_threshold,include_investigate,include_notes) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (owner_id,repo) DO UPDATE SET automatic_mode=$3,posting_threshold=$4,include_investigate=$5,include_notes=$6,updated_at=now()`, [userId, repo, mode, threshold, input.includeInvestigate === true, input.includeNotes === true]);
    }
    const [r] = await this.q('SELECT * FROM review_settings WHERE owner_id=$1 AND repo=$2', [userId, repo]);
    return { repo, automaticMode: r?.automatic_mode ?? 'off', postingThreshold: r?.posting_threshold ?? 'medium', includeInvestigate: r?.include_investigate ?? false, includeNotes: r?.include_notes ?? false };
  }
  private async latest(userId: string, repo: string, pr: number): Promise<Row | undefined> { return (await this.q('SELECT * FROM review_runs WHERE owner_id=$1 AND repo=$2 AND pr_number=$3 ORDER BY round DESC LIMIT 1', [userId, repo, pr]))[0] }
  async start(userId: string, input: Row, source: ReviewSource = 'api'): Promise<ReviewRun> {
    if (!['pr-page','mention','api','push'].includes(source)) throw new ApiFailure('ValidationFailed', 'invalid review source');
    const repo = repoName(input.repo); const pr = prNumber(input.prNumber); const head = sha(input.headSha);
    const base = input.baseSha == null ? null : sha(input.baseSha);
    const effort = String(input.effort ?? 'medium') as ReviewEffort; if (!['low','medium','high','flex'].includes(effort)) throw new ApiFailure('ValidationFailed', 'invalid review effort');
    const last = await this.latest(userId, repo, pr); const round = (last?.round ?? 0) + 1;
    const rid = id('rev');
    const [r] = await this.q(`INSERT INTO review_runs (id,owner_id,repo,pr_number,head_sha,base_sha,round,status,source,instructions,effort,credits,adapter,connection_id,last_reviewed_sha) VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [rid, userId, repo, pr, head, base, round, source, input.instructions == null ? null : String(input.instructions), effort, reviewCredits(effort, round), String(input.adapter ?? 'fake'), input.connectionId == null ? null : String(input.connectionId), last?.head_sha ?? null]);
    await this.pool.query('UPDATE review_settings SET reviewed_once=true WHERE owner_id=$1 AND repo=$2', [userId, repo]);
    return run(r);
  }
  async push(userId: string, repoInput: unknown, prInput: unknown, headInput: unknown): Promise<ReviewRun | null> {
    const repo = repoName(repoInput); const pr = prNumber(prInput); const head = sha(headInput);
    const last = await this.latest(userId, repo, pr); if (!last || last.head_sha === head) return null;
    const settings = await this.settings(userId, repo);
    if (settings.automaticMode === 'off' || (settings.automaticMode === 'once' && (await this.q('SELECT reviewed_once FROM review_settings WHERE owner_id=$1 AND repo=$2', [userId, repo]))[0]?.reviewed_once)) return null;
    if (settings.automaticMode !== 'every-push' && settings.automaticMode !== 'once') return null;
    await this.pool.query('UPDATE review_findings SET superseded=true,updated_at=now() WHERE owner_id=$1 AND repo=$2 AND pr_number=$3 AND NOT superseded', [userId, repo, pr]);
    return this.start(userId, { repo, prNumber: pr, headSha: head, baseSha: last.base_sha, effort: last.effort, adapter: last.adapter, connectionId: last.connection_id }, 'push');
  }
  private async ownedRun(userId: string, runId: string): Promise<Row> { const [r] = await this.q('SELECT * FROM review_runs WHERE id=$1 AND owner_id=$2', [runId, userId]); if (!r) throw new ApiFailure('NotFound', 'review run not found'); return r }
  async addFindings(userId: string, runId: string, items: Row[]): Promise<ReviewFinding[]> {
    const rr = await this.ownedRun(userId, runId); if (!Array.isArray(items)) throw new ApiFailure('ValidationFailed', 'items must be an array');
    const settings = await this.settings(userId, rr.repo); const out: ReviewFinding[] = [];
    for (const item of items) {
      const kind = String(item.kind ?? 'finding'); if (!['finding','note'].includes(kind)) throw new ApiFailure('ValidationFailed', 'kind must be finding or note');
      const fp = String(item.fingerprint ?? ''); const body = String(item.body ?? ''); const file = String(item.file ?? ''); const line = Number(item.line);
      if (!fp || !body || !file || !Number.isInteger(line) || line < 1) throw new ApiFailure('ValidationFailed', 'finding requires fingerprint, body, file and positive line');
      if (kind === 'finding') {
        if (!['bug','risk','maintainability','refactor'].includes(String(item.category))) throw new ApiFailure('ValidationFailed', 'invalid finding category');
        if (!['low','medium','high'].includes(String(item.severity))) throw new ApiFailure('ValidationFailed', 'invalid finding severity');
        if (!['confirmed','investigate'].includes(String(item.confidence))) throw new ApiFailure('ValidationFailed', 'invalid finding confidence');
      }
      const prior = await this.q(`SELECT * FROM review_findings WHERE owner_id=$1 AND repo=$2 AND pr_number=$3 AND fingerprint=$4 ORDER BY round DESC LIMIT 1`, [userId, rr.repo, rr.pr_number, fp]);
      if (prior[0] && (prior[0].status === 'irrelevant' || (prior[0].status === 'resolved' && prior[0].body === body))) continue;
      const posted = kind === 'note' ? settings.includeNotes : (rank[String(item.severity)] >= rank[settings.postingThreshold] && (item.confidence === 'confirmed' || settings.includeInvestigate));
      try {
        const [r] = await this.q(`INSERT INTO review_findings (id,run_id,owner_id,repo,pr_number,round,kind,category,severity,confidence,file,line,body,fingerprint,posted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
          [id('rf'), runId, userId, rr.repo, rr.pr_number, rr.round, kind, kind === 'finding' ? item.category : null, kind === 'finding' ? item.severity : null, kind === 'finding' ? item.confidence : null, file, line, body, fp, posted]);
        out.push(finding(r));
      } catch (e) { if (String((e as { code?: string }).code) !== '23505') throw e }
    }
    return out;
  }
  async triage(userId: string, findingId: string, statusInput: unknown): Promise<ReviewFinding> {
    const status = String(statusInput); if (!['open','resolved','irrelevant'].includes(status)) throw new ApiFailure('ValidationFailed', 'invalid triage status');
    const [r] = await this.q(`UPDATE review_findings SET status=$3,github_thread_state=CASE WHEN $3='open' THEN 'open' ELSE 'resolved' END,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *`, [findingId, userId, status]);
    if (!r) throw new ApiFailure('NotFound', 'review finding not found'); return finding(r);
  }
  async overrideReady(userId: string, runId: string, enabled: unknown): Promise<ReviewRun> {
    await this.ownedRun(userId, runId); const [r] = await this.q('UPDATE review_runs SET ready_override=$3,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *', [runId, userId, enabled === true]);
    return run(r);
  }
  async state(userId: string, repoInput: string, prInput: number): Promise<{ run: ReviewRun | null; findings: ReviewFinding[]; readiness: { ready: boolean; override: boolean; blockedBy: ReviewFinding[] } }> {
    const repo = repoName(repoInput); const pr = prNumber(prInput); const latest = await this.latest(userId, repo, pr);
    const rows = latest ? await this.q('SELECT * FROM review_findings WHERE owner_id=$1 AND repo=$2 AND pr_number=$3 AND NOT superseded ORDER BY round,file,line', [userId, repo, pr]) : [];
    const findings = rows.map(finding); const blockedBy = findings.filter((f) => f.kind === 'finding' && f.status === 'open' && f.severity === 'high' && f.confidence === 'confirmed');
    const override = latest?.ready_override === true; return { run: latest ? run(latest) : null, findings, readiness: { ready: override || blockedBy.length === 0, override, blockedBy } };
  }
}
