import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ensureMirror, type GitProject } from '../git/mirror.js';
import { createProjectsRoute } from '../routes/projects.route.js';
import { describeRepo } from './describe.js';
import type { Project } from './types.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let app: Hono; let tmp = ''; let root = '';
const fixtures: Record<string, string> = {};
const mirrorCalls: string[] = [];
const json = (body: unknown, method = 'POST', user = 'usr_a') => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-user': user } });
const as = (user: string) => ({ headers: { 'x-user': user } });
async function repo(name: string, files: Record<string, string>, branch = 'main'): Promise<string> {
  const dir = join(tmp, name); mkdirSync(dir);
  for (const [f, body] of Object.entries(files)) writeFileSync(join(dir, f), body);
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' };
  for (const args of [['init', '-q', '-b', branch], ['add', '.'], ['commit', '-qm', 'init']]) await exec('git', args, { cwd: dir, env });
  return dir;
}
async function create(body: unknown, user = 'usr_a'): Promise<{ status: number; body: Project & { error?: string } }> {
  const res = await app.request('http://local/api/v1/projects', json(body, 'POST', user));
  return { status: res.status, body: await res.json() as Project & { error?: string } };
}
async function get(id: string, user = 'usr_a'): Promise<Project> { return await (await app.request(`http://local/api/v1/projects/${id}`, as(user))).json() as Project; }
async function threadCode(projectId: string, id: string): Promise<string> {
  return (await pool.query("INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,'FLO-TEMP'||$1,$2,'thread','usr_a','t','idle','{}','{}','{}') RETURNING code", [id, projectId])).rows[0].code;
}

beforeAll(async () => {
  process.env.FLOTILLA_ALLOW_LOCAL_GIT_REMOTES = '1';
  tmp = mkdtempSync(join(tmpdir(), 'flt-projects-')); root = join(tmp, 'mirrors'); mkdirSync(root);
  fixtures['acme/api'] = await repo('api', { 'package.json': JSON.stringify({ name: 'api', description: 'HTTP API for the Acme storefront' }), 'README.md': '# api\n\nIgnored because the manifest wins.\n' });
  fixtures.docs = await repo('docs', { 'README.md': '# Docs\n\n[![ci](https://x/badge.svg)](https://x)\n\n<p align="center"><img src="logo.png"></p>\n\nThe **Acme** handbook site, built with Astro. It has many pages.\n' });
  fixtures['acme/billing'] = await repo('billing', { 'README.md': '# old\n\nLegacy billing service.\n' }, 'master');
  fixtures.engine = await repo('engine', { 'Cargo.toml': '[package]\nname = "engine"\ndescription = "Fast pricing engine"\n' });
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  pool = new pg.Pool({ connectionString: url });
  await pool.query("INSERT INTO users (id,email,role) VALUES ('usr_a','a@x','admin'),('usr_b','b@x','member')");
  const mirror = async (project: GitProject, dir: string) => {
    mirrorCalls.push(project.id);
    const fullName = project.repo.provider === 'github' ? fixtures[project.repo.fullName] : project.repo.fullName;
    if (!fullName || fullName.startsWith('https:')) throw new Error('offline fixture: no network');
    return ensureMirror({ ...project, repo: { ...project.repo, fullName } }, dir);
  };
  const recentRepos = async () => [
    { fullName: 'acme/old', defaultBranch: 'main', private: false, pushedAt: '2026-10-01T00:00:00Z' },
    { fullName: 'acme/api', defaultBranch: 'main', private: true, pushedAt: '2026-11-26T00:00:00Z' },
    { fullName: 'acme/new', defaultBranch: 'trunk', private: true, pushedAt: '2026-11-27T00:00:00Z' }
  ];
  app = new Hono();
  app.use('*', async (c, next) => { (c as unknown as { set(key: string, value: string): void }).set('userId', c.req.header('x-user') ?? 'usr_a'); await next(); });
  app.route('/api/v1/projects', createProjectsRoute(pool, { mirrorRoot: root, mirror, recentRepos }).app);
}, 60_000);
afterAll(async () => { await pool?.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); rmSync(tmp, { recursive: true, force: true }); });

