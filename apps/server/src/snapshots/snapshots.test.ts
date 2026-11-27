import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import Docker from 'dockerode';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { checkDiskBudget, failurePrompt, parseSnapshotSpec, rebuildDue, tiersToCapture } from './types.js';

const exec = promisify(execFile);
const docker = new Docker();
const SECRET = 'flt-test-secret-9f8e7d6c5b';
const BASE = 'postgres:16';
let db = ''; let pool: pg.Pool; let app: Hono; let cookie = ''; let csrf = ''; let owner = ''; const other = 'usr_snap_other';
let store: import('./store.js').SnapshotStore;
const cleanup: string[][] = [];
const sh = async (args: string[]) => (await exec('docker', args)).stdout.trim();
function lines(s: NodeJS.ReadableStream): AsyncIterable<string> { return (async function* () { let rest = ''; for await (const c of s) { rest += c.toString(); const p = rest.split('\n'); rest = p.pop()!; yield* p; } if (rest) yield rest; })(); }
const cli = (id: string): ProcessTransport => ({ spawn(argv, opts) {
  const c = spawn('docker', ['exec', '-w', opts.cwd, ...Object.entries(opts.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), id, ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });
  return { stdout: lines(c.stdout!), stderr: lines(c.stderr!), exit: new Promise((r) => c.once('exit', (code, signal) => r({ code, signal }))), signal: async () => { c.kill(); } };
} });
async function call(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
const json = async (r: Response) => (await r.json()) as any;
async function project(name: string, ownerId = owner): Promise<string> {
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ($1,$2,$1,$3,'untrusted','{}')`, [`prj_${name}`, ownerId, JSON.stringify({ fullName: 'o/r', baseBranch: 'main' })]);
  return `prj_${name}`;
}
/** A post-run thread machine: workspace volume with the repo, a secrets file, shell history and the run token in its env. */
async function machine(projectId: string, files: Record<string, string> = {}): Promise<{ threadId: string; containerId: string }> {
  const threadId = `thr_${Math.random().toString(16).slice(2, 10)}`;
  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$1,$2,'thread',$3,'t','idle','{}','{}','{}')`, [threadId, projectId, owner]);
  const volume = `flt-workspace-${threadId}`;
  const containerId = await sh(['run', '-d', '--label', 'flotilla.snapshot-test=1', '-e', `FLOTILLA_MCP_TOKEN=${SECRET}-run`, '-v', `${volume}:/workspace`, BASE, 'sleep', 'infinity']);
  cleanup.push(['rm', '-f', containerId], ['volume', 'rm', '-f', volume]);
  const all = { 'workspace/repo/app.txt': 'hello snapshot', 'run/flotilla/secrets.env': `export API_TOKEN='${SECRET}'\n`, 'root/.bash_history': `curl -H ${SECRET}`, ...files };
  for (const [path, body] of Object.entries(all)) await sh(['exec', containerId, 'sh', '-c', `mkdir -p "$(dirname /${path})" && printf %s "$1" > /${path}`, '_', body]);
  return { threadId, containerId };
}
const env = (setup: string) => ({ setup: { initialize: { script: setup, timeoutSec: 60 }, refresh: { script: '', timeoutSec: 60 } } });
async function afterRun(projectId: string, m: { threadId: string; containerId: string }, opts: Parameters<import('./store.js').SnapshotStore['afterRun']>[1] = {}) {
  const [p] = (await pool.query('SELECT * FROM projects WHERE id=$1', [projectId])).rows;
  return store.afterRun({ thread: { id: m.threadId, project_id: projectId }, project: p, containerId: m.containerId, driver: { docker, transport: cli } }, opts);
}
const images = async (ref: string) => sh(['images', '-q', ref]);

beforeAll(async () => {
  db = await sh(['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', BASE]);
  const port = (await sh(['port', db, '5432/tcp'])).split(':').pop();
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
  await pool.query(`INSERT INTO users (id,email,role) VALUES ($1,'snapother@x','member')`, [other]);
  store = (await import('./store.js')).snapshotStore(url);
  app = await (await import('../loader.js')).createApp();
}, 120_000);
afterAll(async () => {
  for (const ref of (await sh(['images', '--format', '{{.Repository}}:{{.Tag}}', 'flotilla-snapshot/*']).catch(() => '')).split('\n').filter(Boolean)) await sh(['rmi', '-f', ref]).catch(() => '');
  for (const args of cleanup) await sh(args).catch(() => '');
  await pool?.end(); if (db) spawn('sh', ['-c', `sleep 5; docker rm -f ${db}`], { detached: true, stdio: 'ignore' }).unref();
}, 60_000);

