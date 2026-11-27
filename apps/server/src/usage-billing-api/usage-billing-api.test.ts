import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AdapterEvent, AgentAdapter, StartInput } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import { usageStore } from './store.js';

const exec = promisify(execFile);
process.env.FLOTILLA_MASTER_KEY = 'test-master-key-for-usage-billing';
let container = ''; let pool: pg.Pool; let app: Hono; let threadsApp: Hono; let runner: ThreadRunner;
let admin = ''; let member = ''; const auth: Record<string, { cookie: string; csrf: string }> = {};
/** Scripted adapter: reports 1000 µ$ usage; a claude-code run (the subscription) runs out. */
const scripted: AgentAdapter = { ...fakeAdapter, manifest: fakeAdapter.manifest, probe: fakeAdapter.probe, resume: (i) => scripted.start(i), cancel: async () => undefined,
  start: (input: StartInput) => (async function* (): AsyncGenerator<AdapterEvent> {
    yield { t: 'usage', usdMicro: 1000, inputTokens: 10, outputTokens: 5, cumulative: false, model: input.model ?? 'fake-small' };
    yield { t: 'done', stopReason: 'end_turn' };
  })() };
const runOutAdapter: AgentAdapter = { ...scripted, start: () => (async function* (): AsyncGenerator<AdapterEvent> { yield { t: 'done', stopReason: 'run_out' }; })() };
const driver = { startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => ({}), copyIn: async () => undefined, copyOut: async () => Buffer.from(''), stop: async () => undefined };

