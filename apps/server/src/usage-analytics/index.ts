import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

type Row = Record<string, any>;
export interface WorkspaceInfo { type: 'Personal' | 'Team'; userCount: number; billingAttached: false }
export interface ActivityRow { userId: string; email: string; mergedPrs: number; contributedPrs: number; reviewFoundIssues: number; agentHours: number }
export interface ActivityReport { workspace: WorkspaceInfo; capyShareOfMergedPrs: number; items: ActivityRow[]; privateWorkMetadataOnly: true }
export interface MemberUsageRow { userId: string; email: string; usd: number; tokens: number; cacheTokens: number; machineSec: number }

/** Workspace/activity analytics derived only from durable ledger and event metadata; private thread titles are never exposed. */
export class UsageAnalyticsStore {
  constructor(readonly pool: pg.Pool) {}
  private async q(sql: string, args: unknown[] = []) { return (await this.pool.query(sql, args)).rows as Row[] }
  private async admin(userId: string) { return (await this.q('SELECT role FROM users WHERE id=$1', [userId]))[0]?.role === 'admin' }
  async workspace(): Promise<WorkspaceInfo> {
    const count = Number((await this.q(`SELECT count(*)::int c FROM users WHERE role<>'service'`))[0]?.c ?? 0);
    return { type: count <= 1 ? 'Personal' : 'Team', userCount: count, billingAttached: false };
  }
  async activity(userId: string): Promise<ActivityReport> {
    const isAdmin = await this.admin(userId); const workspace = await this.workspace();
    const scope = isAdmin ? '' : 'AND t.owner_id=$1'; const args = isAdmin ? [] : [userId];
    const rows = await this.q(`WITH owners AS (SELECT DISTINCT t.owner_id FROM threads t WHERE true ${scope}),
      costs AS (SELECT t.owner_id, COALESCE(sum((c.delta->>'machineSec')::float8),0) machine_sec FROM threads t JOIN cost_entries c ON c.thread_id=t.id WHERE true ${scope} GROUP BY 1),
      merged AS (SELECT t.owner_id,count(DISTINCT p.repo||'#'||p.number)::int n FROM threads t JOIN prs p ON p.thread_id=t.id AND p.owned=true AND p.state='merged' WHERE true ${scope} GROUP BY 1),
      contributed AS (SELECT t.owner_id,count(DISTINCT p.repo||'#'||p.number)::int n FROM threads t JOIN prs p ON p.thread_id=t.id AND p.owned=true WHERE true ${scope} GROUP BY 1),
      findings AS (SELECT owner_id,count(*)::int n FROM review_findings WHERE kind='finding' GROUP BY 1)
      SELECT u.id,u.email,COALESCE(m.n,0) merged,COALESCE(p.n,0) contributed,COALESCE(f.n,0) findings,COALESCE(c.machine_sec,0) machine_sec
      FROM owners o JOIN users u ON u.id=o.owner_id
      LEFT JOIN merged m ON m.owner_id=u.id LEFT JOIN contributed p ON p.owner_id=u.id LEFT JOIN findings f ON f.owner_id=u.id LEFT JOIN costs c ON c.owner_id=u.id
      ORDER BY u.email`, args);
    const items = rows.map((r) => ({ userId: r.id, email: r.email, mergedPrs: r.merged, contributedPrs: r.contributed, reviewFoundIssues: r.findings, agentHours: r.machine_sec / 3600 }));
    const merged = items.reduce((a, x) => a + x.mergedPrs, 0);
    const allMerged = Number((await this.q(`SELECT count(*)::int n FROM prs WHERE state='merged'`))[0]?.n ?? 0);
    return { workspace, capyShareOfMergedPrs: allMerged ? merged / allMerged : 0, items, privateWorkMetadataOnly: true };
  }
  async memberUsage(userId: string, sortInput: string | undefined): Promise<{ sort: 'cost' | 'tokens'; items: MemberUsageRow[] }> {
    if (sortInput !== undefined && sortInput !== 'cost' && sortInput !== 'tokens') throw new ApiFailure('ValidationFailed', 'sort must be cost or tokens');
    const sort = sortInput === 'tokens' ? 'tokens' : 'cost';
    const isAdmin = await this.admin(userId); const scope = isAdmin ? '' : 'AND t.owner_id=$1'; const args = isAdmin ? [] : [userId];
    const rows = await this.q(`SELECT u.id,u.email,COALESCE(sum((c.delta->>'usd')::float8),0) usd,
      COALESCE(sum((c.delta->>'inputTokens')::float8+(c.delta->>'outputTokens')::float8+(c.delta->>'cacheTokens')::float8),0) tokens,
      COALESCE(sum((c.delta->>'cacheTokens')::float8),0) cache_tokens,COALESCE(sum((c.delta->>'machineSec')::float8),0) machine_sec
      FROM threads t JOIN users u ON u.id=t.owner_id JOIN cost_entries c ON c.thread_id=t.id WHERE true ${scope}
      GROUP BY u.id,u.email ORDER BY ${sort === 'cost' ? 'usd' : 'tokens'} DESC,u.email`, args);
    return { sort, items: rows.map((r) => ({ userId: r.id, email: r.email, usd: r.usd, tokens: r.tokens, cacheTokens: r.cache_tokens, machineSec: r.machine_sec })) };
  }
}
