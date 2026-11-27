import { execFile, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AgentAdapter, ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { DEFAULT_LIMITS, tar, untar, type DriveScope } from './types.js';
import type { DriveStore } from './store.js';

const exec = promisify(execFile);
let container = ''; let url = ''; let pool: pg.Pool; let app: Hono; let store: DriveStore;
const users: Record<string, { id: string; cookie: string; csrf: string }> = {};
const dir = mkdtempSync(join(tmpdir(), 'flt-drive-'));
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function* () { let rest = ''; for await (const c of stream) { rest += c.toString(); const p = rest.split('\n'); rest = p.pop()!; for (const x of p) yield x; } if (rest) yield rest; })(); }
const local: ProcessTransport = { spawn(argv, opts) { const child = spawn(argv[0], argv.slice(1), { cwd: process.cwd(), env: { ...process.env, ...opts.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); return { stdout: lines(child.stdout!), stderr: lines(child.stderr!), exit: new Promise((r) => child.once('exit', (code, signal) => r({ code, signal }))), signal: async (sig) => { try { if (child.pid) process.kill(-child.pid, sig); } catch { /* exited */ } } } satisfies ProcessHandle; } };

async function call(who: string, path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers); headers.set('cookie', users[who].cookie); headers.set('x-flotilla-csrf', users[who].csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
const json = async (r: Response) => (await r.json()) as any;
const put = (who: string, scope: string, path: string, body: string | Buffer, extra = '') => call(who, `/drive/files?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(path)}${extra}`, { method: 'PUT', body: typeof body === 'string' ? body : new Uint8Array(body), headers: { 'content-type': 'application/octet-stream' } });
async function thread(ownerId: string, extra: { projectId?: string; role?: string } = {}): Promise<Record<string, any>> {
  const id = `thr_${Math.random().toString(16).slice(2, 10)}`;
  return (await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$1,$2,$3,$4,'t','idle','{}','{}','{}') RETURNING *`, [id, extra.projectId ?? null, extra.role ?? 'thread', ownerId])).rows[0];
}
const project = async (name: string, ownerId: string) => (await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ($1,$2,$1,'{}','untrusted','{}') RETURNING id`, [`prj_${name}`, ownerId])).rows[0].id as string;
const fakeDriver = () => { const copied: Buffer[] = []; return { copied, out: tar([]), fail: false, async copyIn(_id: string, at: string, t: Buffer) { if (this.fail) throw new Error('no space left on device'); expect(at).toBe('/run'); copied.push(t); }, async copyOut() { return this.out; } }; };

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const p = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  url = `postgres://postgres@127.0.0.1:${p}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url; process.env.FLOTILLA_DRIVE_DIR = dir;
  pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js');
  const auth = authStore(url);
  const admin = (await auth.setup('admin@x', 'pw', await auth.getSetupToken()))!.userId;
  const s = (await auth.login('admin@x', 'pw'))!; users.admin = { id: admin, cookie: `flotilla_session=${s.id}`, csrf: s.csrfToken };
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_drive_member','member@x','member')`);
  const m = await auth.createSession('usr_drive_member'); users.member = { id: 'usr_drive_member', cookie: `flotilla_session=${m.id}`, csrf: m.csrfToken };
  store = (await import('./store.js')).driveStore(url);
  app = await (await import('../loader.js')).createApp();
}, 60_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('drive core', () => {
  it('CAPY-272: org, personal, project, project+personal, automation and per-Captain drives are separate and access-checked', async () => {
    const p = await project('scopes', users.admin.id); const cap = await thread(users.admin.id, { role: 'captain' });
    for (const scope of ['org', 'user', `project:${p}`, `project-user:${p}`, `captain:${cap.id}`, 'automation:aut_nightly']) expect((await put('admin', scope, 'notes.md', `in ${scope}`)).status).toBe(200);
    const scopes = (await json(await call('admin', '/drive/scopes'))).items.map((s: any) => s.scope.kind);
    expect(scopes).toEqual(expect.arrayContaining(['org', 'user', 'project', 'project-user', 'captain', 'automation']));
    const items = await json(await call('admin', `/drive/items?scope=${encodeURIComponent(`project-user:${p}`)}`));
    expect(await (await call('admin', `/drive/items/${items.items[0].id}/content`)).text()).toBe(`in project-user:${p}`);
    expect((await json(await call('member', '/drive/items?scope=user'))).items).toEqual([]);
    expect((await call('member', `/drive/items?scope=project:${p}`)).status).toBe(404);
    expect((await call('member', `/drive/items/${items.items[0].id}/content`)).status).toBe(404);
    expect((await call('member', `/drive/items?scope=automation:aut_nightly`)).status).toBe(404);
    expect((await json(await call('member', '/drive/items?scope=org'))).items.map((i: any) => i.name)).toEqual(['notes.md']);
    expect((await put('member', 'org', 'x.md', 'no')).status).toBe(403);
    expect((await put('admin', 'nope', 'x.md', 'no')).status).toBe(400);
    expect((await put('admin', 'user', '../x.md', 'no')).status).toBe(400);
  });

  it('CAPY-273/274: root AGENTS.md and skills/<name>/SKILL.md of each thread scope are mounted and supplied to the run', async () => {
    const p = await project('mount', users.admin.id);
    await put('admin', 'org', 'AGENTS.md', 'Org rule: be brief.');
    await put('admin', `project:${p}`, 'AGENTS.md', 'Project rule: run pnpm test.');
    await put('admin', `project:${p}`, 'docs/AGENTS.md', 'not a root file');
    await put('admin', 'user', 'skills/release-notes/SKILL.md', '# Release notes');
    await put('admin', 'user', 'skills/Bad Name/SKILL.md', 'ignored');
    const t = await thread(users.admin.id, { projectId: p }); const d = fakeDriver();
    const note = await store.mount({ thread: t, containerId: 'c1', driver: d });
    const files = d.copied.flatMap((c) => untar(c).map((f) => f.name));
    expect(files).toEqual(expect.arrayContaining(['flotilla/drive/org/AGENTS.md', 'flotilla/drive/project/AGENTS.md', 'flotilla/drive/project/docs/AGENTS.md', 'flotilla/drive/personal/skills/release-notes/SKILL.md']));
    expect(note).toContain('Org rule: be brief.'); expect(note).toContain('Project rule: run pnpm test.'); expect(note).not.toContain('not a root file');
    expect(note).toContain('release-notes: /run/flotilla/drive/personal/skills/release-notes/SKILL.md'); expect(note).not.toContain('Bad Name');
    const view = await json(await call('admin', `/threads/${t.id}/drive`));
    expect(view.skills).toEqual([{ scope: { kind: 'user', id: users.admin.id }, name: 'release-notes', path: '/run/flotilla/drive/personal/skills/release-notes/SKILL.md' }]);
    expect(view.mounts.find((m: any) => m.scope.kind === 'org')).toMatchObject({ dir: '/run/flotilla/drive/org', writable: true });
    const other = await thread(users.member.id);
    expect((await json(await call('member', `/threads/${other.id}/drive`))).mounts.find((m: any) => m.scope.kind === 'org').writable).toBe(false);
    expect((await call('member', `/threads/${t.id}/drive`)).status).toBe(404);
  });

  it('CAPY-275: files the thread saves into its Drive are autosaved as versions by the thread, with no git commit', async () => {
    const t = await thread(users.admin.id); const d = fakeDriver();
    await put('admin', 'user', 'plan.md', 'v1');
    await store.mount({ thread: t, containerId: 'c2', driver: d });
    d.out = tar([{ name: 'drive/personal/plan.md', data: Buffer.from('v2 by agent') }, { name: 'drive/personal/new/report.md', data: Buffer.from('report') }, { name: 'drive/org/AGENTS.md', data: Buffer.from('Org rule: be brief.') }]);
    const saved = await store.writeBack({ thread: t, containerId: 'c2', driver: d });
    expect(saved.map((s) => s.path).sort()).toEqual(['new/report.md', 'plan.md']);
    const plan = saved.find((s) => s.path === 'plan.md')!;
    expect((await json(await call('admin', `/drive/items/${plan.id}/versions`))).items.map((v: any) => [v.version, v.by, v.source])).toEqual([[2, t.id, 'agent'], [1, users.admin.id, 'upload']]);
    expect(await (await call('admin', `/drive/items/${plan.id}/content`)).text()).toBe('v2 by agent');
    expect((await store.writeBack({ thread: t, containerId: 'c2', driver: d }))).toEqual([]);
  });

  it('CAPY-276: browse folders, edit, upload up to 32 MB, delete', async () => {
    expect((await put('admin', 'user', 'site/index.md', '# Home')).status).toBe(200);
    const root = await json(await call('admin', '/drive/items?scope=user'));
    const folder = root.items.find((i: any) => i.name === 'site'); expect(folder).toMatchObject({ type: 'folder', path: 'site' });
    const inside = await json(await call('admin', `/drive/items?scope=user&parent=site`));
    expect(inside.items.map((i: any) => [i.name, i.type, i.size])).toEqual([['index.md', 'file', 6]]);
    const edited = await json(await put('admin', 'user', 'site/index.md', '# Home v2', `&baseVersion=1`));
    expect(edited).toMatchObject({ version: 2, size: 9 });
    expect((await put('admin', 'user', 'site/index.md', 'stale', `&baseVersion=1`)).status).toBe(409);
    const big = await put('admin', 'user', 'big.bin', Buffer.alloc(DEFAULT_LIMITS.uploadBytes + 1));
    expect(big.status).toBe(413); expect((await json(big)).card).toMatchObject({ code: 'upload_too_large', title: 'Upload is larger than 32 MB' });
    expect(DEFAULT_LIMITS.uploadBytes).toBe(32_000_000);
    expect((await call('admin', `/drive/items/${folder.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await json(await call('admin', `/drive/items?scope=user&parent=site`))).items).toEqual([]);
    expect((await call('admin', `/drive/items/${inside.items[0].id}/content`)).status).toBe(404);
  });

  it('CAPY-277: a local copy is a point-in-time archive of the thread Drives, with no background sync', async () => {
    const t = await thread(users.admin.id);
    await put('admin', 'user', 'local.md', 'before');
    const r = await call('admin', `/threads/${t.id}/drive/copy`);
    expect(r.headers.get('x-flotilla-drive-sync')).toBe('none');
    const copy = untar(Buffer.from(await r.arrayBuffer()));
    await put('admin', 'user', 'local.md', 'after');
    expect(copy.find((f) => f.name === 'personal/local.md')?.data.toString()).toBe('before');
  });

  it('CAPY-278: history keeps every version (no 24 h expiry) and restore makes a new version', async () => {
    await put('admin', 'user', 'hist.md', 'one'); const item = await json(await put('admin', 'user', 'hist.md', 'two'));
    await pool.query(`UPDATE drive_versions SET at=now()-interval '3 days' WHERE item_id=$1 AND version=1`, [item.id]);
    const restored = await json(await call('admin', `/drive/items/${item.id}/restore`, { method: 'POST', json: { version: 1 } }));
    expect(restored).toMatchObject({ version: 3, size: 3 });
    expect(await (await call('admin', `/drive/items/${item.id}/content`)).text()).toBe('one');
    expect((await json(await call('admin', `/drive/items/${item.id}/versions`))).items.map((v: any) => [v.version, v.source])).toEqual([[3, 'restore'], [2, 'upload'], [1, 'upload']]);
    expect((await call('member', `/drive/items/${item.id}/restore`, { method: 'POST', json: { version: 1 } })).status).toBe(404);
  });

  it('CAPY-279/502: 100 MiB per file, quota per Drive with a Drive is full card, and usage past 2 GiB', async () => {
    const { DriveStore } = await import('./store.js');
    const small = new DriveStore(url, dir, { uploadBytes: 50, fileBytes: 100, quotaBytes: 200 });
    const scope: DriveScope = { kind: 'automation', id: 'aut_quota' };
    await small.save(scope, 'a.txt', Buffer.alloc(100), { by: users.admin.id, source: 'agent' });
    await expect(small.save(scope, 'b.txt', Buffer.alloc(101), { by: users.admin.id, source: 'agent' })).rejects.toMatchObject({ card: { code: 'file_too_large' } });
    await small.save(scope, 'b.txt', Buffer.alloc(100), { by: users.admin.id, source: 'agent' });
    await expect(small.save(scope, 'c.txt', Buffer.alloc(1), { by: users.admin.id, source: 'agent' })).rejects.toMatchObject({ card: { code: 'drive_full', title: 'Drive is full' } });
    await small.save(scope, 'b.txt', Buffer.alloc(10), { by: users.admin.id, source: 'agent' });
    expect(DEFAULT_LIMITS.fileBytes).toBe(100 * 1024 * 1024);
    const gib = 1024 ** 3; const big: DriveScope = { kind: 'automation', id: 'aut_big' };
    const roomy = new DriveStore(url, dir, { ...DEFAULT_LIMITS, quotaBytes: 5 * gib });
    const seed = await roomy.save(big, 'seed.bin', Buffer.from('x'), { by: users.admin.id, source: 'agent' });
    await pool.query(`UPDATE drive_items SET size=$2 WHERE id=$1`, [seed.id, 3 * gib]);
    expect(await roomy.usage(big)).toMatchObject({ usedBytes: 3 * gib, limitBytes: 5 * gib, full: false });
    await roomy.save(big, 'more.bin', Buffer.from('y'), { by: users.admin.id, source: 'agent' });
    const tight = new DriveStore(url, dir, { ...DEFAULT_LIMITS, quotaBytes: 3 * gib });
    await expect(tight.save(big, 'over.bin', Buffer.from('z'), { by: users.admin.id, source: 'agent' })).rejects.toMatchObject({ card: { code: 'drive_full' } });
  });

  it('CAPY-503: mount and save failures open a card that explains the next step; runs still start', async () => {
    const t = await thread(users.admin.id); const d = fakeDriver(); d.fail = true;
    expect(await store.mount({ thread: t, containerId: 'c3', driver: d })).toBe('');
    const { DriveStore } = await import('./store.js');
    const full = new DriveStore(url, dir, { ...DEFAULT_LIMITS, quotaBytes: 1 });
    d.out = tar([{ name: 'drive/personal/huge.md', data: Buffer.from('too much') }]);
    expect(await full.writeBack({ thread: t, containerId: 'c3', driver: d })).toEqual([]);
    const cards = (await pool.query(`SELECT question,options,blocking,detail FROM approvals WHERE thread_id=$1 ORDER BY detail->'drive'->>'code'`, [t.id])).rows;
    expect(cards.map((c) => [c.detail.drive.code, c.blocking])).toEqual([['drive_full', false], ['mount_failed', false]]);
    expect(cards[1].question).toContain('Drive could not be mounted'); expect(cards[1].question).toContain('send the message again');
    expect(cards[0].question).toContain('Drive is full'); expect(cards[0].question).toContain('Delete files');
  });

  it('runner seam: Drive is copied in before the run, its note reaches the prompt, and edits are saved after it', async () => {
    const { ThreadRunner } = await import('../runner/runner.js'); const { EventStore } = await import('../events/store.js');
    const mod = (await import('../modules/drive-core.module.js')).default; const stop = await mod.start();
    const prompts: string[] = []; const adapter = Object.assign(Object.create(fakeAdapter), { start: (i: Parameters<AgentAdapter['start']>[0]) => { prompts.push(i.prompt); return fakeAdapter.start(i); } }) as AgentAdapter;
    const d = { ...fakeDriver(), startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => local, stop: async () => undefined };
    d.out = tar([{ name: 'drive/personal/from-run.md', data: Buffer.from('saved by run') }]);
    const runner = new ThreadRunner({ store: new EventStore(url), driver: d as never, adapters: new Map([['fake', adapter]]) });
    try {
      const t = await runner.createThread({ ownerId: users.admin.id, title: 'drive', prompt: 'hello' });
      for (let i = 0; i < 100 && !(await pool.query(`SELECT 1 FROM drive_items WHERE path='from-run.md'`)).rows[0]; i++) await new Promise((r) => setTimeout(r, 100));
      expect(prompts[0]).toContain('Org rule: be brief.');
      expect(d.copied.some((c) => untar(c).some((f) => f.name === 'flotilla/drive/org/AGENTS.md'))).toBe(true);
      const [row] = (await pool.query(`SELECT v.by FROM drive_items i JOIN drive_versions v ON v.item_id=i.id WHERE i.path='from-run.md'`)).rows;
      expect(row.by).toBe(t.id);
    } finally { await runner.drain(); await stop(); }
  }, 30_000);
});
