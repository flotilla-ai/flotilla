import { execFile, spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AgentAdapter, ProcessHandle, ProcessTransport, StartInput } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';

const exec = promisify(execFile);
process.env.FLOTILLA_MASTER_KEY = 'test-master-key-for-models-catalog';
const KEY_A = 'fixture-key-aaaa1111'; const KEY_B = 'fixture-key-bbbb2222';
// Fixture list price (made-up test numbers, not a vendor price).
const fixtureCatalog = { models: [{ adapter: 'codex', model: 'gw-alpha', displayName: 'GW Alpha', provider: 'fixture-gateway', listPrice: { inputMicroUsdPerMTok: 1_250_000, outputMicroUsdPerMTok: 10_000_000 }, byok: true, zdr: false, free: false, efforts: ['low', 'medium', 'high'] }] };
let dir = '';
let container = ''; let pool: pg.Pool; let app: Hono; let threadsApp: Hono; let fixture: Server; let baseUrl = '';
let cookie = ''; let csrf = ''; let owner = ''; const member = 'usr_member';
let served = ['gw-alpha', 'gw-beta'];
let storeMod: typeof import('./store.js');
const starts: StartInput[] = [];

function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function*(){let rest='';for await(const c of stream){rest+=c.toString();const p=rest.split('\n');rest=p.pop()!;for(const x of p)yield x;}if(rest)yield rest;})(); }
const localTransport: ProcessTransport = { spawn(argv,opts) { const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:{...process.env,...opts.env},detached:true,stdio:['ignore','pipe','pipe']}); return { stdout:lines(child.stdout!),stderr:lines(child.stderr!),exit:new Promise((r)=>child.once('exit',(code,signal)=>r({code,signal}))),signal:async(sig)=>{if(child.pid)process.kill(-child.pid,sig)} } satisfies ProcessHandle; } };
const driver = { startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => localTransport, copyIn: async () => undefined, copyOut: async () => Buffer.from(''), stop: async () => undefined };
const spyAdapter: AgentAdapter = Object.assign(Object.create(fakeAdapter) as AgentAdapter, { start: (input: StartInput) => { starts.push(input); return fakeAdapter.start(input); } });

