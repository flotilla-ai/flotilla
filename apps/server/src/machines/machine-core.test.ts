import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner, onPlacement } from '../runner/runner.js';
import { KERNEL_LIMITS, MACHINE_SIZES, MachineCore, machineCapFromEnv, machineCharge, nextStep, nodeVersionFrom } from './machine-core.js';

const exec = promisify(execFile);
const HOUR = 3_600_000; const MIN = 60_000; const DAY = 24 * HOUR;
let container = ''; let pool: pg.Pool; let url = ''; let app: Hono; let cookie = ''; let csrf = ''; let owner = '';
let clock = Date.parse('2026-11-27T00:00:00Z');
const repoDir = realpathSync(mkdtempSync(join(tmpdir(), 'flt-mc-')));
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function* () { let rest = ''; for await (const c of stream) { rest += c.toString(); const p = rest.split('\n'); rest = p.pop()!; for (const x of p) yield x; } if (rest) yield rest; })(); }
const spawned: string[] = [];
const local: ProcessTransport = { spawn(argv, opts) { spawned.push(argv.join(' ')); const child = spawn(argv[0], argv.slice(1), { cwd: repoDir, env: { PATH: process.env.PATH!, ...opts.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); return { stdout: lines(child.stdout!), stderr: lines(child.stderr!), exit: new Promise((r) => child.once('exit', (code, signal) => r({ code, signal }))), signal: async (sig) => { try { if (child.pid) process.kill(-child.pid, sig); } catch { /* exited */ } } } satisfies ProcessHandle; } };
const calls: string[] = []; let failNextStart = false; let n = 0; let recoverId: string | null = null;
const driver = {
  async startThreadContainer(i: Record<string, unknown>) { calls.push(`start ${i.memMb} ${i.cpus}`); if (failNextStart) { failNextStart = false; throw new Error('resume failed'); } return { containerId: `c${++n}` }; },
  transport: () => local, copyIn: async () => undefined, copyOut: async () => Buffer.from(''),
  async stop(id: string) { calls.push(`stop ${id}`); }, async remove(id: string) { calls.push(`remove ${id}`); },
  async isRunning(id: string) { return !calls.includes(`stop ${id}`) && !calls.includes(`remove ${id}`); },
  async deleteWorkspace(t: string) { calls.push(`delete-workspace ${t}`); },
  async findContainer() { return recoverId; }
};
const pushed: string[] = [];
let core: MachineCore; let runner: ThreadRunner;
const lease = async (t: string) => (await pool.query('SELECT * FROM machine_leases WHERE thread_id=$1', [t])).rows[0];
async function waitFor(fn: () => Promise<boolean>) { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error('timed out'); }
async function call(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? undefined : JSON.stringify(init.json) });
}
async function project(name: string): Promise<string> { await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ($1,$2,$1,$3,'untrusted','{}')`, [`prj_${name}`, owner, JSON.stringify({ fullName: 'example.invalid/o/r', baseBranch: 'main' })]); return `prj_${name}`; }
async function thread(projectId: string | null, ownerId = owner): Promise<string> {
  const id = `thr_${Math.random().toString(16).slice(2, 10)}`;
  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent,branch) VALUES ($1,$1,$2,'thread',$3,'t','idle','{"adapter":"fake"}','{"maxUsd":null,"maxTokens":null,"maxWallSec":null,"warnAt":0.8}','{"usd":0,"inputTokens":0,"outputTokens":0,"cacheTokens":0,"machineSec":0}','flotilla/x')`, [id, projectId, ownerId]);
  return id;
}

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const p = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  url = `postgres://postgres@127.0.0.1:${p}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); process.env.DATABASE_URL = url; pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js'); const auth = authStore(url);
  owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const s = (await auth.login('owner@x', 'pw'))!; cookie = `flotilla_session=${s.id}`; csrf = s.csrfToken;
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_svc','svc@x','service')`);
  core = new MachineCore(url, { cap: { ...machineCapFromEnv({}), ramMb: 16384 }, now: () => clock, secondMs: 1 });
  runner = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters: new Map([['fake', fakeAdapter]]), machines: core });
  core.attach({ driver: driver as never, emit: async () => undefined, beforeDelete: async (t) => { pushed.push(t); } });
  const { createMachineCoreRoute } = await import('../routes/machine-core.route.js');
  const { Hono } = await import('hono');
  const { apiError, ApiFailure } = await import('../api-platform/types.js');
  app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : c.json({ error: String(err) }, 500)); app.use(async (c, next) => { c.set('userId' as never, owner as never); await next(); });
  app.route('/api/v1', createMachineCoreRoute(() => core, () => runner).app);
}, 60_000);
afterAll(async () => { await runner?.drain(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('machine core', () => {
  it('CAPY-201: sizes Small→Big Guy are plan-gated and size sets $/h that the cap accounts for', async () => {
    expect(Object.keys(MACHINE_SIZES)).toEqual(['small', 'medium', 'large', 'big-guy']);
    expect(machineCharge('big-guy', 3600).usd).toBe(MACHINE_SIZES['big-guy'].microUsdPerHour);
    expect(machineCharge('big-guy', 3600).usd).toBeGreaterThan(machineCharge('small', 3600).usd);
    const p = await project('gate');
    const r = await call(`/projects/${p}/machine`, { method: 'PUT', json: { size: 'big-guy' } });
    expect(r.status).toBe(402);
    expect((await (await call('/machines/limits')).json() as any).sizes.map((s: any) => [s.size, s.allowed])).toEqual([['small', true], ['medium', true], ['large', true], ['big-guy', false]]);
  });
  it('CAPY-202: the project Machine setting picks the size and the agent can change it', async () => {
    const p = await project('size'); const t = await thread(p);
    expect((await (await call(`/projects/${p}/machine`, { method: 'PUT', json: { size: 'medium' } })).json() as any).size).toBe('medium');
    const agent = await call(`/threads/${t}/machine/tools/machine.set_size`, { method: 'POST', json: { size: 'large' } });
    expect((await agent.json() as any).size).toBe('large');
    expect((await (await call(`/projects/${p}/machine`)).json() as any).size).toBe('large');
    calls.length = 0; await core.boot(t, p, (mem, cpus) => driver.startThreadContainer({ memMb: mem, cpus }), driver as never);
    expect(calls).toEqual([`start ${MACHINE_SIZES.large.memMb} ${MACHINE_SIZES.large.cpus}`]);
    await core.release(t);
  });
  it('CAPY-203/210/213: billed only while awake incl. 2-min wind-down; sleeps after it unless kept awake 4 h; keep-awake cancels', async () => {
    const t = await thread(null); clock += HOUR;
    await core.boot(t, null, () => driver.startThreadContainer({}), driver as never);
    clock += 5 * MIN; await core.release(t); clock += 90_000; await core.tick();
    expect((await lease(t)).state).toBe('awake');
    clock += 30_000; await core.tick();
    const l = await lease(t); expect(l.state).toBe('sleeping'); expect(l.container_id).toBeNull(); expect(calls.filter((c) => c.startsWith('remove')).length).toBeGreaterThan(0); expect(calls).not.toContain(`delete-workspace ${t}`);
    const spent = (await pool.query('SELECT spent FROM threads WHERE id=$1', [t])).rows[0].spent;
    expect(spent.machineSec).toBe(5 * 60 + 120); expect(spent.usd).toBe(machineCharge('small', 420).usd);
    clock += HOUR; await core.tick(); expect((await pool.query('SELECT spent FROM threads WHERE id=$1', [t])).rows[0].spent.machineSec).toBe(420);
    const kept = await (await call(`/threads/${t}/machine/keep-awake`, { method: 'PUT', json: {} })).json() as any;
    expect(kept.state).toBe('awake'); expect(Date.parse(kept.keepAwakeUntil)).toBe(clock + 4 * HOUR);
    clock += 3 * HOUR; await core.tick(); expect((await lease(t)).state).toBe('awake');
    expect((await call(`/threads/${t}/machine/keep-awake`, { method: 'DELETE' })).status).toBe(200);
    clock += 1000; await core.tick(); expect((await lease(t)).state).toBe('sleeping');
  });
  it('CAPY-204/205: concurrent RAM is a hard cap; a start waits 1 min then fails; service-user threads get at most half', async () => {
    const small = new MachineCore(url, { cap: { ...machineCapFromEnv({}), ramMb: MACHINE_SIZES.small.memMb * 2 }, now: () => clock, secondMs: 1 });
    small.attach({ driver: driver as never, emit: async () => undefined });
    await pool.query(`DELETE FROM machine_leases`);
    const s1 = await thread(null, 'usr_svc'); const s2 = await thread(null, 'usr_svc'); const u1 = await thread(null); const u2 = await thread(null);
    await small.boot(s1, null, () => driver.startThreadContainer({}), driver as never);
    const started = Date.now();
    await expect(small.boot(s2, null, () => driver.startThreadContainer({}), driver as never)).rejects.toThrow("Cloud machine couldn't start");
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
    await small.boot(u1, null, () => driver.startThreadContainer({}), driver as never);
    await expect(small.boot(u2, null, () => driver.startThreadContainer({}), driver as never)).rejects.toThrow('concurrent RAM');
    expect((await lease(u2))?.state ?? 'none').not.toBe('starting');
    await small.release(s1); clock += 3 * MIN; await small.tick();
    await small.boot(u2, null, () => driver.startThreadContainer({}), driver as never);
    for (const t of [u1, u2]) await small.release(t);
    clock += 3 * MIN; await small.tick();
  });
  it('CAPY-209: kernel limits are documented and match the pool container config', async () => {
    const limits = (await (await call('/machines/limits')).json() as any).kernel;
    expect(limits).toEqual(KERNEL_LIMITS);
    expect(KERNEL_LIMITS.kvm).toBe(false); expect(KERNEL_LIMITS.kernelModules).toBe(false);
    expect(KERNEL_LIMITS.netfilter.join(' ')).toMatch(/iptables/);
  });
  it('CAPY-207: .nvmrc / .node-version pick the Node version', () => {
    expect(nodeVersionFrom({ '.nvmrc': 'v20.11.1\n' })).toBe('20.11.1');
    expect(nodeVersionFrom({ '.node-version': '18' })).toBe('18');
    expect(nodeVersionFrom({ '.nvmrc': 'lts/*', '.node-version': '22' })).toBe('22');
    expect(nodeVersionFrom({})).toBeNull();
  });
  it('CAPY-210/211: the agent wakes a sleeping machine on a new message; the Wake button does too; startup entries rerun, disk is kept', async () => {
    const p = await project('wake'); const t = await thread(p);
    const port = 20000 + Math.floor(Math.random() * 20000);
    await pool.query(`INSERT INTO environment_versions (project_id,version,spec,source) VALUES ($1,1,$2,'user')`, [p, JSON.stringify({ startup: [{ name: 'web', command: `exec node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port})"`, readinessPort: port }] })]);
    const ready = async () => (await pool.query(`SELECT state FROM environment_processes WHERE thread_id=$1 AND name='web'`, [t])).rows[0]?.state;
    expect((await (await call(`/threads/${t}/machine/wake`, { method: 'POST' })).json() as any).state).toBe('awake');
    expect(await ready()).toBe('ready');
    clock += 3 * MIN; await core.tick(); expect((await lease(t)).state).toBe('sleeping'); expect(await ready()).toBe('stopped');
    const before = calls.filter((c) => c.startsWith('start')).length;
    await runner.message(t, 'hi', 'queue', owner);
    await waitFor(async () => (await pool.query(`SELECT 1 FROM runs WHERE thread_id=$1 AND state='completed'`, [t])).rows.length > 0);
    expect(calls.filter((c) => c.startsWith('start')).length).toBe(before + 1);
    await waitFor(async () => (await ready()) === 'ready');
    expect((await lease(t))).toMatchObject({ state: 'awake', holds: 0 });
    expect(calls).not.toContain(`delete-workspace ${t}`);
    await call(`/threads/${t}/machine/keep-awake`, { method: 'DELETE' }); clock += 3 * MIN; await core.tick();
  }, 30_000);
  it('review: a stale sweep cannot sleep a re-held machine; competing wakes share one start; an egress change restarts an idle machine', async () => {
    const t = await thread(null); const boot = (policy = '') => core.boot(t, null, () => driver.startThreadContainer({}), driver as never, undefined, policy);
    await boot(); await core.release(t); clock += 3 * MIN;
    const stale = await lease(t); const held = await boot();
    expect(await (core as any).sleep(stale, clock)).toBe(false);
    expect(await lease(t)).toMatchObject({ state: 'awake', container_id: held.containerId, holds: 1 }); expect(calls).not.toContain(`remove ${held.containerId}`);
    await core.release(t); clock += 3 * MIN; await core.tick(); expect((await lease(t)).state).toBe('sleeping');
    calls.length = 0; const [a, b] = await Promise.all([boot(), boot()]);
    expect(a.containerId).toBe(b.containerId); expect(calls.filter((c) => c.startsWith('start')).length).toBe(1); expect((await lease(t)).holds).toBe(2);
    await core.release(t); await core.release(t); calls.length = 0;
    expect((await boot('["example.org"]')).containerId).not.toBe(a.containerId); expect(calls).toContain(`remove ${a.containerId}`);
    await core.release(t); clock += 3 * MIN; await core.tick();
  });
  it('review: promotion to Captain preserves pool-machine wake and keep-awake behavior', async () => {
    const t = await thread(null);
    await core.boot(t, null, () => driver.startThreadContainer({}), driver as never); await core.release(t);
    await pool.query(`UPDATE threads SET role='captain' WHERE id=$1`, [t]);
    await runner.wakeMachine(t);
    expect((await lease(t))).toMatchObject({ state: 'awake' });
    const state = await core.keepAwake(t, true);
    expect(state.keepAwakeUntil).toBeTruthy();
  });

  it('review: restart recovery keeps a live starting machine reserved; wake refuses shared subagent placement', async () => {
    const t = await thread(null);
    await core.boot(t, null, () => driver.startThreadContainer({}), driver as never); await core.release(t);
    recoverId = 'c-recovered';
    await pool.query(`UPDATE machine_leases SET state='starting',container_id=NULL,holds=1,idle_since=NULL WHERE thread_id=$1`, [t]);
    await core.reset();
    expect((await lease(t))).toMatchObject({ state: 'awake', container_id: 'c-recovered', holds: 0 });
    await pool.query('DELETE FROM machine_leases WHERE thread_id=$1', [t]); recoverId = null;

    const shared = await thread(null);
    const off = onPlacement(async (row) => row.id === shared ? { workspaceFrom: 'thr_parent' } : null);
    await expect(runner.wakeMachine(shared)).rejects.toThrow('no pool machine');
    off();
  });
  it('review: machine charges made during boot survive adapter usage writes', async () => {
    const t = await thread(null); clock += HOUR;
    await core.boot(t, null, () => driver.startThreadContainer({}), driver as never, undefined, 'old-policy');
    await core.release(t); clock += 5 * MIN;
    await runner.message(t, 'charge race', 'queue', owner);
    await waitFor(async () => (await pool.query(`SELECT 1 FROM runs WHERE thread_id=$1 AND state='completed'`, [t])).rows.length > 0);
    const spent = (await pool.query('SELECT spent FROM threads WHERE id=$1', [t])).rows[0].spent;
    expect(spent.machineSec).toBe(300); expect(spent.usd).toBeGreaterThanOrEqual(machineCharge('small', 300).usd);
    clock += 3 * MIN; await core.tick();
  }, 20_000);
  it('CAPY-212: warns a day ahead, runs the pre-delete (WIP) hook, deletes after 14 sleeping days, rebuilds from the environment; failed resume rebuilds', async () => {
    const t = await thread(null);
    await core.boot(t, null, () => driver.startThreadContainer({}), driver as never); await core.release(t);
    clock += 3 * MIN; await core.tick(); expect((await lease(t)).state).toBe('sleeping');
    expect(nextStep({ state: 'sleeping', busy: false, idleSince: null, keepAwakeUntil: null, sleptAt: clock, warnedAt: null }, core.cap, clock + 13 * DAY, false)).toBe('warn');
    clock += 13 * DAY; await core.tick(); expect((await lease(t)).warned_at).not.toBeNull(); expect(pushed).not.toContain(t);
    clock += DAY; await core.tick();
    expect((await lease(t)).state).toBe('deleted'); expect(pushed).toContain(t); expect(calls).toContain(`delete-workspace ${t}`);
    const rebuilt = await core.boot(t, null, () => driver.startThreadContainer({}), driver as never);
    expect(rebuilt).toMatchObject({ fresh: true, woke: true }); await core.release(t);
    clock += 3 * MIN; await core.tick();
    failNextStart = true; calls.length = 0;
    await expect(core.boot(t, null, () => driver.startThreadContainer({}), driver as never)).rejects.toThrow('resume failed');
    expect(calls).toEqual(['start undefined undefined']);
    expect((await lease(t)).state).toBe('sleeping');
    expect(await core.boot(t, null, () => driver.startThreadContainer({}), driver as never)).toMatchObject({ fresh: false, woke: true });
    await core.release(t);
  });
});
