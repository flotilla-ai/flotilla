import { execFile, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AgentAdapter, ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import { BUILTIN_SKILLS, parseInvocations, parseSkillMd } from './types.js';

const exec = promisify(execFile);
const repoDir = realpathSync(mkdtempSync(join(tmpdir(), 'flt-skills-')));
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function* () { let rest = ''; for await (const c of stream) { rest += c.toString(); const p = rest.split('\n'); rest = p.pop()!; for (const x of p) yield x; } if (rest) yield rest; })(); }
/** Local process transport; the thread's `/workspace/repo` is a temp dir with repo skill fixtures. */
const transport: ProcessTransport = { spawn(argv, opts) { const args = argv.map((a) => a.replace('/workspace/repo', repoDir)); const child = spawn(args[0], args.slice(1), { cwd: process.cwd(), env: { ...process.env, ...opts.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); return { stdout: lines(child.stdout!), stderr: lines(child.stderr!), exit: new Promise((r) => child.once('exit', (code, signal) => r({ code, signal }))), signal: async (sig) => { try { if (child.pid) process.kill(-child.pid, sig); } catch { /* exited */ } } } satisfies ProcessHandle; } };
const copies: { dir: string; tar: Buffer }[] = [];
const driver = { startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => transport, copyIn: async (_id: string, dir: string, tar: Buffer) => { copies.push({ dir, tar }); }, copyOut: async () => Buffer.from(''), stop: async () => undefined };
const prompts: string[] = [];
const adapter = { manifest: fakeAdapter.manifest, probe: fakeAdapter.probe.bind(fakeAdapter), cancel: fakeAdapter.cancel.bind(fakeAdapter), resume: fakeAdapter.resume.bind(fakeAdapter), start(input) { prompts.push(input.prompt); return fakeAdapter.start(input); } } as AgentAdapter;
function untar(tar: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  for (let o = 0; o + 512 <= tar.length;) { const h = tar.subarray(o, o + 512); if (h.every((b) => b === 0)) break; const name = h.subarray(0, 100).toString().replace(/\0.*$/s, ''); const size = parseInt(h.subarray(124, 136).toString(), 8); out[name] = tar.subarray(o + 512, o + 512 + size).toString(); o += 512 + Math.ceil(size / 512) * 512; }
  return out;
}
const md = (name: string, description: string, body = 'Do the thing.') => `---\nname: ${name}\ndescription: ${description}\n---\n${body}\n`;

let container = ''; let pool: pg.Pool; let app: Hono; let runner: ThreadRunner; let cookie = ''; let csrf = ''; let owner = ''; let stopModule: () => Promise<void>;
async function call(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
const json = async (r: Response) => (await r.json()) as any;
async function waitRun(threadId: string, n = 1) { for (let i = 0; i < 100; i++) { const r = await pool.query(`SELECT 1 FROM runs WHERE thread_id=$1 AND ended_at IS NOT NULL`, [threadId]); if (r.rows.length >= n) return; await new Promise((x) => setTimeout(x, 100)); } throw new Error('run did not end'); }
const byName = (items: any[], name: string, source?: string) => items.filter((s) => s.name === name && (!source || s.source.kind === source));

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const p = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${p}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url;
  const store = new EventStore(url); pool = store.pool;
  runner = new ThreadRunner({ store, driver: driver as never, adapters: new Map([['fake', adapter]]) });
  const { authStore } = await import('../auth/store.js');
  const auth = authStore(url);
  owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const session = (await auth.login('owner@x', 'pw'))!;
  cookie = `flotilla_session=${session.id}`; csrf = session.csrfToken;
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_sk',$1,'sk',$2,'untrusted','{}')`, [owner, JSON.stringify({ fullName: 'example.invalid/o/r' })]);
  for (const [dir, name, text] of [['.agents/skills', 'deploy', md('deploy', 'Deploy the app.')], ['.claude/skills', 'lint', md('lint', 'Run the linters.')], ['.claude/skills', 'broken', '# no frontmatter\n']]) { mkdirSync(join(repoDir, dir, name), { recursive: true }); writeFileSync(join(repoDir, dir, name, 'SKILL.md'), text); }
  writeFileSync(join(repoDir, '.agents/skills/deploy/run.sh'), 'echo deploy\n');
  app = await (await import('../loader.js')).createApp();
  stopModule = await (await import('../modules/skills.module.js')).default.start();
}, 60_000);
afterAll(async () => { await stopModule?.(); await runner?.drain(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('skills', () => {
  it('CAPY-299: SKILL.md needs name + description frontmatter; a bad file is listed as Not loaded with the reason', async () => {
    expect(parseSkillMd(md('paper', 'Draw on a canvas.'))).toEqual({ name: 'paper', description: 'Draw on a canvas.' });
    expect(parseSkillMd('---\nname: "x-y"\ndescription: >\n  folded\n  text\n---\nbody')).toEqual({ name: 'x-y', description: 'folded text' });
    expect(parseSkillMd('no frontmatter')).toEqual({ error: 'SKILL.md has no frontmatter' });
    expect(parseSkillMd('---\nname: a\n---\n')).toEqual({ error: 'frontmatter has no description' });
    expect(parseSkillMd('---\ndescription: d\n---\n')).toEqual({ error: 'frontmatter has no name' });
    const bad = await json(await call('/skills', { method: 'POST', json: { source: 'drive', folder: 'notes', files: { 'SKILL.md': md('other', 'Mismatch') } } }));
    expect(bad.load).toEqual({ state: 'not-loaded', reason: 'name "other" does not match folder "notes"' });
    expect((await call('/skills', { method: 'POST', json: { source: 'drive', folder: 'x', files: {} } })).status).toBe(400);
    expect((await call('/skills', { method: 'POST', json: { source: 'repo', folder: 'x', files: { 'SKILL.md': md('x', 'd') } } })).status).toBe(400);
  });

  it('CAPY-296: built-in skills are listed, loaded and mounted into the thread in agent-native skills folders', async () => {
    expect(BUILTIN_SKILLS.map((s) => s.name)).toEqual(['artifact', 'flotilla-setup', 'find-mcp-server', 'gh-stack', 'make-a-deck', 'make-a-page', 'make-a-prototype', 'paper', 'spreadsheets']);
    const list = await json(await call('/skills'));
    for (const b of BUILTIN_SKILLS) expect(byName(list.items, b.name, 'builtin')[0].load).toEqual({ state: 'loaded' });
    copies.length = 0;
    const t = await runner.createThread({ ownerId: owner, title: 'b', prompt: 'hello' }); await waitRun(t.id as string);
    const mount = copies.find((c) => c.dir === '/home/node');
    expect(mount).toBeTruthy();
    const files = untar(mount!.tar);
    for (const root of ['.agents/skills', '.claude/skills', '.codex/skills']) expect(parseSkillMd(files[`${root}/paper/SKILL.md`])).toMatchObject({ name: 'paper' });
  }, 20_000);

  it('CAPY-297: repository skills in .agents/skills and .claude/skills are discovered from the checkout and mounted', async () => {
    copies.length = 0;
    const t = await runner.createThread({ ownerId: owner, projectId: 'prj_sk', title: 'r', prompt: 'hello' }); await waitRun(t.id as string);
    const list = (await json(await call('/skills?projectId=prj_sk'))).items;
    expect(byName(list, 'deploy', 'repo')[0]).toMatchObject({ description: 'Deploy the app.', source: { kind: 'repo', projectId: 'prj_sk', dir: '.agents/skills' }, load: { state: 'loaded' } });
    expect(byName(list, 'lint', 'repo')[0]).toMatchObject({ source: { dir: '.claude/skills' }, load: { state: 'loaded' } });
    expect(byName(list, 'broken', 'repo')[0].load).toEqual({ state: 'not-loaded', reason: 'SKILL.md has no frontmatter' });
    expect(byName((await json(await call('/skills'))).items, 'deploy')).toEqual([]);
    const files = untar(copies.find((c) => c.dir === '/home/node')!.tar);
    expect(files['.agents/skills/deploy/run.sh']).toBe('echo deploy\n');
    expect(files['.claude/skills/lint/SKILL.md']).toContain('Run the linters.');
    expect(files['.claude/skills/broken/SKILL.md']).toBeUndefined();
  }, 20_000);

  it('CAPY-298: Drive (personal and project) and plugin skills load and mount', async () => {
    const personal = await json(await call('/skills', { method: 'POST', json: { source: 'drive', folder: 'standup', files: { 'SKILL.md': md('standup', 'Write the standup.') } } }));
    expect(personal).toMatchObject({ source: { kind: 'drive', scope: 'user', projectId: null }, load: { state: 'loaded' } });
    const proj = await json(await call('/skills', { method: 'POST', json: { source: 'drive', projectId: 'prj_sk', folder: 'release', files: { 'SKILL.md': md('release', 'Cut a release.') } } }));
    expect(proj).toMatchObject({ source: { kind: 'drive', scope: 'project', projectId: 'prj_sk' }, load: { state: 'loaded' } });
    const plugin = await json(await call('/skills', { method: 'POST', json: { source: 'plugin', plugin: 'acme', folder: 'acme-search', files: { 'SKILL.md': md('acme-search', 'Search Acme.') } } }));
    expect(plugin).toMatchObject({ source: { kind: 'plugin', plugin: 'acme' }, load: { state: 'loaded' } });
    expect(byName((await json(await call('/skills'))).items, 'release')).toEqual([]);
    expect((await call('/skills', { method: 'POST', json: { source: 'drive', projectId: 'prj_missing', folder: 'a', files: { 'SKILL.md': md('a', 'b') } } })).status).toBe(404);
    copies.length = 0;
    const t = await runner.createThread({ ownerId: owner, projectId: 'prj_sk', title: 'd', prompt: 'hello' }); await waitRun(t.id as string);
    const files = untar(copies.find((c) => c.dir === '/home/node')!.tar);
    for (const n of ['standup', 'release', 'acme-search']) expect(files[`.agents/skills/${n}/SKILL.md`]).toBeTruthy();
  }, 20_000);

  it('CAPY-300: Skills page markers: Replaced by a higher source, and Not loaded when turned off', async () => {
    await call('/skills', { method: 'POST', json: { source: 'drive', folder: 'paper', files: { 'SKILL.md': md('paper', 'My own paper skill.') } } });
    await call('/skills', { method: 'POST', json: { source: 'drive', projectId: 'prj_sk', folder: 'deploy', files: { 'SKILL.md': md('deploy', 'Drive deploy.') } } });
    let list = (await json(await call('/skills?projectId=prj_sk'))).items;
    expect(byName(list, 'paper', 'builtin')[0].load).toEqual({ state: 'replaced', by: 'drive' });
    expect(byName(list, 'paper', 'drive')[0].load).toEqual({ state: 'loaded' });
    expect(byName(list, 'deploy', 'drive')[0].load).toEqual({ state: 'replaced', by: 'repo' });
    expect((await call('/skills/disabled', { method: 'PUT', json: { source: 'builtin', name: 'gh-stack', disabled: true } })).status).toBe(200);
    expect((await call('/skills/disabled', { method: 'PUT', json: { source: 'repo', name: 'deploy', disabled: true } })).status).toBe(200);
    list = (await json(await call('/skills?projectId=prj_sk'))).items;
    expect(byName(list, 'gh-stack', 'builtin')[0].load).toEqual({ state: 'not-loaded', reason: 'turned off' });
    expect(byName(list, 'deploy', 'repo')[0].load).toEqual({ state: 'not-loaded', reason: 'turned off' });
    expect(byName(list, 'deploy', 'drive')[0].load).toEqual({ state: 'loaded' });
    copies.length = 0;
    const t = await runner.createThread({ ownerId: owner, projectId: 'prj_sk', title: 'm', prompt: 'hello' }); await waitRun(t.id as string);
    const files = untar(copies.find((c) => c.dir === '/home/node')!.tar);
    expect(files['.agents/skills/paper/SKILL.md']).toContain('My own paper skill.');
    expect(files['.agents/skills/deploy/SKILL.md']).toContain('Drive deploy.');
    expect(files['.agents/skills/gh-stack/SKILL.md']).toBeUndefined();
    await call('/skills/disabled', { method: 'PUT', json: { source: 'builtin', name: 'gh-stack', disabled: false } });
    expect(byName((await json(await call('/skills'))).items, 'gh-stack', 'builtin')[0].load).toEqual({ state: 'loaded' });
  }, 20_000);

  it('CAPY-295: $, /, @ or plain words invoke a skill; the agent is told which SKILL.md to read and the invocation is recorded', async () => {
    const names = new Set(['paper', 'gh-stack', 'spreadsheets', 'make-a-deck', 'artifact']);
    expect(parseInvocations('draw it with $paper', names)).toEqual([{ name: 'paper', trigger: '$' }]);
    expect(parseInvocations('/gh-stack split this', names)).toEqual([{ name: 'gh-stack', trigger: '/' }]);
    expect(parseInvocations('ping @spreadsheets and @FLO-12', names)).toEqual([{ name: 'spreadsheets', trigger: '@' }]);
    expect(parseInvocations('Make a deck about Q3', names)).toEqual([{ name: 'make-a-deck', trigger: 'words' }]);
    expect(parseInvocations('use the artifact skill', names)).toEqual([{ name: 'artifact', trigger: 'words' }]);
    expect(parseInvocations('a paper about x/gh-stack, cost $5', names)).toEqual([]);
    expect((await json(await call('/skills/resolve', { method: 'POST', json: { text: '$deploy then @lint', projectId: 'prj_sk' } }))).invocations).toMatchObject([{ name: 'deploy', trigger: '$', source: 'drive' }, { name: 'lint', trigger: '@', source: 'repo' }]);
    prompts.length = 0;
    const t = await runner.createThread({ ownerId: owner, title: 'i', prompt: 'make a deck with $paper' }); await waitRun(t.id as string);
    expect(prompts[0]).toContain('/home/node/.agents/skills/paper/SKILL.md');
    expect(prompts[0]).toContain('/home/node/.agents/skills/make-a-deck/SKILL.md');
    expect(prompts[0].endsWith('make a deck with $paper')).toBe(true);
    const recorded = await json(await call(`/threads/${t.id}/skills`));
    expect(recorded.invocations.map((x: any) => [x.name, x.trigger, x.source])).toEqual([['make-a-deck', 'words', 'builtin'], ['paper', '$', 'drive']]);
    expect((await call('/threads/thr_missing/skills')).status).toBe(404);
  }, 20_000);

  it('CAPY-301: skills from Claude Code, Cursor and the skills CLI are reused by copying their folders', async () => {
    const r = await json(await call('/skills/import', { method: 'POST', json: { from: 'claude-code', files: [
      { path: '.claude/skills/review/SKILL.md', content: md('review', 'Review a diff.') },
      { path: '.claude/skills/review/scripts/check.sh', content: 'echo ok\n' },
      { path: 'skills/triage/SKILL.md', content: md('triage', 'Triage issues.') }] } }));
    expect(r.items.map((s: any) => [s.name, s.origin, s.load.state, Object.keys(s.files).sort()])).toEqual([['review', 'claude-code', 'loaded', ['SKILL.md', 'scripts/check.sh']], ['triage', 'claude-code', 'loaded', ['SKILL.md']]]);
    const cursor = await json(await call('/skills/import', { method: 'POST', json: { from: 'cursor', projectId: 'prj_sk', files: [{ path: '.cursor/skills/tidy/SKILL.md', content: md('tidy', 'Tidy code.') }] } }));
    expect(cursor.items[0]).toMatchObject({ name: 'tidy', origin: 'cursor', source: { kind: 'drive', scope: 'project' } });
    const cli = await json(await call('/skills/import', { method: 'POST', json: { from: 'skills-cli', files: [{ path: '.agents/skills/pdf/SKILL.md', content: md('pdf', 'Work with PDFs.') }] } }));
    expect(cli.items[0]).toMatchObject({ name: 'pdf', origin: 'skills-cli', load: { state: 'loaded' } });
    expect((await call('/skills/import', { method: 'POST', json: { from: 'vscode', files: [] } })).status).toBe(400);
    expect((await call('/skills/import', { method: 'POST', json: { from: 'cursor', files: [{ path: '../etc/skills/x/SKILL.md', content: md('x', 'y') }] } })).status).toBe(400);
    copies.length = 0;
    const t = await runner.createThread({ ownerId: owner, title: 'c', prompt: 'hello' }); await waitRun(t.id as string);
    expect(untar(copies.find((c) => c.dir === '/home/node')!.tar)['.claude/skills/review/scripts/check.sh']).toBe('echo ok\n');
  }, 20_000);
});