async function call(path: string, init: RequestInit & { json?: unknown; as?: string; bearer?: string } = {}, on = app): Promise<{ status: number; body: any }> {
  const headers = new Headers(init.headers);
  if (init.bearer) headers.set('authorization', `Bearer ${init.bearer}`);
  else { const a = auth[init.as ?? 'admin']; headers.set('cookie', a.cookie); headers.set('x-flotilla-csrf', a.csrf); }
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  const r = await on.request(`http://local${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
  return { status: r.status, body: r.status === 202 || r.status === 204 ? null : await r.json() };
}
const get = (p: string, as = 'admin') => call(p, { as });
const put = (p: string, json: unknown, as = 'admin') => call(p, { method: 'PUT', json, as });
async function until<T>(f: () => Promise<T | undefined | null | false>): Promise<T> {
  for (let i = 0; i < 100; i++) { const v = await f(); if (v) return v; await new Promise((r) => setTimeout(r, 50)); }
  throw new Error('timed out');
}
const runs = async (id: string) => (await pool.query('SELECT state FROM runs WHERE thread_id=$1 ORDER BY ordinal', [id])).rows.map((r) => r.state);
const settled = (id: string, n: number) => until(async () => { const r = await runs(id); const t = (await pool.query('SELECT status FROM threads WHERE id=$1', [id])).rows[0]; return r.length >= n && !r.includes('starting') && !r.includes('running') && t.status !== 'working' && t.status !== 'queued' && t; });
async function seed(owner: string, title: string, entries: { at?: string; source?: string; model?: string | null; usd?: number; machineSec?: number; connectionId?: string | null }[]): Promise<string> {
  const id = `thr_${title}`;
  await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$2,'thread',$3,$4,'idle',$5,'{"maxUsd":null}','{"usd":0}')`, [id, `FLO-${title.slice(0, 4).toUpperCase()}`, owner, title, JSON.stringify({ adapter: 'fake', model: null, connectionId: entries[0]?.connectionId ?? 'free' })]);
  await pool.query(`INSERT INTO runs (id,thread_id,ordinal,trigger,state,usage) VALUES ($1,$2,1,'{}','completed','{}')`, [`run_${title}`, id]);
  for (const e of entries) await pool.query('INSERT INTO cost_entries (thread_id,run_id,at,source,model,delta) VALUES ($1,$2,COALESCE($3::timestamptz,now()),$4,$5,$6)', [id, `run_${title}`, e.at ?? null, e.source ?? 'vendor-usd', e.model ?? null,
    JSON.stringify({ usd: e.usd ?? 0, inputTokens: e.source === 'machine-estimate' ? 0 : 100, outputTokens: e.source === 'machine-estimate' ? 0 : 50, cacheTokens: 0, machineSec: e.machineSec ?? 0 })]);
  return id;
}

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url;
  pool = new pg.Pool({ connectionString: url });
  const store = (await import('../auth/store.js')).authStore(url);
  admin = (await store.setup('admin@x', 'pw', await store.getSetupToken()))!.userId;
  member = 'usr_member';
  await pool.query(`INSERT INTO users (id,email,role) VALUES ($1,'member@x','member')`, [member]);
  for (const [name, id] of [['admin', admin], ['member', member]] as const) { const s = await store.createSession(id); auth[name] = { cookie: `flotilla_session=${s.id}`, csrf: s.csrfToken }; }
  app = await (await import('../loader.js')).createApp();
  const { modelPolicyApi } = await import('../models-catalog/store.js');
  runner = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters: new Map([['fake', scripted], ['claude-code', runOutAdapter]]), runOut: modelPolicyApi() });
  threadsApp = new Hono();
  threadsApp.use('*', async (c, next) => { (c as unknown as { set(k: string, v: string): void }).set('userId', admin); await next(); });
  threadsApp.route('/api/v1', (await import('../routes/threads.route.js')).createThreadsRoute(runner).app);
}, 60_000);
afterAll(async () => { await runner?.drain(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('usage, budgets and API models', () => {
  it('CAPY-341: machine time is metered as machineSec and priced per runner type by the operator (admin only)', async () => {
    expect((await put('/api/v1/usage/settings', { machineRates: { pool: 60_000 } }, 'member')).status).toBe(403);
    expect((await put('/api/v1/usage/settings', { machineRates: { pool: -1 } })).status).toBe(400);
    expect((await put('/api/v1/usage/settings', { machineRates: { pool: 60_000 } })).body).toEqual({ runOutFree: 'ask', machineRates: { pool: 60_000 } });
    const t = await seed(admin, 'machine', [{ source: 'machine-estimate', machineSec: 10 }]);
    // the runner module's 10 s ticker inserts exactly this row shape (usd 0); the ledger prices it
    await pool.query(`INSERT INTO cost_entries (thread_id,run_id,source,delta) SELECT thread_id,id,'machine-estimate',jsonb_build_object('usd',0,'inputTokens',0,'outputTokens',0,'cacheTokens',0,'machineSec',10) FROM runs WHERE id=$1`, ['run_machine']);
    const rows = (await pool.query(`SELECT delta, item, runner_type FROM cost_entries WHERE thread_id=$1`, [t])).rows;
    expect(rows).toEqual([0, 1].map(() => ({ delta: { usd: 10_000, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 10 }, item: 'machine', runner_type: 'pool' })));
    const report = (await get('/api/v1/usage')).body;
    expect(report.byItem.find((r: any) => r.key === 'machine').totals).toMatchObject({ usd: 20_000, machineSec: 20 });
    expect(report.machine).toEqual([{ runnerType: 'pool', minutes: 20 / 60, usdMicroPerMinute: 60_000, usd: 20_000 }]);
    // the thread's own cap counts priced machine time from the ledger (threads.spent is not updated by the ticker)
    const row = (await pool.query(`UPDATE threads SET budget='{"maxUsd":15000}' WHERE id=$1 RETURNING *`, [t])).rows[0];
    expect(await usageStore().gate(row)).toEqual({ why: 'budget', shared: false });
    await pool.query(`UPDATE threads SET budget='{"maxUsd":null}' WHERE id=$1`, [t]);
  });

  it('CAPY-352/353/635: usage report over a window by member, model, thread and billing item, with tokens; members see only their own', async () => {
    await seed(admin, 'adminwork', [{ model: 'claude-opus', usd: 300_000 }, { model: 'claude-opus', usd: 1, at: '2001-01-01T00:00:00Z' }]);
    await seed(member, 'memberwork', [{ model: 'gpt-5', usd: 200_000, connectionId: 'free' }]);
    const r = (await get('/api/v1/usage')).body;
    expect(r.window).toBe('month');
    expect(Date.parse(r.from)).toBeLessThanOrEqual(Date.now()); expect(Date.parse(r.to)).toBeGreaterThan(Date.now());
    expect(r.totals).toMatchObject({ usd: 520_000, inputTokens: 200, outputTokens: 100, machineSec: 20 });
    expect(r.byMember).toEqual(expect.arrayContaining([expect.objectContaining({ key: admin, label: 'admin@x', totals: expect.objectContaining({ usd: 320_000 }) }), expect.objectContaining({ key: member, label: 'member@x', totals: expect.objectContaining({ usd: 200_000 }) })]));
    expect(r.byModel.find((x: any) => x.key === 'claude-opus').totals.usd).toBe(300_000);
    // a private thread's title is shown only to its current owner (shared threads also to admins)
    expect(r.byThread.find((x: any) => x.key === 'thr_memberwork')).toMatchObject({ label: 'thr_memberwork', totals: { usd: 200_000, inputTokens: 100, outputTokens: 50 } });
    expect(r.byThread.find((x: any) => x.key === 'thr_adminwork').label).toBe('adminwork');
    expect(r.byItem.map((x: any) => x.key).sort()).toEqual(['free', 'machine']);
    const all = (await get('/api/v1/usage?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z')).body;
    expect(all.totals.usd).toBe(520_001);
    const mine = (await get('/api/v1/usage', 'member')).body;
    expect(mine.totals.usd).toBe(200_000); expect(mine.byMember.map((x: any) => x.key)).toEqual([member]);
    expect(mine.byThread[0].label).toBe('memberwork');
    expect((await get('/api/v1/usage?from=nope')).status).toBe(400);
  });

  it('CAPY-353/636: series buckets by hour or day and groups by member, billing item or thread', async () => {
    const day = (await get('/api/v1/usage/series?bucket=day&by=member')).body;
    expect(day).toMatchObject({ bucket: 'day', by: 'member' });
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    expect(day.points.find((p: any) => p.key === member)).toMatchObject({ at: today.toISOString(), totals: { usd: 200_000 } });
    const hour = (await get('/api/v1/usage/series?bucket=hour&by=item')).body;
    expect(new Date(hour.points[0].at).getUTCMinutes()).toBe(0);
    expect(hour.points.reduce((n: number, p: any) => n + p.totals.usd, 0)).toBe(520_000);
    expect((await get('/api/v1/usage/series?bucket=day&by=thread')).body.points.map((p: any) => p.key)).toContain('thr_adminwork');
    expect((await get('/api/v1/usage/series?bucket=week')).status).toBe(400);
  });

  it('CAPY-346/637: a monthly global window caps spend, counts only this month, shows balance and pauses new runs until raised', async () => {
    expect((await put('/api/v1/usage/budgets', [{ scope: 'global', scopeId: 'global', window: 'month', maxUsd: 500_000, warnAt: 0.8 }], 'member')).status).toBe(403);
    expect((await put('/api/v1/usage/budgets', [{ scope: 'global', scopeId: 'global', window: 'weekly', maxUsd: 1 }])).status).toBe(400);
    await put('/api/v1/usage/budgets', [{ scope: 'global', scopeId: 'global', window: 'month', maxUsd: 500_000, warnAt: 0.8 }]);
    await pool.query(`DELETE FROM threads WHERE id='thr_memberwork'`); // hard delete cascades the ledger; the window keeps the spend
    const bal = (await get('/api/v1/usage/balance', 'member')).body.windows.find((w: any) => w.scope === 'global');
    expect(bal).toMatchObject({ window: 'month', maxUsd: 500_000, spent: 520_000, reserved: 0, remaining: 0, state: 'hit' });
    expect(new Date(bal.start).getUTCDate()).toBe(1);
    const t = (await call('/api/v1/threads', { method: 'POST', json: { title: 'capped', prompt: 'go' } }, threadsApp)).body;
    await settled(t.id, 1);
    expect(await runs(t.id)).toEqual(['paused_budget']);
    const card = (await pool.query(`SELECT * FROM approvals WHERE thread_id=$1 AND kind='budget' AND state='open'`, [t.id])).rows[0];
    expect(card.question).toMatch(/monthly global budget/);
    await put('/api/v1/usage/budgets', [{ scope: 'global', scopeId: 'global', window: 'month', maxUsd: 2_000_000, warnAt: 0.8 }]);
    expect((await get('/api/v1/usage/balance')).body.windows[0]).toMatchObject({ remaining: 1_480_000, state: 'ok' });
    expect(card.detail).toEqual({ shared: true });
    await runner.answerApproval(card.id, 'raise', 1_000_000, admin);
    await settled(t.id, 2);
    expect((await pool.query('SELECT budget FROM threads WHERE id=$1', [t.id])).rows[0].budget.maxUsd).toBeNull();
    expect(await runs(t.id)).toEqual(['paused_budget', 'completed']);
    await put('/api/v1/usage/budgets', [{ scope: 'global', scopeId: 'global', window: 'month', maxUsd: null, warnAt: 0.8 }]);
  });

  it('CAPY-481: when a connection runs out the switch to free models always asks (admin setting can forbid it); never a silent downgrade', async () => {
    await call('/api/v1/connections', { method: 'POST', json: { provider: 'claude-code-subscription', label: 'Claude subscription' } });
    await put('/api/v1/me/model-policy', { runOut: 'keep-going' });
    const a = (await call('/api/v1/threads', { method: 'POST', json: { title: 'sub', prompt: 'go', engine: { adapter: 'claude-code' } } }, threadsApp)).body;
    const card = await until(async () => (await pool.query(`SELECT * FROM approvals WHERE thread_id=$1 AND kind='run-out' AND state='open'`, [a.id])).rows[0]);
    expect(card.options.map((o: any) => o.label)).toEqual(['Wait', 'Use Flotilla free models']);
    expect((await pool.query('SELECT engine FROM threads WHERE id=$1', [a.id])).rows[0].engine.adapter).toBe('claude-code');
    expect((await put('/api/v1/usage/settings', { runOutFree: 'never' })).body.runOutFree).toBe('never');
    const before = (await pool.query('SELECT status FROM threads WHERE id=$1', [a.id])).rows[0].status;
    await runner.answerApproval(card.id, 'use', undefined, admin); // an offer made before the ban no longer moves the thread to free
    expect((await pool.query('SELECT engine FROM threads WHERE id=$1', [a.id])).rows[0].engine.adapter).toBe('claude-code');
    expect((await pool.query('SELECT status FROM threads WHERE id=$1', [a.id])).rows[0].status).toBe(before); // not restarted on the exhausted connection
    expect((await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [a.id])).rows[0].n).toBe(1);
    const b = (await call('/api/v1/threads', { method: 'POST', json: { title: 'sub2', prompt: 'go', engine: { adapter: 'claude-code' } } }, threadsApp)).body;
    const card2 = await until(async () => (await pool.query(`SELECT * FROM approvals WHERE thread_id=$1 AND kind='run-out' AND state='open'`, [b.id])).rows[0]);
    expect(card2.options.map((o: any) => o.label)).toEqual(['Wait']);
    expect((await put('/api/v1/usage/settings', { runOutFree: 'silent' })).status).toBe(400);
    await settled(a.id, 1); await settled(b.id, 1);
  });

  it('CAPY-639: the public API lists models with an API key', async () => {
    const minted = (await call('/api/v1/api-keys', { method: 'POST', json: { name: 'usage' } })).body;
    const r = await call('/api/v1/models', { bearer: minted.token });
    expect(r.status).toBe(200);
    expect(r.body.items.find((m: any) => m.id === 'fake:fake-small')).toMatchObject({ adapter: 'fake', connections: [{ id: 'free', badge: 'free' }] });
    expect((await call('/api/v1/usage/balance', { bearer: minted.token })).status).toBe(200);
  });
});