async function untilCloned(id: string, repoId: string): Promise<Project> {
  for (let i = 0; i < 80; i++) { const p = await get(id); if (p.repos.find((r) => r.id === repoId)?.clonedAt) return p; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('primary repo never cloned');
}

describe('describeRepo (CAPY-179)', () => {
  it('prefers manifest descriptions, then the first README sentence, as one sentence', () => {
    expect(describeRepo({ 'package.json': '{"description":"HTTP API for the Acme storefront"}' })).toBe('HTTP API for the Acme storefront.');
    expect(describeRepo({ 'Cargo.toml': '[package]\ndescription = "Fast pricing engine"' })).toBe('Fast pricing engine.');
    expect(describeRepo({ 'pyproject.toml': '[project]\nname="x"\ndescription = \'Data loaders for ML.\'' })).toBe('Data loaders for ML.');
    expect(describeRepo({ 'README.md': '# T\n\n![b](x.svg)\n\n```sh\nnpm i\n```\n\nA tiny CLI that renames photos. Second sentence.' })).toBe('A tiny CLI that renames photos.');
    expect(describeRepo({ 'README.md': `# T\n\n${'word '.repeat(60)}` })!.length).toBeLessThanOrEqual(160);
    expect(describeRepo({ 'README.md': '# Only a title\n' })).toBeNull();
    expect(describeRepo({})).toBeNull();
  });
});

describe('projects (phase2-29)', () => {
  it('CAPY-177: creates a repoless project; its threads get project codes and the mirror refuses to clone', async () => {
    const { status, body } = await create({ name: 'Notes', source: { kind: 'empty' } });
    expect(status).toBe(201);
    expect(body).toMatchObject({ name: 'Notes', code: 'NOT', repo: null, repos: [], source: { kind: 'empty' }, visibility: 'private', trust: 'untrusted' });
    expect(await threadCode(body.id, 'thr_n1')).toBe('NOT-1');
    await expect(ensureMirror({ id: body.id as never, repo: body.repo as never, trust: 'untrusted' }, root)).rejects.toThrow(/no repository/);
    const legacy = await create({ name: 'Legacy', repo: { fullName: 'acme/legacy', baseBranch: 'main' } });
    expect(legacy.status).toBe(201);
    expect(legacy.body.repos).toMatchObject([{ provider: 'github', fullName: 'acme/legacy', role: 'primary' }]);
  });

  it('CAPY-180: name, emoji icon and uppercase code; threads are numbered per project', async () => {
    const web = await create({ name: 'Web App', icon: '🚀', code: 'web', source: { kind: 'empty' } });
    expect(web.body).toMatchObject({ name: 'Web App', icon: '🚀', code: 'WEB' });
    expect((await create({ name: 'Bad', icon: 'abc', source: { kind: 'empty' } })).status).toBe(400);
    expect((await create({ name: 'Bad', code: '1X', source: { kind: 'empty' } })).status).toBe(400);
    expect((await create({ name: 'Dup', code: 'WEB', source: { kind: 'empty' } })).status).toBe(409);
    expect((await create({ name: 'Web App', source: { kind: 'empty' } })).body.code).toBe('WA');
    expect([await threadCode(web.body.id, 'thr_w1'), await threadCode(web.body.id, 'thr_w2')]).toEqual(['WEB-1', 'WEB-2']);
    const patched = await (await app.request(`http://local/api/v1/projects/${web.body.id}`, json({ name: 'Site', icon: '🌐', code: 'site' }, 'PATCH'))).json() as Project;
    expect(patched).toMatchObject({ name: 'Site', icon: '🌐', code: 'SITE' });
    expect(await threadCode(web.body.id, 'thr_w3')).toBe('SITE-3');
    const reused = await create({ name: 'Web Again', code: 'WEB', source: { kind: 'empty' } });
    expect(await threadCode(reused.body.id, 'thr_r1')).toBe('WEB-3');
  });

  it('CAPY-178/179/181: primary repo mirrors and is described at creation; lazy repos clone on demand', async () => {
    const { status, body } = await create({ name: 'Shop', source: { kind: 'github', fullName: 'acme/api' }, lazy: [{ kind: 'folder', path: fixtures.docs }, { kind: 'git-url', url: `file://${fixtures.engine}` }] });
    expect(status).toBe(201);
    expect(body.repo).toEqual({ provider: 'github', fullName: 'acme/api', baseBranch: 'main' });
    expect(body.repos.map((r) => [r.provider, r.role])).toEqual([['github', 'primary'], ['local', 'lazy'], ['git', 'lazy']]);
    const [primary, docs, engine] = body.repos;
    const ready = await untilCloned(body.id, primary.id);
    expect(ready.repos[0].description).toBe('HTTP API for the Acme storefront.');
    expect(existsSync(join(root, `${body.id}.git`))).toBe(true);
    expect(ready.repos.slice(1).map((r) => r.clonedAt)).toEqual([null, null]);
    expect(existsSync(join(root, `${body.id}--${docs.id}.git`))).toBe(false);
    expect(mirrorCalls.filter((x) => x.startsWith(body.id))).toEqual([body.id]);
    const cloned = await app.request(`http://local/api/v1/projects/${body.id}/repos/${docs.id}/clone`, json({}));
    expect(cloned.status).toBe(200);
    expect(await cloned.json()).toMatchObject({ id: docs.id, role: 'lazy', description: 'The Acme handbook site, built with Astro.' });
    expect(existsSync(join(root, `${body.id}--${docs.id}.git`))).toBe(true);
    const eng = await (await app.request(`http://local/api/v1/projects/${body.id}/repos/${engine.id}/clone`, json({}))).json() as { description: string; clonedAt: string };
    expect(eng.description).toBe('Fast pricing engine.');
    expect(eng.clonedAt).toBeTruthy();
    expect((await app.request(`http://local/api/v1/projects/${body.id}/repos/nope/clone`, json({}))).status).toBe(404);
    expect((await app.request(`http://local/api/v1/projects/${body.id}/repos/${docs.id}/clone`, json({}, 'POST', 'usr_b'))).status).toBe(404);
    const old = await create({ name: 'Billing', source: { kind: 'github', fullName: 'acme/billing' } });
    const oldReady = await untilCloned(old.body.id, old.body.repos[0].id);
    expect([oldReady.repo?.baseBranch, oldReady.repos[0].baseBranch, oldReady.repos[0].description]).toEqual(['master', 'master', 'Legacy billing service.']);
    const mirrorsBefore = readdirSync(root).sort();
    const badPrimary = await create({ name: 'Bad Branch', source: { kind: 'git-url', url: `file://${fixtures.engine}`, baseBranch: 'release' } });
    expect([badPrimary.status, badPrimary.body]).toEqual([409, { error: 'base branch release not found' }]);
    expect((await pool.query("SELECT 1 FROM projects WHERE name='Bad Branch'")).rows).toEqual([]);
    const goodPrimary = await create({ name: 'Main Branch', source: { kind: 'git-url', url: `file://${fixtures.engine}`, baseBranch: 'main' } });
    expect(readdirSync(root).sort()).toEqual([...mirrorsBefore, `${goodPrimary.body.id}.git`].sort());
    expect([goodPrimary.status, goodPrimary.body.repos[0].baseBranch, goodPrimary.body.repos[0].description, Boolean(goodPrimary.body.repos[0].clonedAt)]).toEqual([201, 'main', 'Fast pricing engine.', true]);
    const pinned = await create({ name: 'Pinned', source: { kind: 'empty' }, lazy: [{ kind: 'git-url', url: `file://${fixtures.engine}`, baseBranch: 'release' }] });
    const miss = await app.request(`http://local/api/v1/projects/${pinned.body.id}/repos/${pinned.body.repos[0].id}/clone`, json({}));
    expect([miss.status, await miss.json()]).toEqual([409, { error: 'base branch release not found' }]);
    const kept = await (await app.request(`http://local/api/v1/projects/${pinned.body.id}`, as('usr_a'))).json() as { repos: { baseBranch: string; clonedAt: string | null }[] };
    expect([kept.repos[0].baseBranch, kept.repos[0].clonedAt]).toEqual(['release', null]);
    expect(existsSync(join(root, `${pinned.body.id}--${pinned.body.repos[0].id}.git`))).toBe(false);
  });

  it('CAPY-181: validates GitHub, git URL and folder sources and suggests recently pushed repos', async () => {
    expect((await create({ name: 'X', source: { kind: 'github', fullName: 'not a repo' } })).status).toBe(400);
    expect((await create({ name: 'X', source: { kind: 'git-url', url: 'https://gitlab.example.test/a/b.git' } })).status).toBe(400);
    expect((await create({ name: 'X', source: { kind: 'git-url', url: 'ssh://evil/x' } })).status).toBe(400);
    expect((await create({ name: 'X', source: { kind: 'folder', path: 'relative/dir' } })).status).toBe(400);
    expect((await create({ name: 'X', source: { kind: 'nope' } })).status).toBe(400);
    process.env.FLOTILLA_GIT_HOSTS = 'gitlab.example.test';
    try {
      const lab = await create({ name: 'Lab', source: { kind: 'git-url', url: 'https://gitlab.example.test/a/b.git', baseBranch: 'dev' } });
      expect(lab.status).toBe(201);
      expect(lab.body.repo).toEqual({ provider: 'git', fullName: 'https://gitlab.example.test/a/b.git', baseBranch: 'dev' });
    } finally { delete process.env.FLOTILLA_GIT_HOSTS; }
    const device = await create({ name: 'Laptop', source: { kind: 'folder', path: '/Users/me/src/app', machineId: 'mch_laptop' } });
    expect(device.body.repos[0]).toMatchObject({ provider: 'local', machineId: 'mch_laptop', clonedAt: null });
    const deferred = await app.request(`http://local/api/v1/projects/${device.body.id}/repos/${device.body.repos[0].id}/clone`, json({}));
    expect(deferred.status).toBe(409);
    const suggestions = await (await app.request('http://local/api/v1/projects/suggestions', as('usr_a'))).json() as { fullName: string }[];
    expect(suggestions.map((s) => s.fullName)).toEqual(['acme/new', 'acme/old']);
  });

  it('CAPY-182: projects are private by default; shared projects are visible but only the owner edits', async () => {
    const secret = await create({ name: 'Secret', source: { kind: 'empty' } });
    const team = await create({ name: 'Team', visibility: 'shared', source: { kind: 'empty' } });
    expect(secret.body.visibility).toBe('private');
    expect(team.body.visibility).toBe('shared');
    expect((await create({ name: 'Bad', visibility: 'public', source: { kind: 'empty' } })).status).toBe(400);
    const seen = await (await app.request('http://local/api/v1/projects', as('usr_b'))).json() as Project[];
    expect(seen.map((p) => p.name)).toEqual(['Team']);
    expect((await app.request(`http://local/api/v1/projects/${secret.body.id}`, as('usr_b'))).status).toBe(404);
    expect((await app.request(`http://local/api/v1/projects/${team.body.id}`, as('usr_b'))).status).toBe(200);
    expect((await app.request(`http://local/api/v1/projects/${team.body.id}`, json({ name: 'Mine' }, 'PATCH', 'usr_b'))).status).toBe(404);
    const priv = await (await app.request(`http://local/api/v1/projects/${team.body.id}`, json({ visibility: 'private' }, 'PATCH'))).json() as Project;
    expect(priv.visibility).toBe('private');
    expect((await app.request(`http://local/api/v1/projects/${team.body.id}`, as('usr_b'))).status).toBe(404);
  });
  it('CAPY-181: only admins may use the server GitHub token for suggestions, GitHub sources and clones', async () => {
    process.env.GITHUB_TOKEN = 'fixture-token-not-real';
    try {
      expect(await (await app.request('http://local/api/v1/projects/suggestions', as('usr_b'))).json()).toEqual([]);
      expect((await create({ name: 'Peek', source: { kind: 'github', fullName: 'acme/private' } }, 'usr_b')).status).toBe(403);
      expect((await create({ name: 'Peek', source: { kind: 'git-url', url: 'https://github.com/acme/private.git' } }, 'usr_b')).status).toBe(403);
      expect((await create({ name: 'Peek', repo: { fullName: 'acme/private', baseBranch: 'main' } }, 'usr_b')).status).toBe(403);
      expect((await create({ name: 'Peek', source: { kind: 'empty' }, lazy: [{ kind: 'github', fullName: 'acme/private' }] }, 'usr_b')).status).toBe(403);
      expect((await create({ name: 'Mine', source: { kind: 'folder', path: fixtures.docs } }, 'usr_b')).status).toBe(201);
      const ops = await create({ name: 'Ops', source: { kind: 'empty' }, lazy: [{ kind: 'github', fullName: 'acme/api' }] });
      expect(ops.status).toBe(201);
      await pool.query(`UPDATE users SET role='member' WHERE id='usr_a'`);
      expect((await app.request(`http://local/api/v1/projects/${ops.body.id}/repos/${ops.body.repos[0].id}/clone`, json({}))).status).toBe(403);
    } finally { delete process.env.GITHUB_TOKEN; await pool.query(`UPDATE users SET role='admin' WHERE id='usr_a'`); }
    expect((await create({ name: 'Public', source: { kind: 'github', fullName: 'acme/api' } }, 'usr_b')).status).toBe(201);
  });
});
