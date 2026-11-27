import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { tarFile } from '../captain/tools/mcpConfig.js';
import { choosePhase, parseEnvironmentSpec, parseSetupFile } from './types.js';
import { EnvironmentExecutor, registerEnvironmentMachine } from './executor.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let app: Hono; let cookie = ''; let csrf = ''; let owner = ''; const other = 'usr_env_other';
let store: import('./store.js').EnvironmentStore;
const spawned: string[][] = [];
const repoDir = realpathSync(mkdtempSync(join(tmpdir(), 'flt-env-')));
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function* () { let rest = ''; for await (const c of stream) { rest += c.toString(); const p = rest.split('\n'); rest = p.pop()!; for (const x of p) yield x; } if (rest) yield rest; })(); }
const local: ProcessTransport = { spawn(argv, opts) { spawned.push(argv); const child = spawn(argv[0], argv.slice(1), { cwd: opts.cwd, env: { PATH: process.env.PATH!, ...opts.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); return { stdout: lines(child.stdout!), stderr: lines(child.stderr!), exit: new Promise((r) => child.once('exit', (code, signal) => r({ code, signal }))), signal: async (sig) => { try { if (child.pid) process.kill(-child.pid, sig); } catch { /* exited */ } } } satisfies ProcessHandle; } };
const machine = { transport: local, caps: { repoDir, sudo: false }, env: { FOO: 'bar' } };
const fast = { secondMs: 1 };

async function call(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
const json = async (r: Response) => (await r.json()) as any;
async function project(name: string, ownerId = owner): Promise<string> {
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ($1,$2,$1,$3,'untrusted','{}')`, [`prj_${name}`, ownerId, JSON.stringify({ fullName: 'example.invalid/o/r' })]);
  return `prj_${name}`;
}
async function thread(projectId: string, ownerId = owner): Promise<string> {
  const id = `thr_${Math.random().toString(16).slice(2, 10)}`;
  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$1,$2,'thread',$3,'t','idle','{}','{}','{}')`, [id, projectId, ownerId]);
  return id;
}
const port = () => 20000 + Math.floor(Math.random() * 20000);
const spec = (p = port()) => ({ setup: { initialize: { script: 'echo init', timeoutSec: 900 }, refresh: { script: 'echo refresh', timeoutSec: 300 } }, startup: [{ name: 'web', command: `exec node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${p})"`, readinessPort: p, preview: true }], commands: [{ name: 'test', command: 'echo tested-$FOO', description: 'run tests' }] });

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const p = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${p}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url;
  pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js');
  const auth = authStore(url);
  owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const session = (await auth.login('owner@x', 'pw'))!;
  cookie = `flotilla_session=${session.id}`; csrf = session.csrfToken;
  await pool.query(`INSERT INTO users (id,email,role) VALUES ($1,'envother@x','member')`, [other]);
  store = (await import('./store.js')).environmentStore(url);
  app = await (await import('../loader.js')).createApp();
}, 60_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('environments', () => {
  it('CAPY-183: per-project spec with scripts, startup entries and commands keeps a versioned shared history', async () => {
    const p = await project('history');
    expect(await json(await call(`/projects/${p}/environment`))).toMatchObject({ version: 0, spec: { startup: [], commands: [] } });
    expect((await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: spec(4000), note: 'first' } })).status).toBe(200);
    const second = await json(await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: { ...spec(4001), commands: [] } } }));
    expect(second).toMatchObject({ version: 2, source: 'user', createdBy: owner });
    const history = await json(await call(`/projects/${p}/environment/versions`));
    expect(history.items.map((v: any) => [v.version, v.note, v.spec.commands.length])).toEqual([[2, '', 0], [1, 'first', 1]]);
    expect((await json(await call(`/projects/${p}/environment`))).spec.startup[0]).toMatchObject({ name: 'web', readinessPort: 4001, preview: true });
    expect((await call(`/projects/${await project('foreign', other)}/environment`)).status).toBe(404);
    expect((await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: spec(4002), baseVersion: 1 } })).status).toBe(409);
    for (const bad of [undefined, null, [], { setup: [] }, { setup: { initialize: 'x' } }]) expect((await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: bad } })).status).toBe(400);
    const loose = `thr_noproj${Math.random().toString(16).slice(2, 8)}`;
    await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$1,NULL,'thread',$2,'t','idle','{}','{}','{}')`, [loose, owner]);
    expect(await json(await call(`/threads/${loose}/environment`))).toEqual({ setup: [], services: [], commands: [], terminals: [] });
  });

  it('CAPY-185: initialize (fresh clone, 900 s) and refresh (checkout moved, 300 s); timeouts must be 60-3600 s and are enforced', async () => {
    expect(parseEnvironmentSpec({}).setup).toEqual({ initialize: { script: '', timeoutSec: 900 }, refresh: { script: '', timeoutSec: 300 } });
    for (const timeoutSec of [59, 3601, 1.5]) expect(() => parseEnvironmentSpec({ setup: { refresh: { script: 'x', timeoutSec } } })).toThrow(/60-3600/);
    expect([choosePhase({ freshClone: true, head: 'a', lastHead: null }), choosePhase({ freshClone: false, head: 'b', lastHead: 'a' }), choosePhase({ freshClone: false, head: 'a', lastHead: 'a' })]).toEqual(['initialize', 'refresh', null]);
    const p = await project('phases'); const t = await thread(p);
    expect((await call(`/projects/${p}/environment`, { method: 'PUT', json: { spec: { ...spec(), setup: { initialize: { script: 'x', timeoutSec: 30 } } } } })).status).toBe(400);
    await store.replace(p, parseEnvironmentSpec({ ...spec(), startup: [], setup: { initialize: { script: 'echo i-$FLOTILLA_SETUP_PHASE', timeoutSec: 900 }, refresh: { script: 'echo r-$FLOTILLA_SETUP_PHASE', timeoutSec: 300 } } }), { source: 'user', actor: owner });
    expect((await store.prepare(t, machine, { freshClone: true, head: 'a' }, fast))?.output).toContain('i-initialize');
    expect(await store.prepare(t, machine, { freshClone: false, head: 'a' }, fast)).toBeNull();
    expect((await store.prepare(t, machine, { freshClone: false, head: 'b' }, fast))?.output).toContain('r-refresh');
    const started = Date.now();
    const slow = await new EnvironmentExecutor(t, machine, fast).run('setup', 'initialize', 'sleep 30', 60);
    expect(slow.state).toBe('timeout'); expect(Date.now() - started).toBeLessThan(5000);
  });

  it('CAPY-187: scripts run in bash from the repo dir with env vars; sudo is a machine capability, off by default', async () => {
    spawned.length = 0;
    const out = await new EnvironmentExecutor('thr_x', machine, fast).run('setup', 'initialize', 'echo "$PWD|$FOO|${BASH_VERSION:+bash}|$FLOTILLA_SUDO"', 60);
    expect(out).toMatchObject({ state: 'passed', exitCode: 0 });
    expect(out.output.trim()).toBe(`${repoDir}|bar|bash|0`);
    expect(spawned[0]).toEqual(['bash', '-c', 'echo "$PWD|$FOO|${BASH_VERSION:+bash}|$FLOTILLA_SUDO"']);
    expect((await new EnvironmentExecutor('thr_x', { ...machine, caps: { repoDir, sudo: true } }, fast).run('setup', 'refresh', 'echo $FLOTILLA_SUDO; exit 3', 60))).toMatchObject({ state: 'failed', exitCode: 3, output: '1\n' });
  });

  it('CAPY-186/189: startup entries become ready on their port, show in the + menu with preview, and rerun on wake', async () => {
    const p = await project('services'); const t = await thread(p); const s = spec();
    await store.replace(p, parseEnvironmentSpec(s), { source: 'user', actor: owner });
    const ex = store.executor(t, machine, fast);
    await ex.startServices(parseEnvironmentSpec(s));
    const menu = await json(await call(`/threads/${t}/environment`));
    expect(menu.services).toEqual([expect.objectContaining({ name: 'web', state: 'ready', readinessPort: s.startup[0].readinessPort, preview: true })]);
    expect(menu.commands).toEqual([expect.objectContaining({ name: 'test', state: 'idle', description: 'run tests' })]);
    expect(menu.terminals).toEqual([]);
    expect(await (await fetch(`http://127.0.0.1:${s.startup[0].readinessPort}`)).text()).toBe('ok');
    const before = spawned.filter((a) => a[2]?.includes('createServer')).length;
    await ex.wake(parseEnvironmentSpec(s));
    expect(spawned.filter((a) => a[2]?.includes('createServer')).length).toBe(before + 1);
    expect((await json(await call(`/threads/${t}/environment`))).services[0].state).toBe('ready');
    await ex.stop();
    expect((await json(await call(`/threads/${t}/environment`))).services[0].state).toBe('stopped');
    const bad = parseEnvironmentSpec({ startup: [{ name: 'db', command: 'exit 1', readinessPort: port() }] });
    await ex.startServices(bad);
    expect((await store.menu(t)).services.find((x) => x.name === 'web')).toBeTruthy();
  });

  it('CAPY-188: named commands run on demand against the thread machine', async () => {
    const p = await project('commands'); const t = await thread(p);
    await store.replace(p, parseEnvironmentSpec(spec()), { source: 'user', actor: owner });
    expect((await call(`/threads/${t}/environment/commands/test`, { method: 'POST' })).status).toBe(409);
    const off = registerEnvironmentMachine(t, machine);
    const ran = await json(await call(`/threads/${t}/environment/commands/test`, { method: 'POST' }));
    expect(ran).toMatchObject({ state: 'passed', exitCode: 0, output: 'tested-bar\n' });
    expect((await call(`/threads/${t}/environment/commands/nope`, { method: 'POST' })).status).toBe(404);
    expect((await json(await call(`/threads/${t}/environment`))).commands[0]).toMatchObject({ name: 'test', state: 'passed' });
    off();
  });

  it('CAPY-190/184: environment tools read/replace the whole setup within boundaries and verify it on the thread machine', async () => {
    const p = await project('tools'); const t = await thread(p); const theirs = await thread(await project('tools-other', other), other);
    const tool = (name: string, args: unknown, id = t) => call(`/threads/${id}/environment/tools/${name}`, { method: 'POST', json: args });
    expect(await json(await tool('environment.read', {}))).toMatchObject({ version: 0 });
    const replaced = await json(await tool('environment.replace', { spec: spec(), baseVersion: 0, note: 'agent setup', projectId: 'prj_tools-other' }));
    expect(replaced).toMatchObject({ version: 1, source: 'agent', threadId: t, projectId: p });
    expect((await tool('environment.replace', { spec: spec(), baseVersion: 0 })).status).toBe(409);
    expect((await tool('environment.replace', { spec: { commands: [{ name: 'x', command: 'y'.repeat(70_000) }] }, baseVersion: 1 })).status).toBe(400);
    expect((await tool('environment.read', {}, theirs)).status).toBe(404);
    expect((await tool('environment.delete', {})).status).toBe(404);
    expect((await tool('environment.verify', {})).status).toBe(409);
    const off = registerEnvironmentMachine(t, machine);
    expect(await json(await tool('environment.verify', {}))).toMatchObject({ version: 1, verification: { state: 'passed', phase: 'initialize' } });
    await tool('environment.replace', { spec: { setup: { initialize: { script: 'exit 7', timeoutSec: 60 } } }, baseVersion: 1 });
    expect(await json(await tool('environment.verify', {}))).toMatchObject({ version: 2, verification: { state: 'failed', exitCode: 7 } });
    expect((await store.history(p)).map((v) => v.verification?.state)).toEqual(['failed', 'passed']);
    off();
  });

  it('CAPY-191: .capy/setup.json (and .flotilla/setup.json) in the repo import as a versioned setup', async () => {
    const capy = { initialize: { script: 'pnpm i', timeout: 600 }, refresh: 'pnpm i --offline', startup: [{ name: 'db', command: 'pg_ctl start', port: 5432 }], commands: [{ name: 'build', command: 'pnpm build' }] };
    expect(parseSetupFile('.capy/setup.json', JSON.stringify(capy))).toEqual({ setup: { initialize: { script: 'pnpm i', timeoutSec: 600 }, refresh: { script: 'pnpm i --offline', timeoutSec: 300 } }, startup: [{ name: 'db', command: 'pg_ctl start', readinessPort: 5432, preview: false }], commands: [{ name: 'build', command: 'pnpm build', description: '' }] });
    const p = await project('import');
    const imported = await json(await call(`/projects/${p}/environment/import`, { method: 'POST', json: { path: '.capy/setup.json', content: JSON.stringify(capy) } }));
    expect(imported).toMatchObject({ version: 1, source: 'repo-file', note: '.capy/setup.json' });
    expect((await call(`/projects/${p}/environment/import`, { method: 'POST', json: { path: '.capy/setup.json', content: '{' } })).status).toBe(400);
    const t = await thread(p);
    const files: Record<string, string> = { '/workspace/repo/.flotilla/setup.json': JSON.stringify(spec(4100)) };
    const copied: string[] = [];
    let big = false;
    const size = (path: string) => (path in files ? (path.includes('.capy') && !big ? 10_000_000 : Buffer.byteLength(files[path])) : null);
    const driver = {
      copyOut: async (_id: string, path: string) => { copied.push(path); if (!files[path]) throw new Error('missing'); return tarFile(path.split('/').pop()!, files[path]); },
      transport: () => ({ spawn: (argv: string[], opts: { cwd: string }) => local.spawn(['bash', '-c', size(argv.at(-1)!) === null ? 'exit 1' : `echo ${size(argv.at(-1)!)}`], { cwd: opts.cwd, env: {} }) })
    };
    expect(await store.importFromMachine({ thread: { id: t, project_id: p }, containerId: 'c', driver })).toMatchObject({ version: 2, source: 'repo-file', note: '.flotilla/setup.json' });
    expect(await store.importFromMachine({ thread: { id: t, project_id: p }, containerId: 'c', driver })).toBeNull();
    delete files['/workspace/repo/.flotilla/setup.json']; files['/workspace/repo/.capy/setup.json'] = JSON.stringify(capy); copied.length = 0;
    expect(await store.importFromMachine({ thread: { id: t, project_id: p }, containerId: 'c', driver })).toBeNull();
    expect(copied).toEqual([]);
    files['/workspace/repo/.flotilla/setup.json'] = 'x'.repeat(70_000); files['/workspace/repo/.capy/setup.json'] = JSON.stringify({ ...capy, refresh: 'other' });
    big = true;
    expect(await store.importFromMachine({ thread: { id: t, project_id: p }, containerId: 'c', driver })).toBeNull();
    expect(copied).toEqual([]);
  });
});