describe('snapshots', () => {
  it('CAPY-192: after a run the post-setup filesystem (workspace volume + home) is baked into an image that boots; hourly rebuild check', async () => {
    const p = await project('bake');
    expect((await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: env('mkdir -p node_modules && echo dep > node_modules/dep.txt && echo built') } })).status).toBe(200);
    expect((await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: { tier: 64 } } })).status).toBe(200);
    const build = (await afterRun(p, await machine(p)))!;
    expect(build).toMatchObject({ state: 'succeeded', environmentVersion: 1, failedStep: null, images: [{ tier: 64 }] });
    expect(build.steps.map((s) => [s.step, s.state])).toEqual([['setup', 'passed'], ['repos', 'passed'], ['scrub', 'passed'], ['verify', 'passed'], ['capture', 'passed']]);
    const ref = build.images[0].ref;
    expect(await sh(['run', '--rm', ref, 'sh', '-c', 'cat /workspace/repo/app.txt; echo; cat /workspace/repo/node_modules/dep.txt'])).toBe('hello snapshot\ndep');
    expect((await json(await call(`/projects/${p}/snapshot`))).boot).toEqual({ image: ref, buildId: build.id, repair: null });
    // hourly check: no rebuild within the hour, a new environment version is picked up after it, a requested rebuild skips the wait
    expect(await afterRun(p, await machine(p))).toBeNull();
    await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: env('echo v2') } });
    expect(await afterRun(p, await machine(p), { now: new Date(Date.now() + 30 * 60_000) })).toBeNull();
    expect(await afterRun(p, await machine(p), { now: new Date(Date.now() + 61 * 60_000) })).toMatchObject({ state: 'succeeded', environmentVersion: 2 });
    expect((await call(`/projects/${p}/snapshot/rebuild`, { method: 'POST' })).status).toBe(202);
    expect(await afterRun(p, await machine(p), { now: new Date(Date.now() + 62 * 60_000) })).toMatchObject({ state: 'succeeded' });
    const spec = { enabled: true, repos: [], tier: 64 as const, alsoSmaller: false }; const t0 = new Date(0);
    expect(rebuildDue({ spec, requested: false, lastCheckAt: null, lastGoodEnvironmentVersion: null, environmentVersion: 0, now: t0 })).toBe(true);
    expect(rebuildDue({ spec, requested: false, lastCheckAt: t0, lastGoodEnvironmentVersion: 1, environmentVersion: 2, now: new Date(59 * 60_000) })).toBe(false);
    expect(rebuildDue({ spec, requested: false, lastCheckAt: t0, lastGoodEnvironmentVersion: 2, environmentVersion: 2, now: new Date(61 * 60_000) })).toBe(false);
    expect(rebuildDue({ spec: { ...spec, enabled: false }, requested: true, lastCheckAt: null, lastGoodEnvironmentVersion: null, environmentVersion: 1, now: t0 })).toBe(false);
  }, 180_000);

  it('CAPY-193: choose which project repos go in the snapshot; disk-budget validation refuses an image over the tier', async () => {
    expect(() => parseSnapshotSpec({ repos: ['o/other'] }, ['o/r'])).toThrow(/not in this project/);
    expect(parseSnapshotSpec({}, ['o/r'])).toEqual({ enabled: true, repos: ['o/r'], tier: 64, alsoSmaller: false });
    const p = await project('repos');
    expect((await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: { repos: ['evil/x'] } } })).status).toBe(400);
    expect((await call(`/projects/${await project('foreign', other)}/snapshot`)).status).toBe(404);
    expect((await json(await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: { repos: [] } } }))).spec.repos).toEqual([]);
    const without = (await afterRun(p, await machine(p)))!;
    expect(without.state).toBe('succeeded');
    expect(await sh(['run', '--rm', without.images[0].ref, 'sh', '-c', 'test -e /workspace/repo && echo present || echo absent'])).toBe('absent');
    expect(checkDiskBudget(70, 64)).toMatch(/needs 70.00 GB but the 64 GB tier/);
    await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: { repos: ['o/r'] } } });
    await call(`/projects/${p}/snapshot/rebuild`, { method: 'POST' });
    const over = (await afterRun(p, await machine(p), { capacityGb: { 64: 0.001, 128: 0.002, 256: 0.003 } }))!;
    expect(over).toMatchObject({ state: 'failed', failedStep: 'repos', images: [] });
    expect(over.steps.find((s) => s.step === 'repos')!.output).toMatch(/but the 64 GB tier holds 0.001 GB/);
  }, 180_000);

  it('CAPY-194: disk tiers are 64/128/256 GB; "also snapshot smaller sizes" captures every smaller tier that fits', async () => {
    expect(() => parseSnapshotSpec({ tier: 100 }, [])).toThrow(/64, 128, 256/);
    const spec = parseSnapshotSpec({ tier: 256, alsoSmaller: true }, []);
    expect(tiersToCapture(spec, 10)).toEqual([256, 128, 64]);
    expect(tiersToCapture(spec, 100)).toEqual([256, 128]);
    expect(tiersToCapture({ ...spec, alsoSmaller: false }, 10)).toEqual([256]);
    const p = await project('tiers');
    await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: { tier: 256, alsoSmaller: true } } });
    const b = (await afterRun(p, await machine(p)))!;
    expect(b.images.map((i) => i.tier)).toEqual([256, 128, 64]);
    for (const i of b.images) expect(await images(i.ref)).not.toBe('');
  }, 180_000);

  it('CAPY-195: secrets are scrubbed (secrets file, history, env) and the filesystem is verified before capture; a leak stops capture', async () => {
    const p = await project('scrub');
    await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: {} } });
    const ok = (await afterRun(p, await machine(p)))!;
    expect(ok.state).toBe('succeeded');
    const ref = ok.images[0].ref;
    expect(await sh(['run', '--rm', ref, 'sh', '-c', 'ls -A /run/flotilla; test -e /root/.bash_history && echo history; echo "token=$FLOTILLA_MCP_TOKEN"'])).toBe('token=');
    expect(await sh(['image', 'inspect', ref, '--format', '{{json .Config.Env}}'])).not.toContain(SECRET);
    await call(`/projects/${p}/snapshot/rebuild`, { method: 'POST' });
    const leak = (await afterRun(p, await machine(p, { 'workspace/repo/.env.local': `TOKEN=${SECRET}` })))!;
    expect(leak).toMatchObject({ state: 'failed', failedStep: 'verify', images: [] });
    const verify = leak.steps.find((s) => s.step === 'verify')!.output;
    expect(verify).toContain('/workspace/repo/.env.local');
    expect(JSON.stringify(leak)).not.toContain(SECRET);
    expect(leak.steps.find((s) => s.step === 'capture')!.state).toBe('skipped');
    expect(await images(`flotilla-snapshot/prj_scrub:${leak.id.toLowerCase()}-64gb`)).toBe('');
  }, 180_000);

  it('CAPY-196: build history keeps per-step logs; "ask why it failed" gives the failed step log as a prompt', async () => {
    const p = await project('history');
    await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: env(`echo installing; echo "key ${SECRET}"; exit 3`) } });
    await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: {} } });
    const failed = (await afterRun(p, await machine(p)))!;
    const list = await json(await call(`/projects/${p}/snapshots/builds`));
    expect(list.items.map((b: any) => [b.id, b.state, b.failedStep])).toEqual([[failed.id, 'failed', 'setup']]);
    const detail = await json(await call(`/projects/${p}/snapshots/builds/${failed.id}`));
    expect(detail.steps[0]).toMatchObject({ step: 'setup', state: 'failed' });
    expect(detail.steps[0].output).toContain('installing');
    expect(detail.steps[0].output).toContain('[REDACTED:API_TOKEN]');
    expect(detail.ask).toContain(`failed at step "setup"`);
    expect(detail.ask).toContain('installing');
    expect(JSON.stringify(detail)).not.toContain(SECRET);
    expect(failurePrompt({ ...failed, steps: [] })).toBeNull();
    expect((await call(`/projects/${await project('foreign2', other)}/snapshots/builds`)).status).toBe(404);
    expect((await call(`/projects/${p}/snapshots/builds/snb_missing`)).status).toBe(404);
  }, 180_000);

  it('CAPY-197: a failing setup script never blocks boot: the last good image (or the base image) boots and the agent gets a repair prompt', async () => {
    const p = await project('repair');
    await call(`/projects/${p}/snapshot`, { method: 'PUT', json: { spec: {} } });
    expect((await json(await call(`/projects/${p}/snapshot`))).boot).toEqual({ image: 'flotilla-thread:dev', buildId: null, repair: null });
    const good = (await afterRun(p, await machine(p)))!;
    await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: env('echo broken >&2; exit 1') } });
    const bad = (await afterRun(p, await machine(p), { now: new Date(Date.now() + 61 * 60_000) }))!;
    expect(bad).toMatchObject({ state: 'failed', failedStep: 'setup' });
    expect(bad.steps.slice(1).every((s) => s.state === 'skipped')).toBe(true);
    const boot = (await json(await call(`/projects/${p}/snapshot`))).boot;
    expect(boot).toMatchObject({ image: good.images[0].ref, buildId: good.id, repair: { buildId: bad.id } });
    expect(boot.repair.prompt).toContain('environment.replace');
    expect(boot.repair.prompt).toContain('broken');
  }, 180_000);
});
