import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export interface PullRequestSettings { branchPrefix: string; draftDefault: boolean; openInFlotilla: boolean; personalOverride: boolean }
export interface PullRequestView { repo: string; number: number; threadId: string; title: string; author: string; state: string; labels: string[]; draft: boolean; checksState: string; headBranch: string; owned: boolean; blockedReason: string | null; updatedAt: string; contextThreadIds?: string[] }
export interface MergeAction { action: 'merge' | 'comment' | 'update-branch' | 'auto-merge'; method?: 'squash' | 'merge' | 'rebase'; comment?: string; actor: string }
export interface AutofixWake { threadId: string; repo: string; number: number; text: string }
export interface PrGateway { act(input: MergeAction & { repo: string; number: number }): Promise<Record<string, unknown>>; review(input: { repo: string; number: number; verdict: string; comment: string; actor: string }): Promise<Record<string, unknown>> }
type Row = Record<string, any>;
const failClosedGateway: PrGateway = { act: async () => { throw new ApiFailure('Conflict', 'live GitHub gateway is not configured'); }, review: async () => { throw new ApiFailure('Conflict', 'live GitHub gateway is not configured'); } };
const view = (r: Row): PullRequestView => ({ repo: r.repo, number: r.number, threadId: r.thread_id, title: r.title, author: r.author, state: r.state, labels: r.labels ?? [], draft: r.draft, checksState: r.checks_state, headBranch: r.head_branch, owned: r.owned, blockedReason: blocked(r), updatedAt: r.updated_at?.toISOString?.() ?? String(r.updated_at), contextThreadIds: r.context_thread_ids ?? [] });
function blocked(r: Row): string | null { if (r.state !== 'open') return `pull request is ${r.state}`; if (r.draft) return 'draft pull request'; if (r.checks_state === 'pending') return 'checks are pending'; if (r.checks_state === 'failed') return 'checks are failing'; return null }
function prefix(value: unknown): string { const p = String(value ?? 'flotilla').trim().replace(/^\/+|\/+$/g, ''); if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,80}$/.test(p)) throw new ApiFailure('ValidationFailed', 'invalid branch prefix'); if (p === 'release' || p.startsWith('release/')) throw new ApiFailure('ValidationFailed', 'release is a reserved branch prefix'); return p }
export class PrAutofixStore {
  constructor(readonly pool: pg.Pool, private readonly gateway: PrGateway = failClosedGateway) {}
  private async q(sql: string, args: unknown[] = []) { return (await this.pool.query(sql, args)).rows as Row[] }
  async settings(userId: string): Promise<PullRequestSettings> {
    const rows = await this.q('SELECT * FROM pull_request_settings WHERE user_id IN ($1,$2) ORDER BY CASE WHEN user_id=$1 THEN 0 ELSE 1 END LIMIT 1', [userId, 'org']);
    const r = rows[0]; return { branchPrefix: r?.branch_prefix ?? 'flotilla', draftDefault: r?.draft_default ?? false, openInFlotilla: r?.open_in_flotilla ?? true, personalOverride: r?.user_id === userId };
  }
  async updateSettings(userId: string, input: Row): Promise<PullRequestSettings> {
    const cur = await this.settings(userId); const bp = input.branchPrefix === undefined ? cur.branchPrefix : prefix(input.branchPrefix);
    await this.pool.query('INSERT INTO pull_request_settings (user_id,branch_prefix,draft_default,open_in_flotilla) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET branch_prefix=$2,draft_default=$3,open_in_flotilla=$4,updated_at=now()', [userId, bp, input.draftDefault === undefined ? cur.draftDefault : input.draftDefault === true, input.openInFlotilla === undefined ? cur.openInFlotilla : input.openInFlotilla === true]);
    return this.settings(userId);
  }
  private async installedRepos(userId: string): Promise<Set<string>> {
    const rows = await this.q(`SELECT i.repositories FROM github_installations i JOIN github_accounts a ON a.id=i.account_id WHERE a.user_id=$1 AND a.revoked_at IS NULL AND i.revoked_at IS NULL AND i.verified_at IS NOT NULL`, [userId]);
    return new Set(rows.flatMap((r) => Array.isArray(r.repositories) ? r.repositories.map((x: unknown) => String(x).toLowerCase()) : []));
  }
  async list(userId: string, query: Row): Promise<PullRequestView[]> {
    const installed = await this.installedRepos(userId); if (!installed.size) return [];
    let rows = (await this.q(`SELECT p.*,(SELECT json_agg(x.thread_id) FROM pr_context_threads x WHERE x.repo=p.repo AND x.number=p.number AND x.user_id=$1) AS context_thread_ids FROM prs p LEFT JOIN threads t ON t.id=p.thread_id WHERE (t.owner_id=$1 OR p.thread_id IS NULL) ORDER BY p.updated_at DESC`, [userId])).filter((r) => installed.has(String(r.repo).toLowerCase()));
    const qtext = String(query.q ?? ''); const terms = Object.fromEntries([...qtext.matchAll(/(author|repo|status|label|since):([^\s]+)/g)].map((m) => [m[1], m[2]]));
    const f = { author: query.author ?? terms.author, repo: query.repo ?? terms.repo, status: query.status ?? terms.status, label: query.label ?? terms.label, since: query.since ?? terms.since } as Row;
    if (query.captain) { const crew = new Set((await this.q('SELECT id FROM threads WHERE crew_of=$1', [String(query.captain)])).map((r) => String(r.id))); rows = rows.filter((r) => crew.has(String(r.thread_id))); }
    if (f.author) rows = rows.filter((r) => r.author === f.author); if (f.repo) rows = rows.filter((r) => r.repo.toLowerCase().includes(String(f.repo).toLowerCase())); if (f.status) rows = rows.filter((r) => r.state === f.status); if (f.label) rows = rows.filter((r) => (r.labels ?? []).includes(f.label)); if (f.since) rows = rows.filter((r) => new Date(r.updated_at) >= new Date(String(f.since)));
    return rows.map(view);
  }
  async get(userId: string, repo: string, number: number): Promise<PullRequestView> { const x = (await this.list(userId, { repo })).find((r) => r.repo.toLowerCase() === repo.toLowerCase() && r.number === number); if (!x) throw new ApiFailure('NotFound', 'pull request not found'); return x }
  private async actor(userId: string, repo: string, number: number): Promise<string> {
    const pr = await this.q('SELECT identity FROM github_pr_identities WHERE repo=$1 AND number=$2 AND user_id=$3', [repo, number, userId]);
    const acct = (await this.q('SELECT login,commit_identity FROM github_accounts WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at LIMIT 1', [userId]))[0];
    const identity = pr[0]?.identity ?? acct?.commit_identity ?? 'capy';
    return acct && identity !== 'capy' ? acct.login : 'flotilla';
  }
  async act(userId: string, repo: string, number: number, input: Row): Promise<Record<string, unknown>> {
    const pr = await this.get(userId, repo, number);
    if (input.action === 'merge') { if (!['squash','merge','rebase'].includes(String(input.method))) throw new ApiFailure('ValidationFailed', 'merge method must be squash, merge or rebase'); if (pr.blockedReason) throw new ApiFailure('Conflict', pr.blockedReason); }
    if (!['merge','comment','update-branch','auto-merge'].includes(String(input.action))) throw new ApiFailure('ValidationFailed', 'invalid pull request action');
    return this.gateway.act({ repo, number, action: input.action as MergeAction['action'], method: input.method as MergeAction['method'], comment: typeof input.comment === 'string' ? input.comment : undefined, actor: await this.actor(userId, repo, number) });
  }
  async review(userId: string, repo: string, number: number, input: Row): Promise<Record<string, unknown>> {
    await this.get(userId, repo, number); if (!['summary','comment','request-changes','approve'].includes(String(input.verdict))) throw new ApiFailure('ValidationFailed', 'invalid review verdict');
    return this.gateway.review({ repo, number, verdict: String(input.verdict), comment: String(input.comment ?? ''), actor: await this.actor(userId, repo, number) });
  }
  async noCiWakes(now: Date, wake: (input: AutofixWake) => Promise<void>): Promise<number> {
    const rows = await this.q(`SELECT p.*,t.owner_id FROM prs p JOIN threads t ON t.id=p.thread_id WHERE p.state='open' AND p.checks_state IN ('none','unknown') AND p.pushed_at IS NOT NULL AND p.pushed_at <= $1 AND p.no_ci_wake_at IS NULL`, [new Date(now.getTime() - 30 * 60_000)]);
    for (const r of rows) { const text = `No CI reported for ${r.repo}#${r.number} about 30 minutes after the last push.`; await wake({ threadId: r.thread_id, repo: r.repo, number: r.number, text }); await this.pool.query('UPDATE prs SET no_ci_wake_at=now() WHERE repo=$1 AND number=$2', [r.repo, r.number]); }
    return rows.length;
  }
}