async function call(path: string, init: RequestInit & { json?: unknown } = {}, on = app): Promise<Response> {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return on.request(`http://local${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
const json = async (path: string, init: RequestInit & { json?: unknown } = {}) => { const r = await call(path, init); return { status: r.status, body: await r.json() as any }; };
const post = (path: string, body: unknown) => json(path, { method: 'POST', json: body });
const patch = (path: string, body: unknown) => json(path, { method: 'PATCH', json: body });
const custom = (label: string, apiKey: string, extra: Record<string, unknown> = {}) => post('/api/v1/connections', { provider: 'custom-openai', adapter: 'codex', baseUrl, apiKey, label, ...extra });
async function ended(threadId: string): Promise<void> {
  for (let i = 0; i < 100; i++) { if ((await pool.query(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='run.ended'`, [threadId])).rows[0]) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('run did not end');
}

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url;
  dir = mkdtempSync(join(tmpdir(), 'flotilla-catalog-'));
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(fixtureCatalog));
  process.env.FLOTILLA_MODEL_CATALOG = join(dir, 'catalog.json');
  fixture = createServer((req, res) => {
    const ok = req.url === '/v1/models' && [KEY_A, KEY_B].some((k) => req.headers.authorization === `Bearer ${k}`);
    res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' }).end(JSON.stringify(ok ? { object: 'list', data: served.map((id) => ({ id, object: 'model' })) } : { error: 'bad key' }));
  });
  await new Promise<void>((r) => fixture.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(fixture.address() as { port: number }).port}/v1`;
  pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js');
  const auth = authStore(url);
  owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const session = (await auth.login('owner@x', 'pw'))!;
  cookie = `flotilla_session=${session.id}`; csrf = session.csrfToken;
  await pool.query(`INSERT INTO users (id,email,role) VALUES ($1,'member@x','member')`, [member]);
  storeMod = await import('./store.js');
  app = await (await import('../loader.js')).createApp();
  const store = storeMod.modelsCatalogStore(url);
  const runner = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters: new Map([['fake', spyAdapter], ['codex', spyAdapter]]), vault: storeMod.withConnectionKeys({ mutate: async () => [], prepare: async () => ({ env: {}, grants: [] }) }, store) });
  const route = (await import('../routes/threads.route.js')).createThreadsRoute(runner);
  threadsApp = new Hono();
  threadsApp.use('*', async (c, next) => { (c as unknown as { set(k: string, v: string): void }).set('userId', owner); await next(); });
  threadsApp.onError((err, c) => c.json({ error: err.message, code: `flotilla/${(err as { kind?: string }).kind ?? 'Internal'}` }, (err as { kind?: string }).kind === 'ValidationFailed' ? 400 : 500));
  threadsApp.route('/api/v1', route.app);
}, 60_000);
afterAll(async () => { rmSync(dir, { recursive: true, force: true }); fixture?.close(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

async function thread(engine: unknown): Promise<{ status: number; body: any }> {
  const r = await call('/api/v1/threads', { method: 'POST', json: { title: 't', prompt: 'p', engine } }, threadsApp);
  return { status: r.status, body: await r.json() };
}

describe('models catalog and connections', () => {
  it('CAPY-318: catalog rows are adapter + model id with list price, BYOK and ZDR columns; operator file merges into the free built-ins', async () => {
    const { status, body } = await json('/api/v1/models/catalog');
    expect(status).toBe(200);
    expect(body.items.find((m: any) => m.model === 'gw-alpha')).toEqual(fixtureCatalog.models[0]);
    const free = body.items.filter((m: any) => m.free);
    expect(free.map((m: any) => `${m.adapter}:${m.model}`)).toEqual(['fake:fake-small', 'fake:fake-large']);
    for (const m of body.items) expect(Object.keys(m).sort()).toEqual(['adapter', 'byok', 'displayName', 'efforts', 'free', 'listPrice', 'model', 'provider', 'zdr']);
  });

  it('CAPY-328: searchable provider list built from adapter auth capabilities; subscriptions use the CLI device/vendor login', async () => {
    const all = (await json('/api/v1/models/providers')).body.items;
    expect(all.map((p: any) => p.id)).toEqual(expect.arrayContaining(['claude-code-subscription', 'claude-code-api-key', 'codex-subscription', 'codex-api-key', 'custom-openai']));
    expect(all.find((p: any) => p.id === 'codex-subscription')).toMatchObject({ kind: 'subscription', auth: { kind: 'vendor-login', command: ['codex', 'login'] } });
    expect((await json('/api/v1/models/providers?q=CODEX')).body.items.map((p: any) => p.id)).toEqual(['codex-subscription', 'codex-api-key']);
    const sub = await post('/api/v1/connections', { provider: 'claude-code-subscription' });
    expect(sub.status).toBe(201);
    expect(sub.body).toMatchObject({ kind: 'subscription', status: 'needs-login', loginCommand: ['claude', 'auth', 'login'], hasKey: false });
    expect((await post('/api/v1/connections', { provider: 'nope' })).status).toBe(404);
    expect((await post('/api/v1/connections', { provider: 'codex-api-key' })).status).toBe(400);
  });

  it('CAPY-329: check access lists models before connecting; excluded models stay out and new models are covered automatically', async () => {
    const before = (await json('/api/v1/connections')).body.items.length;
    const check = await post('/api/v1/models/check-access', { provider: 'custom-openai', adapter: 'codex', baseUrl, apiKey: KEY_A });
    expect(check.body).toEqual({ status: 'connected', models: ['gw-alpha', 'gw-beta'], loginCommand: null, error: null });
    expect((await post('/api/v1/models/check-access', { provider: 'custom-openai', adapter: 'codex', baseUrl, apiKey: 'wrong' })).body).toMatchObject({ status: 'failed', models: [], error: 'HTTP 401' });
    expect((await json('/api/v1/connections')).body.items.length).toBe(before);
    const c = await custom('Gateway A', KEY_A, { excludedModels: ['gw-beta'] });
    expect(c.body).toMatchObject({ status: 'connected', models: ['gw-alpha'], hasKey: true });
    expect(JSON.stringify(c.body)).not.toContain(KEY_A);
    const row = (await pool.query('SELECT * FROM model_connections WHERE id=$1', [c.body.id])).rows[0];
    expect((row.sealed_key as Buffer).includes(Buffer.from(KEY_A))).toBe(false);
    served = ['gw-alpha', 'gw-beta', 'gw-gamma'];
    expect((await post(`/api/v1/connections/${c.body.id}/test`, {})).body.models).toEqual(['gw-alpha', 'gw-gamma']);
  });

  it('CAPY-330: custom model ids on your key are added and found by id, and then selectable on that connection', async () => {
    const c = (await custom('Gateway Find', KEY_A)).body;
    expect((await patch(`/api/v1/connections/${c.id}`, { customModels: ['ft:gw-alpha:acme'] })).body.models).toContain('ft:gw-alpha:acme');
    expect((await json(`/api/v1/connections/${c.id}/models?q=acme`)).body.items).toEqual(['ft:gw-alpha:acme']);
    expect((await post('/api/v1/models/resolve', { adapter: 'codex', model: 'ft:gw-alpha:acme', connectionId: c.id })).body).toMatchObject({ connectionId: c.id, badge: 'key' });
    expect((await patch(`/api/v1/connections/${c.id}`, { customModels: [''] })).status).toBe(400);
  });

  it('CAPY-325: effort none…max is validated per model; unsupported fails with no fallback; the chosen effort reaches the adapter', async () => {
    expect((await post('/api/v1/models/resolve', { adapter: 'codex', model: 'gw-alpha', effort: 'high' })).status).toBe(200);
    const max = await post('/api/v1/models/resolve', { adapter: 'codex', model: 'gw-alpha', effort: 'max' });
    expect(max.status).toBe(400);
    expect(max.body.error).toMatch(/does not support effort max; no fallback/);
    expect((await post('/api/v1/models/resolve', { adapter: 'codex', model: 'gw-alpha', effort: 'turbo' })).status).toBe(400);
    expect((await post('/api/v1/models/resolve', { adapter: 'codex', model: 'gw-gamma', effort: 'low' })).status).toBe(400);
    const t = await thread({ adapter: 'fake', model: 'fake-large', effort: 'max' });
    expect(t.status).toBe(201);
    await ended(t.body.id);
    expect(starts.at(-1)).toMatchObject({ model: 'fake-large', effort: 'max' });
    expect((await thread({ adapter: 'fake', model: 'fake-small', effort: 'max' })).status).toBe(400);
  });

  it('CAPY-327: order is owner → org → free; reorder, per-connection models, edit, test, reconnect, disable', async () => {
    const store = storeMod.modelsCatalogStore();
    await expect(store.create(member, { provider: 'custom-openai', adapter: 'codex', baseUrl, apiKey: KEY_A, scope: 'org' })).rejects.toMatchObject({ kind: 'Forbidden' });
    const org = await post('/api/v1/connections', { provider: 'custom-openai', adapter: 'codex', baseUrl, apiKey: KEY_B, scope: 'org', label: 'Org gateway' });
    expect(org.body.scope).toBe('org');
    const list = (await json('/api/v1/connections')).body.items;
    expect(list.map((c: any) => c.scope)).toEqual([...list.filter((c: any) => c.scope === 'user').map(() => 'user'), 'org', 'free']);
    const mine = list.filter((c: any) => c.scope === 'user').map((c: any) => c.id);
    const reversed = [...mine].reverse();
    expect((await json('/api/v1/connections/order', { method: 'PUT', json: { ids: reversed } })).body.items.filter((c: any) => c.scope === 'user').map((c: any) => c.id)).toEqual(reversed);
    expect((await json('/api/v1/connections/order', { method: 'PUT', json: { ids: [org.body.id] } })).status).toBe(400);
    const first = reversed.find((id: string) => list.find((c: any) => c.id === id).kind === 'custom');
    expect((await patch(`/api/v1/connections/${first}`, { label: 'Renamed' })).body.label).toBe('Renamed');
    expect((await patch(`/api/v1/connections/${first}`, { apiKey: 'wrong' })).body).toMatchObject({ status: 'failed', availableModels: [] });
    expect((await patch(`/api/v1/connections/${first}`, { apiKey: KEY_A })).body.status).toBe('connected');
    expect((await patch(`/api/v1/connections/${first}`, { baseUrl: 'file:///etc' })).status).toBe(400);
    expect((await store.list(owner)).find((c) => c.id === first)).toMatchObject({ baseUrl, status: 'connected' });
    await expect(store.check(member, { provider: 'custom-openai', adapter: 'codex', baseUrl, apiKey: KEY_A })).rejects.toMatchObject({ kind: 'Forbidden' });
    for (const id of mine) await patch(`/api/v1/connections/${id}`, { enabled: false });
    expect((await post('/api/v1/models/resolve', { adapter: 'codex', model: 'gw-alpha' })).body).toMatchObject({ connectionId: org.body.id, connectionLabel: 'Org gateway' });
    expect((await post('/api/v1/models/resolve', { adapter: 'codex', model: 'gw-alpha', connectionId: first })).status).toBe(400);
    expect((await post('/api/v1/models/resolve', { adapter: 'fake', model: 'fake-small' })).body).toMatchObject({ connectionId: 'free', badge: 'free' });
    for (const id of mine) await patch(`/api/v1/connections/${id}`, { enabled: true });
    expect((await store.list(member)).map((c) => c.scope)).toEqual(['org', 'free']);
    expect((await store.patch(member, first, { enabled: false }).catch((e) => e)).kind).toBe('NotFound');
  });

  it('CAPY-331: a model named on one connection runs only there — no fallback to other keys or free', async () => {
    const a = (await custom('Pin A', KEY_A)).body; const b = (await custom('Pin B', KEY_B)).body;
    const pinned = await thread({ adapter: 'codex', model: 'gw-alpha', connectionId: b.id });
    expect(pinned.status).toBe(201);
    expect(pinned.body.engine).toEqual({ adapter: 'codex', model: 'gw-alpha', effort: null, connectionId: b.id });
    await ended(pinned.body.id);
    expect(starts.at(-1)!.env.CODEX_API_KEY).toBe(KEY_B);
    await patch(`/api/v1/connections/${b.id}`, { excludedModels: ['gw-alpha'] });
    const refused = await thread({ adapter: 'codex', model: 'gw-alpha', connectionId: b.id });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/not available on Pin B; no fallback/);
    await expect(storeMod.modelsCatalogStore().connectionEnv(pinned.body.id)).rejects.toMatchObject({ kind: 'ValidationFailed' });
    expect((await post('/api/v1/models/resolve', { adapter: 'fake', model: 'fake-small', connectionId: a.id })).status).toBe(400);
  });

  it('CAPY-332: picker badges subscription/key/free with a tooltip naming the connection; favorites carry Alt+1…9', async () => {
    const sub = (await json('/api/v1/connections')).body.items.find((c: any) => c.kind === 'subscription');
    await patch(`/api/v1/connections/${sub.id}`, { customModels: ['sub-model'] });
    expect((await json('/api/v1/me/model-favorites', { method: 'PUT', json: { models: ['fake:fake-small', 'codex:gw-alpha'] } })).status).toBe(200);
    const items = (await json('/api/v1/models/picker')).body.items;
    const by = (k: string) => items.find((i: any) => i.key === k);
    expect(by('claude-code:sub-model')).toMatchObject({ badge: 'subscription', tooltip: `Subscription via ${sub.label}`, favorite: null, shortcut: null });
    expect(by('codex:gw-alpha')).toMatchObject({ badge: 'key', favorite: 2, shortcut: 'Alt+2' });
    expect(by('codex:gw-alpha').tooltip).toMatch(/^API key via /);
    expect(by('fake:fake-small')).toMatchObject({ badge: 'free', tooltip: 'Free via Flotilla free models', favorite: 1, shortcut: 'Alt+1' });
    expect(new Set(items.map((i: any) => i.key)).size).toBe(items.length);
    expect((await json('/api/v1/me/model-favorites', { method: 'PUT', json: { models: Array.from({ length: 10 }, () => 'fake:fake-small') } })).status).toBe(400);
    expect((await json('/api/v1/me/model-favorites', { method: 'PUT', json: { models: ['codex:unknown'] } })).status).toBe(400);
  });
});
