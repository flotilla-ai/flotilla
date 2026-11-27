import pg from 'pg';
import type { CostTotals } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';

type Row = Record<string, any>;
export type UsageRow = { key: string; label: string; totals: CostTotals };
/** CAPY-341: machine time per runner type, priced at the operator's current rate (µ$/minute). */
export type MachineMinute = { runnerType: string; minutes: number; usdMicroPerMinute: number | null; usd: number };
/** CAPY-352/353/635: spend and tokens over a window, by member, model, thread and billing item. */
export type UsageReport = { window: 'month' | 'custom'; from: string; to: string; scope: 'org' | 'member'; totals: CostTotals; byMember: UsageRow[]; byModel: UsageRow[]; byThread: UsageRow[]; byItem: UsageRow[]; machine: MachineMinute[] };
/** CAPY-353/636 */
export type UsageSeries = { bucket: 'hour' | 'day'; by: SeriesBy; from: string; to: string; points: { at: string; key: string; totals: CostTotals }[] };
/** CAPY-346/637: a budget scope over a calendar month (UTC) or its lifetime. */
export type BudgetWindow = { scope: 'global' | 'project'; scopeId: string; window: 'month' | 'lifetime'; start: string; end: string | null; maxUsd: number | null; warnAt: number; spent: number; reserved: number; remaining: number | null; state: 'ok' | 'warn' | 'hit' };
export type UsageSettings = { runOutFree: 'ask' | 'never'; machineRates: Record<string, number> };
type SeriesBy = 'member' | 'item' | 'thread' | 'model' | 'none';

const SUMS = `COALESCE(sum((c.delta->>'usd')::float8),0) usd, COALESCE(sum((c.delta->>'inputTokens')::float8),0) "inputTokens",
  COALESCE(sum((c.delta->>'outputTokens')::float8),0) "outputTokens", COALESCE(sum((c.delta->>'cacheTokens')::float8),0) "cacheTokens",
  COALESCE(sum((c.delta->>'machineSec')::float8),0) "machineSec"`;
const totals = (r: Row): CostTotals => ({ usd: r.usd, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheTokens: r.cacheTokens, machineSec: r.machineSec });
const KEYS: Record<SeriesBy, string> = { member: 'c.owner_id', item: 'c.item', thread: 'c.thread_id', model: `COALESCE(c.model, CASE WHEN c.item='machine' THEN 'machine' ELSE 'unknown' END)`, none: `'total'` };
const fail = (msg: string): never => { throw new ApiFailure('ValidationFailed', msg); };
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const nextMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

