import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { argvFor } from '@flotilla/adapter-codex';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AdapterEvent, AgentAdapter, StartInput } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';

const exec = promisify(execFile);
process.env.FLOTILLA_MASTER_KEY = 'test-master-key-for-model-policy';
const KEY = 'fixture-anthropic-key-1111';
// Fixture rows (made-up ids, no prices): one Claude model and a 1.05M-context Codex model.
const fixtureCatalog = { models: [
  { adapter: 'claude-code', model: 'claude-fixture', displayName: 'Claude fixture', provider: 'fixture', listPrice: null, byok: true, zdr: false, free: false, efforts: [] },
  { adapter: 'codex', model: 'gpt-6', displayName: 'GPT-6', provider: 'fixture', listPrice: null, byok: true, zdr: false, free: false, efforts: [], contextWindow: 1_050_000 }
] };
let dir = ''; let container = ''; let pool: pg.Pool; let app: Hono; let threadsApp: Hono; let cookie = ''; let csrf = ''; let owner = '';
const starts: StartInput[] = [];
/** Scripted: the subscription (no API key) runs out; a prompt containing `exhaust` runs out on every connection. */
const scripted: AgentAdapter = { ...fakeAdapter, manifest: fakeAdapter.manifest, probe: fakeAdapter.probe, resume: (i) => scripted.start(i), cancel: async () => undefined,
  start: (input: StartInput) => { starts.push(input); const out = !input.env.ANTHROPIC_API_KEY || input.prompt.includes('exhaust');
    return (async function* (): AsyncGenerator<AdapterEvent> { yield { t: 'text', delta: 'ok' }; yield { t: 'done', stopReason: out ? 'run_out' : 'end_turn' }; })(); } };
const driver = { startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => ({}), copyIn: async () => undefined, copyOut: async () => Buffer.from(''), stop: async () => undefined };

