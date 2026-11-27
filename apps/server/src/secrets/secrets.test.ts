import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AgentAdapter, ProcessHandle, ProcessTransport, StartInput } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import { localKms } from './vault.js';

const exec = promisify(execFile);
process.env.FLOTILLA_MASTER_KEY = 'test-master-key-for-secrets-vault';
const VALUE = { project: 'shared-value-1111', personal: 'personal-value-2222', thread: 'thread-value-3333', other: 'other-user-value-4444' };
let container = ''; let pool: pg.Pool; let app: Hono; let threadsApp: Hono; let runner: ThreadRunner;
let cookie = ''; let csrf = ''; let owner = ''; const other = 'usr_other';
let store: import('./store.js').SecretsStore;
let storeMod: typeof import('./store.js');
const starts: StartInput[] = []; const containers: Record<string, unknown>[] = []; const copies: { dir: string; tar: Buffer }[] = [];

function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function*(){let rest='';for await(const c of stream){rest+=c.toString();const p=rest.split('\n');rest=p.pop()!;for(const x of p)yield x;}if(rest)yield rest;})(); }
const localTransport: ProcessTransport = { spawn(argv,opts) { const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:{...process.env,...opts.env},detached:true,stdio:['ignore','pipe','pipe']}); return { stdout:lines(child.stdout!),stderr:lines(child.stderr!),exit:new Promise((r)=>child.once('exit',(code,signal)=>r({code,signal}))),signal:async(sig)=>{if(child.pid)process.kill(-child.pid,sig)} } satisfies ProcessHandle; } };
const driver = { startThreadContainer: async (input: Record<string, unknown>) => { containers.push(input); return { containerId: 'fake' }; }, transport: () => localTransport, copyIn: async (_id: string, dir: string, tar: Buffer) => { copies.push({ dir, tar }); }, copyOut: async () => Buffer.from(''), stop: async () => undefined };
const spyAdapter: AgentAdapter = Object.assign(Object.create(fakeAdapter) as AgentAdapter, { start: (input: StartInput) => { starts.push(input); return fakeAdapter.start(input); } });