export class UsageStore {
  readonly pool: pg.Pool;
  constructor(readonly url: string) { this.pool = new pg.Pool({ connectionString: url }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> { return (await this.pool.query(sql, params)).rows; }
  private async isAdmin(userId: string) { return (await this.q('SELECT role FROM users WHERE id=$1', [userId]))[0]?.role === 'admin'; }
  private async requireAdmin(userId: string) { if (!(await this.isAdmin(userId))) throw new ApiFailure('Forbidden', 'only an admin can change usage settings and budgets'); }

  private range(query: Record<string, string | undefined>) {
    const parse = (v: string | undefined, name: string) => { if (v === undefined) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? fail(`${name} must be an ISO timestamp`) : d; };
    const from = parse(query.from, 'from'); const to = parse(query.to, 'to');
    const start = from ?? monthStart(); const end = to ?? (from ? new Date() : nextMonth(start));
    if (end <= start) fail('to must be after from');
    return { window: from || to ? 'custom' as const : 'month' as const, from: start, to: end };
  }
  /** Admins see the whole org; members see only their own usage. */
  private async scope(userId: string) { const admin = await this.isAdmin(userId); return { admin, where: admin ? '$3::text IS NOT NULL' : 'c.owner_id=$3', params: [userId] }; }

  async report(userId: string, query: Record<string, string | undefined>): Promise<UsageReport> {
    const r = this.range(query); const s = await this.scope(userId);
    const base = [r.from, r.to, ...s.params]; const where = `c.at >= $1 AND c.at < $2 AND ${s.where}`;
    const group = async (key: string, label: string, join = '') => (await this.q(`SELECT ${key} AS key, ${label} AS label, ${SUMS} FROM cost_entries c ${join} WHERE ${where} GROUP BY 1,2 ORDER BY usd DESC, 1`, base))
      .map((x) => ({ key: x.key, label: x.label, totals: totals(x) }));
    const [all] = await this.q(`SELECT ${SUMS} FROM cost_entries c WHERE ${where}`, base);
    const rates = (await this.settings()).machineRates;
    const machine = (await this.q(`SELECT c.runner_type, ${SUMS} FROM cost_entries c WHERE ${where} AND c.item='machine' GROUP BY 1 ORDER BY 1`, base))
      .map((x) => ({ runnerType: x.runner_type, minutes: x.machineSec / 60, usdMicroPerMinute: rates[x.runner_type] ?? null, usd: x.usd }));
    return { window: r.window, from: r.from.toISOString(), to: r.to.toISOString(), scope: s.admin ? 'org' : 'member', totals: totals(all),
      byMember: await group('c.owner_id', 'COALESCE(u.email, c.owner_id)', 'LEFT JOIN users u ON u.id=c.owner_id'),
      byModel: await group(KEYS.model, KEYS.model), byThread: await group('c.thread_id', `CASE WHEN t.owner_id=$3 OR ${s.admin ? "t.visibility='shared'" : 'FALSE'} THEN t.title ELSE c.thread_id END`, 'LEFT JOIN threads t ON t.id=c.thread_id'),
      byItem: await group('c.item', 'c.item'), machine };
  }

  async series(userId: string, query: Record<string, string | undefined>): Promise<UsageSeries> {
    const bucket = query.bucket ?? 'day'; if (bucket !== 'hour' && bucket !== 'day') fail('bucket must be hour or day');
    const by = (query.by ?? 'none') as SeriesBy; if (!(by in KEYS)) fail('by must be member, item, thread, model or none');
    const r = this.range(query); const s = await this.scope(userId);
    const rows = await this.q(`SELECT date_trunc('${bucket}', c.at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS at, ${KEYS[by]} AS key, ${SUMS}
      FROM cost_entries c WHERE c.at >= $1 AND c.at < $2 AND ${s.where} GROUP BY 1,2 ORDER BY 1,2`, [r.from, r.to, ...s.params]);
    return { bucket: bucket as UsageSeries['bucket'], by, from: r.from.toISOString(), to: r.to.toISOString(), points: rows.map((x) => ({ at: new Date(x.at).toISOString(), key: x.key, totals: totals(x) })) };
  }

  async balance(): Promise<{ windows: BudgetWindow[] }> {
    const rows = await this.q(`SELECT * FROM usage_budgets ORDER BY scope='project', scope_id`);
    if (!rows.some((b) => b.scope === 'global')) rows.unshift({ scope: 'global', scope_id: 'global', budget_window: 'month', max_usd: null, warn_at: 0.8 });
    return { windows: await Promise.all(rows.map((b) => this.window(b))) };
  }
  private async window(b: Row): Promise<BudgetWindow> {
    const start = b.budget_window === 'month' ? monthStart() : new Date(0); const end = b.budget_window === 'month' ? nextMonth(start) : null;
    const project = b.scope === 'project';
    const [{ spent }] = await this.q(`SELECT (SELECT COALESCE(sum((delta->>'usd')::float8),0) FROM cost_entries WHERE at >= $1 AND ($2::text IS NULL OR project_id=$2))
      + (SELECT COALESCE(sum(usd),0)::float8 FROM usage_tombstones WHERE at >= $1 AND ($2::text IS NULL OR project_id=$2)) spent`, [start, project ? b.scope_id : null]);
    const [{ reserved }] = await this.q(`SELECT COALESCE(sum(h.amount),0)::float8 reserved FROM budget_holds h JOIN runs r ON r.id=h.run_id JOIN threads t ON t.id=r.thread_id
      WHERE r.state IN ('starting','running') AND ($1::text IS NULL OR t.project_id=$1)`, [project ? b.scope_id : null]);
    const max = b.max_usd === null ? null : Number(b.max_usd); const warnAt = Number(b.warn_at);
    const state = max === null ? 'ok' : spent >= max ? 'hit' : spent >= max * warnAt ? 'warn' : 'ok';
    return { scope: b.scope, scopeId: b.scope_id, window: b.budget_window, start: start.toISOString(), end: end?.toISOString() ?? null, maxUsd: max, warnAt, spent, reserved,
      remaining: max === null ? null : Math.max(0, max - spent - reserved), state };
  }
  async setBudgets(userId: string, input: unknown): Promise<{ windows: BudgetWindow[] }> {
    await this.requireAdmin(userId);
    if (!Array.isArray(input)) fail('body must be a list of budgets');
    const list = (input as Row[]).map((b) => {
      if (b.scope !== 'global' && b.scope !== 'project') fail('scope must be global or project');
      if (typeof b.scopeId !== 'string' || !b.scopeId || (b.scope === 'global' && b.scopeId !== 'global')) fail('scopeId required (global scope uses "global")');
      if (b.window !== 'month' && b.window !== 'lifetime') fail('window must be month or lifetime');
      if (b.maxUsd !== null && (!Number.isSafeInteger(b.maxUsd) || b.maxUsd < 0)) fail('maxUsd must be null or non-negative micro-USD');
      const warnAt = b.warnAt ?? 0.8; if (typeof warnAt !== 'number' || warnAt <= 0 || warnAt > 1) fail('warnAt must be in (0,1]');
      return [b.scope, b.scopeId, b.window, b.maxUsd, warnAt];
    });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN'); await client.query('DELETE FROM usage_budgets');
      for (const v of list) await client.query('INSERT INTO usage_budgets (scope,scope_id,budget_window,max_usd,warn_at) VALUES ($1,$2,$3,$4,$5)', v);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    return this.balance();
  }
  /** Before every run: the thread's own cap against its ledger (incl. priced machine time), then org/project windows. */
  async gate(thread: Row): Promise<{ why: string; shared: boolean } | null> {
    const cap = thread.budget?.maxUsd ?? null;
    if (cap !== null && (await this.q(`SELECT COALESCE(sum((delta->>'usd')::float8),0) n FROM cost_entries WHERE thread_id=$1`, [thread.id]))[0].n >= cap) return { why: 'budget', shared: false };
    for (const w of (await this.balance()).windows) {
      if (w.scope === 'project' && w.scopeId !== thread.project_id) continue;
      if (w.maxUsd !== null && w.spent >= w.maxUsd) return { why: `${w.window === 'month' ? 'monthly' : 'lifetime'} ${w.scope} budget`, shared: true };
    }
    return null;
  }

  async settings(): Promise<UsageSettings> {
    const [r] = await this.q(`SELECT run_out_free, machine_rates FROM usage_settings WHERE id='org'`);
    return { runOutFree: r?.run_out_free ?? 'ask', machineRates: r?.machine_rates ?? {} };
  }
  async setSettings(userId: string, input: Row): Promise<UsageSettings> {
    await this.requireAdmin(userId);
    const cur = await this.settings();
    const runOutFree = input.runOutFree ?? cur.runOutFree; if (runOutFree !== 'ask' && runOutFree !== 'never') fail('runOutFree must be ask or never');
    const machineRates = input.machineRates ?? cur.machineRates;
    if (!machineRates || typeof machineRates !== 'object' || Object.values(machineRates).some((v) => !Number.isSafeInteger(v) || (v as number) < 0)) fail('machineRates must map runner types to non-negative micro-USD per minute');
    await this.q(`INSERT INTO usage_settings (id,run_out_free,machine_rates) VALUES ('org',$1,$2) ON CONFLICT (id) DO UPDATE SET run_out_free=$1, machine_rates=$2`, [runOutFree, JSON.stringify(machineRates)]);
    return { runOutFree, machineRates };
  }
}

const stores = new Map<string, UsageStore>();
export function usageStore(url = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): UsageStore {
  let s = stores.get(url); if (!s) stores.set(url, (s = new UsageStore(url))); return s;
}