async function call(path: string, init: RequestInit & { json?: unknown } = {}, on = app): Promise<{ status: number; body: any }> {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  const r = await on.request(`http://local${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
  return { status: r.status, body: r.status === 202 || r.status === 204 ? null : await r.json() };
}
const get = (p: string) => call(p);
const post = (p: string, json: unknown, on = app) => call(p, { method: 'POST', json }, on);
const put = (p: string, json: unknown) => call(p, { method: 'PUT', json });
const patch = (p: string, json: unknown) => call(p, { method: 'PATCH', json });
const thread = (engine: unknown, prompt = 'p') => post('/api/v1/threads', { title: 't', prompt, engine }, threadsApp);
const say = (id: string, text: string) => post(`/api/v1/threads/${id}/message`, { text }, threadsApp);
async function until<T>(f: () => Promise<T | undefined | null | false>): Promise<T> {
  for (let i = 0; i < 100; i++) { const v = await f(); if (v) return v; await new Promise((r) => setTimeout(r, 50)); }
  throw new Error('timed out');
}
const runs = async (id: string) => (await pool.query('SELECT state FROM runs WHERE thread_id=$1 ORDER BY ordinal', [id])).rows.map((r) => r.state);
const settled = (id: string, n: number) => until(async () => { const r = await runs(id); const t = (await pool.query('SELECT status FROM threads WHERE id=$1', [id])).rows[0]; return r.length >= n && !r.includes('starting') && t.status !== 'working' && t.status !== 'queued' && t; });
const openCard = (id: string) => until(async () => (await pool.query(`SELECT * FROM approvals WHERE thread_id=$1 AND kind='run-out' AND state='open'`, [id])).rows[0]);
let sub = ''; let key = ''; let codexKey = '';

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url;
  dir = mkdtempSync(join(tmpdir(), 'flotilla-policy-'));
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(fixtureCatalog));
  process.env.FLOTILLA_MODEL_CATALOG = join(dir, 'catalog.json');
  pool = new pg.Pool({ connectionString: url });
  const auth = (await import('../auth/store.js')).authStore(url);
  owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const session = (await auth.login('owner@x', 'pw'))!;
  cookie = `flotilla_session=${session.id}`; csrf = session.csrfToken;
  const storeMod = await import('./store.js'); const { modelPolicyApi } = await import('./model-policy-api.js');
  app = await (await import('../loader.js')).createApp();
  const runner = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters: new Map([['fake', scripted], ['claude-code', scripted], ['codex', scripted]]), vault: storeMod.withConnectionKeys({ mutate: async () => [], prepare: async () => ({ env: {}, grants: [] }) }, storeMod.modelsCatalogStore(url)), runOut: modelPolicyApi() });
  threadsApp = new Hono();
  threadsApp.use('*', async (c, next) => { (c as unknown as { set(k: string, v: string): void }).set('userId', owner); await next(); });
  threadsApp.onError((err, c) => c.json({ error: err.message }, ({ ValidationFailed: 400, NotFound: 404 } as Record<string, 400 | 404>)[(err as { kind?: string }).kind ?? ''] ?? 500));
  threadsApp.route('/api/v1', (await import('../routes/threads.route.js')).createThreadsRoute(runner).app);
  key = (await post('/api/v1/connections', { provider: 'claude-code-api-key', apiKey: KEY, label: 'Anthropic key' })).body.id;
  sub = (await post('/api/v1/connections', { provider: 'claude-code-subscription', label: 'Claude subscription' })).body.id;
  codexKey = (await post('/api/v1/connections', { provider: 'codex-api-key', apiKey: 'fixture-codex-key', label: 'Codex key' })).body.id;
}, 60_000);
afterAll(async () => { rmSync(dir, { recursive: true, force: true }); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('model policy and model API', () => {
  it('CAPY-336/484: GET /models has one row per model; a Claude subscription runs it before the key added earlier', async () => {
    const { status, body } = await get('/api/v1/models');
    expect(status).toBe(200);
    expect(body.items.filter((m: any) => m.id === 'claude-code:claude-fixture')).toHaveLength(1);
    expect(body.items.find((m: any) => m.id === 'claude-code:claude-fixture')).toMatchObject({ displayName: 'Claude fixture', connections: [{ id: sub, badge: 'subscription' }, { id: key, badge: 'key' }] });
    expect(body.items.find((m: any) => m.id === 'fake:fake-small').connections).toEqual([{ id: 'free', label: 'Flotilla free models', badge: 'free' }]);
    expect((await post('/api/v1/models/resolve', { adapter: 'claude-code', model: 'claude-fixture' })).body).toMatchObject({ connectionId: sub, badge: 'subscription' });
  });

  it('CAPY-333: default run-out policy is ask — a Wait/Use card; /continue moves to the next connection and reruns the prompt', async () => {
    expect((await get('/api/v1/me/model-policy')).body).toEqual({ runOut: 'ask', neverFree: false, excludedAdapters: [], background: null });
    const t = (await thread({ adapter: 'claude-code', model: 'claude-fixture' }, 'build it')).body;
    const card = await openCard(t.id);
    expect(card.options).toEqual([{ id: 'wait', label: 'Wait' }, { id: 'use', label: 'Use Anthropic key', engine: { adapter: 'claude-code', model: 'claude-fixture', effort: null, connectionId: key } }]);
    expect(await settled(t.id, 1)).toMatchObject({ status: 'paused' });
    expect((await pool.query('SELECT needs_you FROM threads WHERE id=$1', [t.id])).rows[0].needs_you).toEqual([card.id]);
    expect(await runs(t.id)).toEqual(['run_out']);
    expect((await say(t.id, '/continue')).status).toBe(202);
    await settled(t.id, 2);
    expect(await runs(t.id)).toEqual(['run_out', 'completed']);
    expect(starts.at(-1)).toMatchObject({ prompt: 'build it', env: { ANTHROPIC_API_KEY: KEY } });
    expect((await pool.query('SELECT engine, needs_you FROM threads WHERE id=$1', [t.id])).rows[0]).toEqual({ engine: { adapter: 'claude-code', model: 'claude-fixture', effort: null, connectionId: key }, needs_you: [] });
    expect((await say(t.id, '/continue')).status).toBe(404);
  });

  it('CAPY-333: /wait keeps the thread paused on its connection; no run starts', async () => {
    const t = (await thread({ adapter: 'claude-code', model: 'claude-fixture' })).body;
    const card = await openCard(t.id); await settled(t.id, 1);
    expect((await say(t.id, '/wait')).status).toBe(202);
    expect((await pool.query('SELECT state, answer FROM approvals WHERE id=$1', [card.id])).rows[0]).toMatchObject({ state: 'answered', answer: { optionId: 'wait' } });
    await new Promise((r) => setTimeout(r, 300));
    expect(await runs(t.id)).toEqual(['run_out']);
    expect((await pool.query('SELECT status, engine FROM threads WHERE id=$1', [t.id])).rows[0]).toMatchObject({ status: 'paused', engine: { connectionId: sub } });
  });

  it('CAPY-333: keep going switches without asking; ask before free asks only before the free models', async () => {
    expect((await put('/api/v1/me/model-policy', { runOut: 'keep-going' })).body.runOut).toBe('keep-going');
    const a = (await thread({ adapter: 'claude-code', model: 'claude-fixture' })).body;
    await settled(a.id, 2);
    expect(await runs(a.id)).toEqual(['run_out', 'completed']);
    expect((await pool.query(`SELECT count(*)::int n FROM approvals WHERE thread_id=$1`, [a.id])).rows[0].n).toBe(0);
    await put('/api/v1/me/model-policy', { runOut: 'ask-before-free' });
    const b = (await thread({ adapter: 'claude-code', model: 'claude-fixture' }, 'exhaust')).body;
    const card = await openCard(b.id); await settled(b.id, 2);
    expect(await runs(b.id)).toEqual(['run_out', 'run_out']);
    expect(card.options.map((o: any) => o.label)).toEqual(['Wait', 'Use Flotilla free models']);
    expect((await put('/api/v1/me/model-policy', { runOut: 'later' })).status).toBe(400);
  });

  it('CAPY-337: the catalog context window (1.05M for GPT-6 on Codex) is listed and reaches the Codex CLI', async () => {
    expect((await get('/api/v1/models')).body.items.find((m: any) => m.id === 'codex:gpt-6')).toMatchObject({ contextWindow: 1_050_000, connections: [{ id: codexKey }] });
    const t = (await thread({ adapter: 'codex', model: 'gpt-6' })).body;
    expect(t.engine).toEqual({ adapter: 'codex', model: 'gpt-6', effort: null, connectionId: codexKey, contextWindow: 1_050_000 });
    await until(async () => starts.find((s) => s.threadId === t.id));
    const input = starts.find((s) => s.threadId === t.id)!;
    expect(input.contextWindow).toBe(1_050_000);
    expect(argvFor(input)).toEqual(['codex', 'exec', '--json', '--model', 'gpt-6', '-c', 'model_context_window=1050000', 'p']);
  });

  it('CAPY-485: changing a connection Base URL reaches the next run through the adapter base-URL env var', async () => {
    expect((await patch(`/api/v1/connections/${key}`, { baseUrl: 'http://127.0.0.1:9/anthropic' })).body).toMatchObject({ baseUrl: 'http://127.0.0.1:9/anthropic', status: 'connected' });
    expect((await patch(`/api/v1/connections/${key}`, { baseUrl: 'ftp://x' })).status).toBe(400);
    const t = (await thread({ adapter: 'claude-code', model: 'claude-fixture', connectionId: key })).body;
    await settled(t.id, 1);
    expect(starts.at(-1)!.env).toEqual({ ANTHROPIC_API_KEY: KEY, ANTHROPIC_BASE_URL: 'http://127.0.0.1:9/anthropic' });
    await patch(`/api/v1/connections/${key}`, { baseUrl: 'https://gateway.example/v1' });
    await say(t.id, 'again'); await settled(t.id, 2);
    expect(starts.at(-1)!.env.ANTHROPIC_BASE_URL).toBe('https://gateway.example/v1');
  });

  it('CAPY-335: never use free models and exclude a company’s models (an adapter) apply to the list, picker, resolve and run-out', async () => {
    await put('/api/v1/me/model-policy', { runOut: 'ask-before-free', neverFree: true, excludedAdapters: ['codex'] });
    const ids = (await get('/api/v1/models')).body.items.map((m: any) => m.id);
    expect(ids).toEqual(['claude-code:claude-fixture']);
    expect((await get('/api/v1/models/picker')).body.items.map((i: any) => i.key)).toEqual(['claude-code:claude-fixture']);
    expect((await post('/api/v1/models/resolve', { adapter: 'fake', model: 'fake-small' })).status).toBe(400);
    expect((await post('/api/v1/models/resolve', { adapter: 'fake', model: 'fake-small', connectionId: 'free' })).body.error).toMatch(/never uses the free models/);
    expect((await post('/api/v1/models/resolve', { adapter: 'codex', model: 'gpt-6', connectionId: codexKey })).body.error).toMatch(/excluded by your model policy/);
    const t = (await thread({ adapter: 'claude-code', model: 'claude-fixture', connectionId: key }, 'exhaust')).body;
    expect((await openCard(t.id)).options).toEqual([{ id: 'wait', label: 'Wait' }]);
    expect((await say(t.id, '/continue')).status).toBe(400);
    expect((await put('/api/v1/me/model-policy', { excludedAdapters: ['nope'] })).status).toBe(400);
  });

  it('CAPY-338: background requests resolve to the user’s chosen model (or the thread’s), under the same policy', async () => {
    expect((await post('/api/v1/models/background', { engine: { adapter: 'claude-code', model: 'claude-fixture' } })).body).toMatchObject({ adapter: 'claude-code', connectionId: sub });
    await put('/api/v1/me/model-policy', { background: { adapter: 'fake', model: 'fake-small' } });
    expect((await post('/api/v1/models/background', {})).status).toBe(400);
    await put('/api/v1/me/model-policy', { neverFree: false });
    expect((await post('/api/v1/models/background', { engine: { adapter: 'claude-code' } })).body).toMatchObject({ adapter: 'fake', model: 'fake-small', connectionId: 'free', badge: 'free' });
  });

  it('an engine whose adapter is not installed fails the run instead of running another adapter', async () => {
    const r = new ThreadRunner({ store: new EventStore(process.env.DATABASE_URL!), driver: driver as never, adapters: new Map([['fake', scripted]]) });
    const before = starts.length;
    const t = await r.createThread({ ownerId: owner, title: 't', prompt: 'p', engine: { adapter: 'codex', model: null, effort: null, connectionId: null } as never });
    await r.drain();
    expect((await pool.query('SELECT status FROM threads WHERE id=$1', [t.id])).rows[0].status).toBe('failed');
    expect(await runs(t.id as string)).toEqual(['failed']);
    expect(starts.length).toBe(before);
  });
});
