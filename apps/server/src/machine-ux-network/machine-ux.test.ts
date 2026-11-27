import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import { MachineCore, machineCapFromEnv, MACHINE_SIZES } from '../machines/machine-core.js';
import { DockerExecTransport } from '../machines/transport.js';
import { createMachineCoreRoute } from '../routes/machine-core.route.js';
import { ApiFailure, apiError } from '../api-platform/types.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let app: Hono; let owner = ''; let cookie = ''; let csrf = ''; let core: MachineCore; let runner: ThreadRunner;
const calls: string[] = []; let n = 0;
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function* () { let rest = ''; for await (const c of stream) { rest += c.toString(); const p = rest.split('\n'); rest = p.pop()!; for (const x of p) yield x; } if (rest) yield rest; })(); }
const local: ProcessTransport = { spawn(argv, opts) { const child = spawn(argv[0], argv.slice(1), { cwd: '/tmp', env: { PATH: process.env.PATH!, ...opts.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); return { stdout: lines(child.stdout!), stderr: lines(child.stderr!), exit: new Promise((r) => child.once('exit', (code, signal) => r({ code, signal }))), signal: async (sig) => { try { if (child.pid) process.kill(-child.pid, sig); } catch { /* exited */ } } } satisfies ProcessHandle; } };
const driver = {
  async startThreadContainer(i: Record<string, unknown>) { calls.push(`start ${i.threadId} ${i.memMb} ${i.cpus}`); return { containerId: `c${++n}` }; },
  transport: () => local,
  async stop(id: string) { calls.push(`stop ${id}`); }, async remove(id: string) { calls.push(`remove ${id}`); },
  async isRunning() { return true; },
  async listWorkspaceFiles(t: string) { calls.push(`files ${t}`); return [{ path: 'repo/package.json', size: 42 }]; },
  async readWorkspaceFile(t: string, path: string) { calls.push(`read ${t} ${path}`); return '{"name":"sleeping-workspace"}'; },
  async copyIn() { return undefined; }, async copyOut() { return Buffer.from(''); }
};
async function call(path: string, init: RequestInit & { json?: unknown } = {}) { const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf); if (init.json !== undefined) headers.set('content-type', 'application/json'); return app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? undefined : JSON.stringify(init.json) }); }
async function json(r: Response) { return r.json() as Promise<any>; }
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); process.env.DATABASE_URL = url; pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js'); const auth = authStore(url); owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const s = (await auth.login('owner@x', 'pw'))!; cookie = `flotilla_session=${s.id}`; csrf = s.csrfToken;
  core = new MachineCore(url, { cap: { ...machineCapFromEnv({}), ramMb: 16384 }, secondMs: 1 });
  runner = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters: new Map([['fake', fakeAdapter]]), machines: core });
  core.attach({ driver: driver as never, emit: async () => undefined });
  app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : c.json({ error: String(err) }, 500)); app.use(async (c, next) => { c.set('userId' as never, owner as never); await next(); });
  app.route('/api/v1', createMachineCoreRoute(() => core, () => runner).app);
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget,machine_size) VALUES ('prj_mux',$1,'mux','{"fullName":"example.invalid/o/r","baseBranch":"main"}','untrusted','{}','small')`, [owner]);
  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent,branch) VALUES ('thr_mux','FLO-MUX','prj_mux','thread',$1,'mux','idle','{"adapter":"fake"}','{"maxUsd":null,"maxTokens":null,"maxWallSec":null,"warnAt":0.8}','{"usd":0,"inputTokens":0,"outputTokens":0,"cacheTokens":0,"machineSec":0}','flotilla/x')`, [owner]);
}, 30_000);
afterAll(async () => { await runner?.drain(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

it('CAPY-214/215/477/478/479: network posture, web shell semantics, resize, sleeping files and durable background commands', async () => {
  expect((await json(await call('/threads/thr_mux/machine/network'))).mode).toBe('private');
  expect((await json(await call('/threads/thr_mux/machine/network', { method: 'PUT', json: { mode: 'public' } })))).toMatchObject({ mode: 'public', inbound: 'none-published' });
  expect((await call('/threads/thr_mux/machine/network', { method: 'PUT', json: { mode: 'bad' } })).status).toBe(400);
  const oldOidc = process.env.FLOTILLA_OIDC_ISSUER; delete process.env.FLOTILLA_OIDC_ISSUER;
  expect((await call('/threads/thr_mux/machine/network', { method: 'PUT', json: { mode: 'oidc' } })).status).toBe(409);
  process.env.FLOTILLA_OIDC_ISSUER = 'https://issuer.example';
  expect((await json(await call('/threads/thr_mux/machine/network', { method: 'PUT', json: { mode: 'oidc' } }))).mode).toBe('oidc');
  if (oldOidc === undefined) delete process.env.FLOTILLA_OIDC_ISSUER; else process.env.FLOTILLA_OIDC_ISSUER = oldOidc;

  calls.length = 0;
  expect((await json(await call('/threads/thr_mux/machine/wake', { method: 'POST' }))).state).toBe('awake');
  expect(calls[0]).toBe(`start thr_mux ${MACHINE_SIZES.small.memMb} ${MACHINE_SIZES.small.cpus}`);
  const resized = await json(await call('/threads/thr_mux/machine/resize', { method: 'POST', json: { size: 'medium' } }));
  expect(resized).toMatchObject({ state: 'awake', size: 'medium', memMb: MACHINE_SIZES.medium.memMb });
  expect(calls).toContain(`start thr_mux ${MACHINE_SIZES.medium.memMb} ${MACHINE_SIZES.medium.cpus}`);
  expect(calls.filter((x) => x.startsWith('start thr_mux')).length).toBe(2);
  expect(calls).not.toContain('delete-workspace thr_mux');

  await core.sleepNow('thr_mux');
  expect((await json(await call('/threads/thr_mux/machine'))).state).toBe('sleeping');
  calls.length = 0;
  expect((await json(await call('/threads/thr_mux/machine/files'))).items).toEqual([{ path: 'repo/package.json', size: 42 }]);
  expect((await json(await call('/threads/thr_mux/machine/files/read?path=repo/package.json'))).content).toContain('sleeping-workspace');
  expect(calls).toEqual(['files thr_mux', 'read thr_mux repo/package.json']);
  expect((await call('/threads/thr_mux/machine/files/read?path=../secret')).status).toBe(400);

  const quick = await json(await call('/threads/thr_mux/machine/shell', { method: 'POST', json: { command: 'printf quick-ok', timeoutMs: 1000 } }));
  expect(quick).toMatchObject({ state: 'exited', exitCode: 0, autoBackground: false }); expect(quick.output).toContain('quick-ok');
  const finishing = await json(await call('/threads/thr_mux/machine/shell', { method: 'POST', json: { command: `sleep 0.2; printf 'pre\\0post'`, timeoutMs: 20 } }));
  expect(finishing).toMatchObject({ state: 'running', autoBackground: true });
  await new Promise((r) => setTimeout(r, 500));
  expect((await json(await call('/threads/thr_mux/machine/background'))).items.find((x: any) => x.id === finishing.id)).toMatchObject({ state: 'exited', exitCode: 0, output: expect.stringContaining('pre\\0post') });

  const long = await json(await call('/threads/thr_mux/machine/shell', { method: 'POST', json: { command: 'sleep 17; printf done', timeoutMs: 20 } }));
  expect(long).toMatchObject({ state: 'running', autoBackground: true }); expect(long.pid).toBeGreaterThan(0);
  expect((await json(await call('/threads/thr_mux/machine/background'))).items.find((x: any) => x.id === long.id)).toMatchObject({ state: 'running' });
  expect((await json(await call(`/threads/thr_mux/machine/background/${long.id}/stop`, { method: 'POST' }))).state).toBe('stopped');
  await new Promise((r) => setTimeout(r, 100));
  expect((await exec('sh', ['-c', "ps -eo args | grep '^sleep 17$' || true"])).stdout.trim()).toBe('');
  const failingDocker = { getContainer: () => ({ exec: async () => { throw new Error('missing cwd'); } }) };
  const failingTransport = new DockerExecTransport(failingDocker as never, 'missing-container');
  await expect((async () => { for await (const line of failingTransport.spawn(['true'], { cwd: '/missing', env: {} }).stdout) void line; })()).rejects.toThrow('missing cwd');
  expect((await call('/threads/thr_mux/machine/desktop', { method: 'POST', json: {} })).status).toBe(409);
}, 30_000);
