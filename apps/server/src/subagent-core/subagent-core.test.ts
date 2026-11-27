import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import Docker from 'dockerode';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AdapterEvent, AgentAdapter, StartInput } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { DockerMachineDriver } from '../machines/dockerDriver.js';
import { onAfterRun, ThreadRunner } from '../runner/runner.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createSubagentCoreRoute } from '../routes/subagent-core.route.js';
import { SubagentStore } from './store.js';

const exec = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const starts: Record<string, unknown>[] = [];
const driver = { startThreadContainer: async (i: Record<string, unknown>) => { starts.push(i); return { containerId: 'fake' }; }, transport: () => ({}), copyIn: async () => undefined, copyOut: async () => Buffer.from(''), stop: async () => undefined };
const inputs: StartInput[] = [];
let releaseHold = () => {};
/** Scripted fixture adapters: `plain` answers, `holder` streams then waits, `broke` errors, `pricey` overspends. */
function scripted(events: (input: StartInput) => AdapterEvent[], hold = false): AgentAdapter {
  return { manifest: fakeAdapter.manifest, probe: fakeAdapter.probe.bind(fakeAdapter), async cancel() { releaseHold(); },
    start(input: StartInput) { inputs.push(input); return (async function*() { yield { t: 'session', adapterSessionId: 's' } as AdapterEvent; for (const e of events(input)) yield e; if (hold) await new Promise<void>((r) => { releaseHold = r; }); yield { t: 'done', stopReason: 'end_turn' } as AdapterEvent; })(); },
    resume(input: StartInput) { return this.start(input); } } as AgentAdapter;
}
const adapters = new Map<string, AgentAdapter>([
  ['plain', scripted((i) => [{ t: 'text', delta: `summary: ${i.prompt.slice(0, 20)}` }])],
  ['holder', scripted(() => [{ t: 'text', delta: 'step 1 of 3' }, { t: 'tool_call', id: 'c1', name: 'read_file', input: {} }], true)],
  ['broke', scripted(() => [{ t: 'done', stopReason: 'error', error: 'provider exploded' }])],
  ['pricey', scripted(() => [{ t: 'usage', usdMicro: 5_000_000, inputTokens: 10, outputTokens: 10, cumulative: true }])]
]);
const engine = (adapter: string, extra: Record<string, unknown> = {}) => ({ adapter, model: null, effort: null, connectionId: null, ...extra });
const prs: unknown[][] = [];

let container = ''; let pool: pg.Pool; let runner: ThreadRunner; let store: SubagentStore; let api: Hono; let mirrors = ''; let uninstall = () => {};
const call = async (method: string, path: string, body?: unknown, user = 'usr_s') => { const r = await api.request(`/api/v1${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json() as any }; };
async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> { let v = await fn(); for (let i = 0; i < 80 && !ok(v); i++) { await sleep(100); v = await fn(); } return v; }
const state = (id: string) => until(() => store.get(id, 'usr_s').then((s) => s.state), () => true);
const settled = (id: string, want: string) => until(async () => (await store.get(id, 'usr_s')).state === want && !runner.running.has(id), Boolean);
async function parent(adapter = 'plain', maxUsd: number | null = null, projectId: string | null = null) {
  const t = await runner.createThread({ ownerId: 'usr_s', title: 'parent', prompt: 'parent secret history', engine: engine(adapter) as never, maxUsd, projectId });
  await until(async () => runner.running.has(t.id as string) || (await pool.query('SELECT status FROM threads WHERE id=$1', [t.id])).rows[0].status !== 'queued', Boolean);
  await until(async () => runner.running.has(t.id as string), (v) => !v);
  return t.id as string;
}
const draft = (over: Record<string, unknown> = {}) => ({ title: 'scan', prompt: 'list the TODOs', placement: 'fresh', engine: { adapter: 'plain' }, ...over });

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await sleep(250); } }
  await migrate(url); const events = new EventStore(url); pool = events.pool;
  runner = new ThreadRunner({ store: events, driver: driver as never, adapters, resolveEngine: async (_u, e) => { if (e.connectionId === 'con_other') throw new ApiFailure('NotFound', 'connection not found'); return { adapter: e.adapter as string, model: (e.model as string | null) ?? null, effort: e.effort ?? null, connectionId: (e.connectionId as string | null) ?? null }; } });
  mirrors = mkdtempSync(join(tmpdir(), 'flt-sub-'));
  store = new SubagentStore({ runner, mirrorRoot: mirrors, github: () => ({ openOrFindPr: async (...a: unknown[]) => { prs.push(a); return { number: 7, html_url: 'https://github.com/acme/app/pull/7', head: { ref: String(a[1]), sha: 'x' }, base: { ref: String(a[2]) } }; } }) });
  uninstall = store.install();
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_s','s@x','admin'),('usr_o','o@x','member')`);
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_s','usr_s','app','{"provider":"github","fullName":"/nonexistent/app","baseBranch":"main"}','untrusted','{}')`);
  api = new Hono(); api.use('*', async (c, next) => { c.set('userId' as never, c.req.header('x-user') as never); await next(); });
  api.onError((err, c) => (err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)))); api.route('/api/v1', createSubagentCoreRoute(() => store).app);
}, 30_000);
afterAll(async () => { uninstall(); releaseHold(); await runner.drain(); await pool.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });

describe('subagent core', () => {
  it('CAPY-052: child threads nest 3 levels, are addressed "Subagent 1.3"-style, and run their own conversation; level 4 is refused', async () => {
    const root = await parent();
    const a = await call('POST', `/threads/${root}/subagents`, draft()); const b = await call('POST', `/threads/${root}/subagents`, draft());
    expect([a.status, a.json.label, b.json.label]).toEqual([201, 'Subagent 1', 'Subagent 2']);
    const c = await call('POST', `/threads/${b.json.id}/subagents`, draft()); const d = await call('POST', `/threads/${c.json.id}/subagents`, draft());
    expect([c.json.label, c.json.depth, d.json.label, d.json.depth, d.json.parentId]).toEqual(['Subagent 2.1', 2, 'Subagent 2.1.1', 3, c.json.id]);
    const deep = await call('POST', `/threads/${d.json.id}/subagents`, draft());
    expect(deep.status).toBe(403); expect(deep.json.error).toMatch(/at most 3 levels/);
    expect((await call('POST', `/threads/${root}/subagents`, draft(), 'usr_o')).status).toBe(404);
    expect((await call('POST', `/subagents/${d.json.id}/start`)).status).toBe(409);
    for (const x of [b.json, c.json, d.json]) expect((await call('POST', `/subagents/${x.id}/start`)).status).toBe(200);
    await settled(d.json.id, 'done');
    const ev = (await pool.query(`SELECT kind FROM events WHERE thread_id=$1 ORDER BY seq`, [d.json.id])).rows.map((r) => r.kind);
    expect(ev).toEqual(expect.arrayContaining(['thread.created', 'user.message', 'run.started', 'agent.delta', 'run.ended']));
    expect((await pool.query('SELECT parent_id FROM threads WHERE id=$1', [d.json.id])).rows[0].parent_id).toBe(c.json.id);
  }, 20_000);

  it('CAPY-053: a subagent is an editable draft (title + prompt) and does not run until started', async () => {
    const root = await parent(); const s = (await call('POST', `/threads/${root}/subagents`, draft())).json;
    expect(s.state).toBe('draft'); await sleep(200);
    expect((await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [s.id])).rows[0].n).toBe(0);
    const edited = await call('PATCH', `/subagents/${s.id}`, { title: 'scan v2', prompt: 'list the FIXMEs' });
    expect([edited.json.title, edited.json.prompt, edited.json.state]).toEqual(['scan v2', 'list the FIXMEs', 'draft']);
    expect((await call('POST', `/subagents/${s.id}/start`)).json.state).toBe('working');
    expect((await call('PATCH', `/subagents/${s.id}`, { prompt: 'late' })).status).toBe(409);
    expect((await call('POST', `/subagents/${s.id}/start`)).status).toBe(409);
    await settled(s.id, 'done');
  }, 20_000);

  it('CAPY-054: a subagent starts from its prompt alone, with no parent history or session', async () => {
    const root = await parent(); const s = (await call('POST', `/threads/${root}/subagents`, draft({ prompt: 'only this brief' }))).json;
    await call('POST', `/subagents/${s.id}/start`); await settled(s.id, 'done');
    const input = inputs.find((i) => i.threadId === s.id)!;
    expect([input.prompt, (input as unknown as { resumeSessionId: unknown }).resumeSessionId]).toEqual(['only this brief', null]);
    const texts = (await pool.query(`SELECT payload::text p FROM events WHERE thread_id=$1`, [s.id])).rows.map((r) => r.p).join();
    expect(texts).not.toContain('parent secret history');
  }, 20_000);

  it('CAPY-055: placement is explicit; shared mounts the parent workspace read-only, fresh gets its own machine', async () => {
    const root = await parent();
    expect((await call('POST', `/threads/${root}/subagents`, draft({ placement: undefined }))).status).toBe(400);
    expect((await call('POST', `/threads/${root}/subagents`, draft({ placement: 'shared', mode: 'stacked' }))).status).toBe(400);
    const shared = (await call('POST', `/threads/${root}/subagents`, draft({ placement: 'shared' }))).json;
    const fresh = (await call('POST', `/threads/${root}/subagents`, draft())).json;
    for (const s of [shared, fresh]) { await call('POST', `/subagents/${s.id}/start`); await settled(s.id, 'done'); }
    expect(starts.find((i) => i.threadId === shared.id)!.workspaceFrom).toBe(root);
    expect(starts.find((i) => i.threadId === fresh.id)!.workspaceFrom).toBeUndefined();
    const created: Docker.ContainerCreateOptions[] = [];
    const docker = { listContainers: async () => [], listNetworks: async () => [], createNetwork: async () => ({ id: 'net' }), createVolume: async (v: { Name: string }) => { created.push({ name: `vol:${v.Name}` }); return {}; },
      createContainer: async (o: Docker.ContainerCreateOptions) => { created.push(o); return { id: 'c1', start: async () => undefined }; } } as unknown as Docker;
    await new DockerMachineDriver(docker).startThreadContainer({ threadId: shared.id, code: 'SUB-1', image: 'img', cpus: 1, memMb: 512, env: {}, workspaceFrom: root });
    await new DockerMachineDriver(docker).startThreadContainer({ threadId: fresh.id, code: 'SUB-2', image: 'img', cpus: 1, memMb: 512, env: {} });
    const mount = (o: Docker.ContainerCreateOptions) => o.HostConfig?.Mounts?.find((m) => m.Target === '/workspace');
    expect(mount(created[0])).toMatchObject({ Source: `flt-workspace-${root}`, ReadOnly: true });
    expect([created[1].name, mount(created[2])]).toEqual([`vol:flt-workspace-${fresh.id}`, expect.objectContaining({ Source: `flt-workspace-${fresh.id}`, ReadOnly: false })]);
  }, 20_000);

  it('CAPY-055: after a takeover the new owner cannot list the old subagents and an old shared subagent loses the workspace', async () => {
    const root = await parent(); const s = (await call('POST', `/threads/${root}/subagents`, draft({ placement: 'shared' }))).json;
    await pool.query(`UPDATE threads SET owner_id='usr_o' WHERE id=$1`, [root]);
    expect((await call('GET', `/threads/${root}/subagents`, undefined, 'usr_o')).json.items).toEqual([]);
    await call('POST', `/subagents/${s.id}/start`);
    const runs = await until(() => pool.query('SELECT state FROM runs WHERE thread_id=$1', [s.id]).then((r) => r.rows), (r) => r[0]?.state === 'failed');
    expect(runs[0].state).toBe('failed'); expect(starts.some((i) => i.threadId === s.id)).toBe(false);
  }, 20_000);

  it('CAPY-056: parallel subagents must claim disjoint paths; a stacked subagent branches from the previous sibling branch', async () => {
    await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_t','usr_s','stack','{"provider":"github","fullName":"/nonexistent/stack","baseBranch":"main"}','untrusted','{}')`);
    const root = await parent('plain', null, 'prj_t');
    const one = (await call('POST', `/threads/${root}/subagents`, draft({ paths: ['src/api/'] }))).json;
    expect((await call('POST', `/threads/${root}/subagents`, draft({ paths: ['src/api/users.ts'] }))).status).toBe(409);
    expect((await call('POST', `/threads/${root}/subagents`, draft({ paths: ['src/web'] }))).status).toBe(201);
    const stacked = (await call('POST', `/threads/${root}/subagents`, draft({ mode: 'stacked' }))).json;
    expect(stacked.stackedOn).not.toBeNull();
    expect((await call('POST', `/subagents/${stacked.id}/start`)).status).toBe(409);
    await pool.query('UPDATE threads SET branch=$2 WHERE id=$1', [stacked.stackedOn, 'flotilla/FLO-PREV-web']);
    expect((await call('POST', `/subagents/${stacked.id}/start`)).json.error).toMatch(/not published/);
    const work = mkdtempSync(join(tmpdir(), 'flt-stack-'));
    await exec('sh', ['-c', 'git init -q -b main && git -c user.email=t@x -c user.name=t commit -q --allow-empty -m base && git branch flotilla/FLO-PREV-web'], { cwd: work });
    await exec('git', ['clone', '-q', '--bare', work, join(mirrors, 'prj_t.git')]);
    const bases: unknown[] = []; const off = onAfterRun(async ({ thread, project }) => { if (thread.id === stacked.id) bases.push((project?.repo as { baseBranch: string } | undefined)?.baseBranch); });
    expect((await call('POST', `/subagents/${stacked.id}/start`)).json.baseBranch).toBe('flotilla/FLO-PREV-web');
    await until(async () => bases.length, Boolean); off();
    expect(bases).toEqual(['flotilla/FLO-PREV-web']); expect(one.mode).toBe('parallel');
  }, 20_000);

  it('CAPY-057/058: lifecycle draft→working→done wakes the parent with the summary; progress reads on demand; failed, idle and waiting', async () => {
    const root = await parent(); const s = (await call('POST', `/threads/${root}/subagents`, draft({ engine: { adapter: 'holder' } }))).json;
    expect(await state(s.id)).toBe('draft');
    await call('POST', `/subagents/${s.id}/start`); await until(async () => runner.running.has(s.id), Boolean); await sleep(200);
    const progress = await call('GET', `/subagents/${s.id}/progress`);
    expect([progress.json.subagent.state, progress.json.text, progress.json.tools]).toEqual(['working', '', ['read_file']]);
    expect((await pool.query(`SELECT count(*)::int n FROM thread_inbox WHERE thread_id=$1 AND text LIKE 'Subagent%'`, [root])).rows[0].n).toBe(0);
    releaseHold(); await settled(s.id, 'done');
    expect((await store.get(s.id, 'usr_s')).summary).toBe('step 1 of 3');
    expect((await call('GET', `/subagents/${s.id}/progress`)).json.text).toBe('step 1 of 3');
    const woke = await until(async () => inputs.filter((i) => i.threadId === root).map((i) => i.prompt), (p) => p.length > 1);
    expect(woke[1]).toContain('Subagent 1 "scan" finished'); expect(woke[1]).toContain('step 1 of 3');

    const bad = (await call('POST', `/threads/${root}/subagents`, draft({ engine: { adapter: 'broke' } }))).json;
    await call('POST', `/subagents/${bad.id}/start`); await settled(bad.id, 'failed');
    const stopped = (await call('POST', `/threads/${root}/subagents`, draft({ engine: { adapter: 'holder' } }))).json;
    await call('POST', `/subagents/${stopped.id}/start`); await until(async () => runner.running.has(stopped.id), Boolean); await runner.stop(stopped.id, 'usr_s'); await settled(stopped.id, 'idle');
    const blocked = (await call('POST', `/threads/${root}/subagents`, draft({ engine: { adapter: 'pricey' }, maxUsd: 1 }))).json;
    await call('POST', `/subagents/${blocked.id}/start`); await settled(blocked.id, 'waiting');
    expect((await store.get(blocked.id, 'usr_s')).question).toMatch(/Budget cap reached/);
    const asked = await until(async () => (await pool.query(`SELECT text FROM thread_inbox WHERE thread_id=$1 AND text LIKE '%is blocked%'`, [root])).rows, (r) => r.length > 0);
    expect(asked[0].text).toContain(`Subagent 4 "scan" is blocked and asks: Budget cap reached`);
  }, 30_000);

  it('CAPY-059: the parent reviews the diff, applies it as a patch, opens a PR from the subagent branch, or sends feedback', async () => {
    const root = await parent('plain', null, 'prj_s'); const s = (await call('POST', `/threads/${root}/subagents`, draft())).json;
    await call('POST', `/subagents/${s.id}/start`); await settled(s.id, 'done');
    const branch = `flotilla/${(await pool.query('SELECT code FROM threads WHERE id=$1', [s.id])).rows[0].code}-scan`;
    await pool.query('UPDATE threads SET branch=$2 WHERE id=$1', [s.id, branch]);
    const work = mkdtempSync(join(tmpdir(), 'flt-sub-work-')); const g = (...a: string[]) => exec('git', ['-c', 'user.email=t@x', '-c', 'user.name=t', ...a], { cwd: work });
    await g('init', '-b', 'main'); await exec('sh', ['-c', 'echo one > a.txt'], { cwd: work }); await g('add', '.'); await g('commit', '-m', 'base');
    await g('switch', '-c', branch); await exec('sh', ['-c', 'echo two >> a.txt'], { cwd: work }); await g('commit', '-am', 'sub');
    await exec('git', ['clone', '--bare', work, join(mirrors, 'prj_s.git')]);
    const diff = await call('GET', `/subagents/${s.id}/diff`);
    expect([diff.json.branch, diff.json.base]).toEqual([branch, 'main']); expect(diff.json.patch).toContain('+two');
    await g('switch', 'main'); 
    const apply = execFile('git', ['apply', '-'], { cwd: work }); apply.stdin!.end(diff.json.patch); await new Promise((r) => apply.once('exit', r));
    expect((await exec('cat', ['a.txt'], { cwd: work })).stdout).toBe('one\ntwo\n');
    const pr = await call('POST', `/subagents/${s.id}/pr`);
    expect([pr.status, pr.json.number, prs.at(-1)]).toEqual([201, 7, ['/nonexistent/app', branch, 'main', 'scan']]);
    expect((await pool.query('SELECT prs FROM threads WHERE id=$1', [s.id])).rows[0].prs).toEqual([{ repo: '/nonexistent/app', number: 7, owned: true }]);
    const fb = await call('POST', `/subagents/${s.id}/feedback`, { text: 'also cover tests' });
    expect(fb.json.state).toBe('working'); await settled(s.id, 'done');
    expect(inputs.filter((i) => i.threadId === s.id).map((i) => i.prompt)).toEqual(['list the TODOs', 'also cover tests']);
  }, 20_000);

  it('CAPY-060: each subagent picks its own model/connection, and its budget is a slice of what the parent has left', async () => {
    const root = await parent('plain', 10);
    await pool.query(`UPDATE threads SET spent=jsonb_set(spent,'{usd}','4') WHERE id=$1`, [root]);
    const cheap = (await call('POST', `/threads/${root}/subagents`, draft({ engine: { adapter: 'plain', model: 'small', connectionId: 'con_mine' }, maxUsd: 50 }))).json;
    expect([cheap.engine.model, cheap.engine.connectionId, cheap.budget]).toEqual(['small', 'con_mine', { requestedUsd: 50, grantedUsd: 6 }]);
    expect((await pool.query('SELECT budget FROM threads WHERE id=$1', [cheap.id])).rows[0].budget.maxUsd).toBe(6);
    expect((await call('POST', `/threads/${root}/subagents`, draft({ engine: { adapter: 'plain', connectionId: 'con_other' } }))).status).toBe(404);
    const none = await call('POST', `/threads/${root}/subagents`, draft());
    expect(none.status).toBe(403); expect(none.json.error).toMatch(/budget/);
    const free = (await call('POST', `/threads/${await parent()}/subagents`, draft({ maxUsd: 3 }))).json;
    expect(free.budget).toEqual({ requestedUsd: 3, grantedUsd: 3 });
  }, 20_000);
});
