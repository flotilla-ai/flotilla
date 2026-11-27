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
const listDirs = (b: Buffer) => { const out: string[] = []; for (let o = 0; o + 512 <= b.length; o += 512) { const h = b.subarray(o, o + 512); if (h[156] === 0x35) { out.push(h.subarray(0, 100).toString().replace(/\0.*$/s, '')); expect(h.subarray(100, 107).toString()).toBe('0000755'); expect(h.subarray(108, 115).toString()).toBe('0001000'); } } return out; };
const fakeDriver = () => { const copied: Buffer[] = []; return { copied, out: tar([]), fail: false, async copyIn(_id: string, at: string, t: Buffer) { if (this.fail) throw new Error('no space left on device'); expect(at).toBe('/run'); copied.push(t); }, async copyOut(_id?: string, _p?: string, _max?: number): Promise<Buffer> { return this.out; } }; };

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
    const dirs = d.copied.flatMap((c) => listDirs(c));
    expect(dirs).toEqual(expect.arrayContaining(['flotilla/', 'flotilla/drive/', 'flotilla/drive/personal/', 'flotilla/drive/personal/skills/release-notes/', 'flotilla/drive/project-personal/']));
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
    await expect(small.save(scope, 'b.txt', Buffer.alloc(10), { by: users.admin.id, source: 'agent' })).rejects.toMatchObject({ card: { code: 'drive_full' } });
    await small.remove(await small.item(users.admin.id, (await small.list(scope)).find((i) => i.path === 'a.txt')!.id, true));
    expect((await small.usage(scope)).usedBytes).toBe(100);
    expect(DEFAULT_LIMITS.fileBytes).toBe(100 * 1024 * 1024);
    const gib = 1024 ** 3; const big: DriveScope = { kind: 'automation', id: 'aut_big' };
    const roomy = new DriveStore(url, dir, { ...DEFAULT_LIMITS, quotaBytes: 5 * gib });
    const seed = await roomy.save(big, 'seed.bin', Buffer.from('x'), { by: users.admin.id, source: 'agent' });
    await pool.query(`UPDATE drive_versions SET size=$2 WHERE item_id=$1`, [seed.id, 3 * gib]);
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
    const lost = fakeDriver(); await store.mount({ thread: t, containerId: 'c4', driver: lost }); lost.copyOut = async (_id?: string, _p?: string, max?: number) => { expect(max).toBe(512 * 1024 * 1024); throw new Error('/run/flotilla/drive is larger than 536870912 bytes'); };
    expect(await store.writeBack({ thread: t, containerId: 'c4', driver: lost })).toEqual([]);
    const cards = (await pool.query(`SELECT question,options,blocking,detail FROM approvals WHERE thread_id=$1 ORDER BY detail->'drive'->>'code'`, [t.id])).rows;
    expect(cards.map((c) => [c.detail.drive.code, c.blocking])).toEqual([['drive_full', false], ['mount_failed', false], ['save_failed', false]]);
    expect(cards[2].question).toContain('larger than 536870912 bytes');
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

  it('CAPY-280: share links have read/write access settings, can be revoked, and appear in the shared view', async () => {
    const item = await json(await put('admin', 'user', 'shared.md', 'share v1'));
    const created = await json(await call('admin', `/drive/items/${item.id}/shares`, { method: 'POST', json: { access: 'read' } }));
    expect(created).toMatchObject({ access: 'read', itemId: item.id });
    expect(created.token).toMatch(/^dsh_/);
    expect(created.url).toContain(created.token);
    const shared = await json(await call('admin', '/drive/shares'));
    expect(shared.items.some((s: any) => s.id === created.id && s.path === 'shared.md')).toBe(true);
    const pub = await app.request(`http://local/api/v1/drive/shared/${created.token}/content`);
    expect(pub.status).toBe(200); expect(await pub.text()).toBe('share v1');
    expect((await app.request(`http://local/api/v1/drive/shared/${created.token}/content`, { method: 'PUT', body: 'no' })).status).toBe(403);
    const write = await json(await call('admin', `/drive/items/${item.id}/shares`, { method: 'POST', json: { access: 'write' } }));
    const wr = await app.request(`http://local/api/v1/drive/shared/${write.token}/content`, { method: 'PUT', body: 'share v2' });
    expect(wr.status).toBe(200); expect(await (await call('admin', `/drive/items/${item.id}/content`)).text()).toBe('share v2');
    const tooBig = await app.request(`http://local/api/v1/drive/shared/${write.token}/content`, { method: 'PUT', body: new Uint8Array(DEFAULT_LIMITS.uploadBytes + 1) });
    expect(tooBig.status).toBe(413);
    expect((await app.request('http://local/api/v1/drive/shared/dsh_missing/content')).status).toBe(404);
    expect((await call('admin', `/drive/shares/${created.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await app.request(`http://local/api/v1/drive/shared/${created.token}/content`)).status).toBe(404);
    await call('admin', `/drive/items/${item.id}`, { method: 'DELETE' });
    await put('admin', 'user', 'shared.md', 'replacement');
    expect((await app.request(`http://local/api/v1/drive/shared/${write.token}/content`, { method: 'PUT', body: 'stale' })).status).toBe(404);
  });

  it('CAPY-281/282: concurrent append-only edits merge, version contents can be picked, and two versions compare', async () => {
    const item = await json(await put('admin', 'user', 'merge.md', 'base\n'));
    const current = await json(await put('admin', 'user', 'merge.md', 'base\nfirst\n', '&baseVersion=1'));
    expect(current.version).toBe(2);
    const merged = await json(await put('admin', 'user', 'merge.md', 'base\nsecond\n', '&baseVersion=1'));
    expect(merged.version).toBe(3);
    const latest=await call('admin', `/drive/items/${item.id}/content`);expect(latest.headers.get('x-flotilla-drive-version')).toBe('3');expect(await latest.text()).toBe('base\nfirst\nsecond\n');
    expect((await put('admin', 'user', 'merge.md', 'replacement', '&baseVersion=1')).status).toBe(409);
    for (const [v, text] of [[1, 'base\n'], [2, 'base\nfirst\n'], [3, 'base\nfirst\nsecond\n']] as const) {
      const r = await call('admin', `/drive/items/${item.id}/versions/${v}/content`);
      expect(r.status).toBe(200); expect(await r.text()).toBe(text);
    }
    const cmp = await json(await call('admin', `/drive/items/${item.id}/compare?a=1&b=3`));
    expect(cmp).toMatchObject({ a: 1, b: 3 }); expect(cmp.diff).toContain('+first'); expect(cmp.diff).toContain('+second');
  });

  it('CAPY-283: Drive mount copy for a new machine is built in under one second', async () => {
    for (let i = 0; i < 50; i++) await put('admin', 'user', `fast/f${i}.md`, `file ${i}`);
    const t = await thread(users.admin.id); const d = fakeDriver(); const start = performance.now();
    const note = await store.mount({ thread: t, containerId: 'c-fast', driver: d });
    const ms = performance.now() - start;
    expect(note).toContain('Drive files are in');
    expect(d.copied.flatMap((c) => untar(c)).length).toBeGreaterThanOrEqual(50);
    expect(ms).toBeLessThan(1000);
  });
});