async function call(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
const put = (path: string, variables: unknown) => call(path, { method: 'PUT', json: { variables } });
async function project(name: string, ownerId = owner): Promise<string> {
  const id = `prj_${name}`;
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ($1,$2,$1,$3,'untrusted','{}')`, [id, ownerId, JSON.stringify({ owner: 'o', name: 'r', fullName: 'example.invalid/o/r' })]);
  return id;
}
async function ended(threadId: string): Promise<void> {
  for (let i = 0; i < 100; i++) { if ((await pool.query(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='run.ended'`, [threadId])).rows[0]) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('run did not end');
}
const untar = (tar: Buffer) => ({ name: tar.subarray(0, 100).toString().replace(/\0.*$/s, ''), mode: tar.subarray(100, 107).toString(), uid: parseInt(tar.subarray(108, 115).toString(), 8), body: tar.subarray(512, 512 + parseInt(tar.subarray(124, 135).toString(), 8)).toString() });

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url;
  pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js');
  const auth = authStore(url);
  owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const session = (await auth.login('owner@x', 'pw'))!;
  cookie = `flotilla_session=${session.id}`; csrf = session.csrfToken;
  await pool.query(`INSERT INTO users (id,email,role) VALUES ($1,'other@x','member')`, [other]);
  storeMod = await import('./store.js');
  store = storeMod.secretsStore(url);
  app = await (await import('../loader.js')).createApp();
  const es = new EventStore(url);
  runner = new ThreadRunner({ store: es, driver: driver as never, adapters: new Map([['fake', spyAdapter]]), vault: store });
  const route = (await import('../routes/threads.route.js')).createThreadsRoute(runner);
  threadsApp = new Hono();
  threadsApp.use('*', async (c, next) => { (c as unknown as { set(k: string, v: string): void }).set('userId', owner); await next(); });
  threadsApp.onError((err, c) => c.json({ error: err.message, code: `flotilla/${(err as { kind?: string }).kind ?? 'Internal'}` }, (err as { kind?: string }).kind === 'ValidationFailed' ? 400 : 500));
  threadsApp.route('/api/v1', route.app);
}, 60_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('secrets vault', () => {
  it('CAPY-380: values are envelope-encrypted at rest with the local KMS key and bound to their scope/name', async () => {
    const p = await project('kms');
    expect((await put(`/api/v1/projects/${p}/environment-variables`, [{ name: 'API_KEY', value: VALUE.project }])).status).toBe(200);
    const row = (await pool.query(`SELECT * FROM secrets WHERE scope='project' AND scope_id=$1`, [p])).rows[0];
    expect(row.key_id).toMatch(/^local:[0-9a-f]{16}$/);
    expect((row.sealed as Buffer).includes(Buffer.from(VALUE.project))).toBe(false);
    expect(JSON.stringify(row)).not.toContain(VALUE.project);
    const aad = `project:${p}:API_KEY`;
    expect(localKms(Buffer.from(process.env.FLOTILLA_MASTER_KEY!)).open(row.sealed, aad).toString()).toBe(VALUE.project);
    expect(() => localKms(Buffer.from('a-different-master-key')).open(row.sealed, aad)).toThrow();
    expect(() => localKms(Buffer.from(process.env.FLOTILLA_MASTER_KEY!)).open(row.sealed, `project:${p}:OTHER`)).toThrow();
  });

  it('CAPY-388/538/539/540: project env vars are set, listed and deleted via the API; values are write-only', async () => {
    const p = await project('api');
    const set = await put(`/api/v1/projects/${p}/environment-variables`, [{ name: 'DB_URL', value: VALUE.project }, { name: 'TOKEN_B', value: 'second-value-xx' }]);
    expect(set.status).toBe(200);
    const listed = await (await call(`/api/v1/projects/${p}/environment-variables`)).json() as { items: Record<string, unknown>[] };
    expect(listed.items.map((i) => i.name)).toEqual(['DB_URL', 'TOKEN_B']);
    expect(listed.items[0]).toMatchObject({ scope: 'project', configured: true, updatedBy: owner });
    expect(listed.items[0]).not.toHaveProperty('value');
    expect(JSON.stringify(listed)).not.toContain(VALUE.project);
    expect(JSON.stringify(await set.json())).not.toContain(VALUE.project);
    const del = await call(`/api/v1/projects/${p}/environment-variables`, { method: 'DELETE', json: { names: ['TOKEN_B'] } });
    expect(((await del.json()) as { items: { name: string }[] }).items.map((i) => i.name)).toEqual(['DB_URL']);
    expect((await call(`/api/v1/projects/${p}/environment-variables?names=DB_URL`, { method: 'DELETE' })).status).toBe(200);
    expect(((await (await call(`/api/v1/projects/${p}/environment-variables`)).json()) as { items: unknown[] }).items).toEqual([]);
    const bad = await put(`/api/v1/projects/${p}/environment-variables`, [{ name: '1BAD', value: 'x' }]);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: 'flotilla/ValidationFailed' });
    const foreign = await project('foreign', other);
    expect((await call(`/api/v1/projects/${foreign}/environment-variables`)).status).toBe(404);
    expect((await put(`/api/v1/projects/${foreign}/environment-variables`, [{ name: 'X', value: 'y' }])).status).toBe(404);
  });

  it('CAPY-383/385/386: thread > personal > shared precedence; values decrypted only at machine preparation into a 0600 file outside the repo', async () => {
    const p = await project('scopes');
    await put(`/api/v1/projects/${p}/environment-variables`, [{ name: 'SAME', value: VALUE.project }, { name: 'ONLY_SHARED', value: VALUE.project }]);
    await put('/api/v1/me/environment-variables', [{ name: 'SAME', value: VALUE.personal }, { name: 'ONLY_PERSONAL', value: VALUE.personal }]);
    await store.mutate('personal', other, [{ op: 'set', name: 'ONLY_PERSONAL', value: VALUE.other }], other);
    const open = vi.spyOn(storeMod.SecretsStore.prototype as never, 'open' as never);
    starts.length = 0; copies.length = 0; containers.length = 0;
    const res = await threadsApp.request('http://local/api/v1/threads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 't', prompt: 'hello', projectId: p, environmentVariables: [{ name: 'SAME', value: VALUE.thread }] }) });
    expect(res.status).toBe(201);
    const thread = await res.json() as { id: string };
    await ended(thread.id);
    expect(open).toHaveBeenCalled();
    const env = starts[0]!.env;
    expect(env).toMatchObject({ SAME: VALUE.thread, ONLY_SHARED: VALUE.project, ONLY_PERSONAL: VALUE.personal });
    expect(JSON.stringify(containers)).not.toContain(VALUE.project);
    const file = untar(copies.find((x) => untar(x.tar).name === 'flotilla/secrets.env')!.tar);
    expect(copies.find((x) => untar(x.tar).name === 'flotilla/secrets.env')!.dir).toBe('/run');
    expect(file).toMatchObject({ mode: '0000600', uid: 1000 });
    expect(file.body).toContain(`export SAME='${VALUE.thread}'`);
    expect(file.body).not.toContain(VALUE.other);
    open.mockClear();
    await call(`/api/v1/projects/${p}/environment-variables`); await call(`/api/v1/threads/${thread.id}/environment-variables`); await call(`/api/v1/threads/${thread.id}/export`);
    expect(open).not.toHaveBeenCalled();
    await store.mutate('thread', thread.id, [{ op: 'delete', name: 'SAME' }], owner);
    expect((await store.prepare(thread.id)).env.SAME).toBe(VALUE.personal);
    await call('/api/v1/me/environment-variables', { method: 'DELETE', json: { names: ['SAME'] } });
    expect((await store.prepare(thread.id)).env.SAME).toBe(VALUE.project);
    await call('/api/v1/me/environment-variables?names=ONLY_PERSONAL', { method: 'DELETE' });
    open.mockRestore();
  }, 20_000);

  it('CAPY-384/382: the model and the API see names and configured-state only; native export carries no values', async () => {
    const p = await project('names');
    await put(`/api/v1/projects/${p}/environment-variables`, [{ name: 'SHARED_KEY', value: VALUE.project }]);
    starts.length = 0;
    const res = await threadsApp.request('http://local/api/v1/threads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'n', prompt: `echo ${VALUE.thread}`, projectId: p, environmentVariables: [{ name: 'THREAD_KEY', value: VALUE.thread }] }) });
    const thread = await res.json() as { id: string };
    expect(JSON.stringify(thread)).not.toContain(VALUE.thread);
    await ended(thread.id);
    expect(starts[0]!.prompt).not.toContain(VALUE.project);
    const grants = await (await call(`/api/v1/threads/${thread.id}/environment-variables`)).json() as { items: Record<string, unknown>[] };
    expect(grants.items).toEqual([{ threadId: thread.id, name: 'SHARED_KEY', scope: 'project', configured: true }, { threadId: thread.id, name: 'THREAD_KEY', scope: 'thread', configured: true }]);
    const events = JSON.stringify((await pool.query('SELECT payload FROM events WHERE thread_id=$1', [thread.id])).rows);
    expect(events).not.toContain(VALUE.thread);
    expect(events).not.toContain(VALUE.project);
    const exported = await call(`/api/v1/threads/${thread.id}/export`);
    expect(exported.status).toBe(200);
    const doc = await exported.json() as Record<string, any>;
    expect(doc).toMatchObject({ format: 'flotilla.thread-export/v1', thread: { id: thread.id } });
    expect(doc.events.length).toBeGreaterThan(2);
    expect(doc.runs.length).toBe(1);
    expect(doc.environmentVariables.map((g: { name: string }) => g.name)).toEqual(['SHARED_KEY', 'THREAD_KEY']);
    expect(JSON.stringify(doc)).not.toContain(VALUE.thread);
    expect(JSON.stringify(doc)).not.toContain(VALUE.project);
    const foreign = await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_foreign','FLO-ZZZZ','thread',$1,'x','idle','{}','{}','{}') RETURNING id`, [other]);
    expect((await call(`/api/v1/threads/${foreign.rows[0].id}/export`)).status).toBe(404);
    expect((await call(`/api/v1/threads/${foreign.rows[0].id}/environment-variables`)).status).toBe(404);
  }, 20_000);

  it('CAPY-387: GitHub tokens are refused by the vault and never reach a machine', async () => {
    const p = await project('gh');
    const fakeGh = `ghp_${'x'.repeat(36)}`;
    expect((await put(`/api/v1/projects/${p}/environment-variables`, [{ name: 'GITHUB_TOKEN', value: 'anything-123' }])).status).toBe(400);
    expect((await put(`/api/v1/projects/${p}/environment-variables`, [{ name: 'DEPLOY', value: fakeGh }])).status).toBe(400);
    expect((await put('/api/v1/me/environment-variables', [{ name: 'GH_TOKEN', value: 'anything-123' }])).status).toBe(400);
    expect((await put('/api/v1/me/environment-variables', [{ name: 'FLOTILLA_MCP_TOKEN', value: 'anything-123' }])).status).toBe(400);
    await pool.query(`INSERT INTO secrets (id,scope,scope_id,name,sealed,key_id) VALUES ('sec_legacy','project',$1,'GH_TOKEN',$2,'local:x')`, [p, localKms(Buffer.from(process.env.FLOTILLA_MASTER_KEY!)).seal(Buffer.from(fakeGh), `project:${p}:GH_TOKEN`)]);
    const prevToken = process.env.GITHUB_TOKEN; process.env.GITHUB_TOKEN = fakeGh;
    starts.length = 0; copies.length = 0; containers.length = 0;
    try {
      const res = await threadsApp.request('http://local/api/v1/threads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'g', prompt: 'hello', projectId: p, environmentVariables: [{ name: 'GITHUB_TOKEN', value: fakeGh }] }) });
      expect(res.status).toBe(400);
      const ok = await threadsApp.request('http://local/api/v1/threads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'g', prompt: 'hello', projectId: p }) });
      await ended(((await ok.json()) as { id: string }).id);
    } finally { if (prevToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = prevToken; }
    expect(JSON.stringify(containers)).not.toContain(fakeGh);
    expect(JSON.stringify(starts.map((s) => s.env))).not.toContain(fakeGh);
    expect(copies.map((x) => x.tar.toString()).join('')).not.toContain(fakeGh);
  }, 20_000);

  it('CAPY-389: per-thread env vars are accepted write-only on thread create and validated before the thread exists', async () => {
    const before = (await pool.query('SELECT count(*)::int n FROM threads')).rows[0].n;
    const bad = await threadsApp.request('http://local/api/v1/threads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'b', prompt: 'hello', environmentVariables: [{ name: 'OK', value: 7 }] }) });
    expect(bad.status).toBe(400);
    expect((await pool.query('SELECT count(*)::int n FROM threads')).rows[0].n).toBe(before);
    const res = await threadsApp.request('http://local/api/v1/threads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'w', prompt: 'hello', environmentVariables: [{ name: 'RUN_ONLY', value: VALUE.thread }] }) });
    expect(res.status).toBe(201);
    const thread = await res.json() as { id: string };
    await ended(thread.id);
    const refs = await store.list('thread', thread.id);
    expect(refs).toMatchObject([{ name: 'RUN_ONLY', scope: 'thread', configured: true, updatedBy: owner }]);
    expect(JSON.stringify(refs)).not.toContain(VALUE.thread);
  }, 20_000);
  it('rejects malformed env bodies instead of reporting success', async () => {
    const path = `/api/v1/projects/${await project('malformed')}/environment-variables`;
    expect((await call(path, { method: 'PUT', json: {} })).status).toBe(400);
    expect((await call(path, { method: 'PUT', body: 'not json', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await call(path, { method: 'PUT', json: null })).status).toBe(400);
    expect((await call(path, { method: 'DELETE', json: null })).status).toBe(400);
  });
  it('vault failures fail closed: a failed thread-env write leaves no thread; an unreadable vault fails the thread without a run or retry loop', async () => {
    const down = async () => { throw new Error('kms unavailable'); };
    const r = new ThreadRunner({ store: new EventStore(process.env.DATABASE_URL!), driver: driver as never, adapters: new Map([['fake', spyAdapter]]), vault: { mutate: down, prepare: down } });
    const count = async () => (await pool.query('SELECT count(*)::int n FROM threads')).rows[0].n;
    const before = await count();
    await expect(r.createThread({ ownerId: owner, title: 'x', prompt: 'hello', env: [{ op: 'set', name: 'A', value: 'b' }] })).rejects.toThrow('kms unavailable');
    expect(await count()).toBe(before);
    const t = (await r.createThread({ ownerId: owner, title: 'y', prompt: 'hello' })) as { id: string };
    const status = async () => (await pool.query('SELECT status FROM threads WHERE id=$1', [t.id])).rows[0].status;
    for (let i = 0; i < 50 && (await status()) !== 'failed'; i++) await new Promise((res) => setTimeout(res, 100));
    await new Promise((res) => setTimeout(res, 300));
    expect(await status()).toBe('failed');
    expect((await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [t.id])).rows[0].n).toBe(0);
    expect(r.queued.get(t.id) ?? []).toEqual([]);
  }, 20_000);
  it('CAPY-385: a failed secrets-file copy fails machine preparation before the agent starts', async () => {
    const failing = { ...driver, copyIn: async () => { throw new Error('putArchive failed'); }, stop: async () => undefined };
    const r = new ThreadRunner({ store: new EventStore(process.env.DATABASE_URL!), driver: failing as never, adapters: new Map([['fake', spyAdapter]]), vault: { mutate: store.mutate.bind(store), prepare: async () => ({ env: { A: VALUE.thread }, grants: [] }) } });
    starts.length = 0;
    const t = (await r.createThread({ ownerId: owner, title: 'c', prompt: 'hello', maxUsd: 5 })) as { id: string };
    const status = async () => (await pool.query('SELECT status FROM threads WHERE id=$1', [t.id])).rows[0].status;
    for (let i = 0; i < 50 && (await status()) !== 'failed'; i++) await new Promise((res) => setTimeout(res, 100));
    await new Promise((res) => setTimeout(res, 300));
    expect(await status()).toBe('failed');
    expect(starts).toHaveLength(0);
    expect((await pool.query('SELECT state FROM runs WHERE thread_id=$1', [t.id])).rows).toEqual([{ state: 'failed' }]);
    expect((await pool.query('SELECT count(*)::int n FROM budget_holds WHERE scope_id=$1', [t.id])).rows[0].n).toBe(0);
    expect(r.queued.get(t.id) ?? []).toEqual([]);
  }, 20_000);
});
