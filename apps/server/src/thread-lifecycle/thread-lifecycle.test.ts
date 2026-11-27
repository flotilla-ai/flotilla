import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import type { ThreadLifecycleStore } from './store.js';

const exec = promisify(execFile);
let container = ''; let url = ''; let pool: pg.Pool; let app: Hono; let es: EventStore; let store: ThreadLifecycleStore; let stopListen: () => Promise<void>;
const users: Record<'owner' | 'bob' | 'carol', { id: string; cookie: string; csrf: string }> = {} as never;
let n = 0;

function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function*(){let rest='';for await(const c of stream){rest+=c.toString();const p=rest.split('\n');rest=p.pop()!;for(const x of p)yield x;}if(rest)yield rest;})(); }
const localTransport: ProcessTransport = { spawn(argv,opts) { const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:{...process.env,...opts.env},detached:true,stdio:['ignore','pipe','pipe']}); return { stdout:lines(child.stdout!),stderr:lines(child.stderr!),exit:new Promise((r)=>child.once('exit',(code,signal)=>r({code,signal}))),signal:async(sig)=>{if(child.pid)process.kill(-child.pid,sig)} } satisfies ProcessHandle; } };
const driver = { startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => localTransport, copyIn: async () => undefined, copyOut: async () => Buffer.from(''), stop: async () => undefined };

async function call(who: keyof typeof users, path: string, method = 'GET', json?: unknown): Promise<{ status: number; body: any }> {
  const headers = new Headers({ cookie: users[who].cookie, 'x-flotilla-csrf': users[who].csrf });
  if (json !== undefined) headers.set('content-type', 'application/json');
  const res = await app.request(`http://local/api/v1${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
const act = (who: keyof typeof users, id: string, body: Record<string, unknown>) => call(who, `/threads/${id}/lifecycle`, 'POST', body);
async function thread(opts: { owner?: string; status?: string; visibility?: string; connectionId?: string } = {}): Promise<string> {
  const id = `thr_t${++n}`;
  await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent,visibility) VALUES ($1,$2,'thread',$3,'Initial title',$4,$5,$7,$8,$6)`,
    [id, `FLO-T${n}`, opts.owner ?? users.owner.id, opts.status ?? 'idle', JSON.stringify({ adapter: 'fake', model: null, effort: null, connectionId: opts.connectionId ?? null }), opts.visibility ?? 'private', JSON.stringify({ maxUsd: null, maxTokens: null, maxWallSec: null, scope: 'thread', onHit: 'pause-and-ask', warnAt: 0.8 }), JSON.stringify({ usd: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0 })]);
  await es.appendEvents(id as never, [{ runId: null, kind: 'thread.created', source: 'kernel', trust: 'trusted', payload: { title: 'Initial title' } }, { runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: { text: 'Fix the flaky login test in the auth package please' } }] as never);
  return id;
}
const agentSays = (id: string, text: string) => es.appendEvents(id as never, [{ runId: null, kind: 'agent.delta', source: 'adapter', trust: 'untrusted', payload: { text } }] as never);
const row = async (id: string) => (await pool.query('SELECT * FROM threads WHERE id=$1', [id])).rows[0];
async function until(check: () => Promise<boolean>): Promise<void> { for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error('timed out'); }

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  process.env.DATABASE_URL = url;
  pool = new pg.Pool({ connectionString: url });
  es = new EventStore(url);
  const { authStore } = await import('../auth/store.js');
  const auth = authStore(url);
  const ownerId = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  for (const [name, id] of [['owner', ownerId], ['bob', 'usr_bob'], ['carol', 'usr_carol']] as const) {
    if (name !== 'owner') await pool.query(`INSERT INTO users (id,email,role) VALUES ($1,$2,'member')`, [id, `${name}@x`]);
    const s = await auth.createSession(id);
    users[name] = { id, cookie: `flotilla_session=${s.id}`, csrf: s.csrfToken };
  }
  store = (await import('./store.js')).threadLifecycle(url);
  stopListen = await store.listen();
  app = await (await import('../loader.js')).createApp();
}, 60_000);
afterAll(async () => { await stopListen?.(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('thread lifecycle', () => {
  it('CAPY-017: rename, regenerate with org+personal instructions (<=50 chars), regenerate-when setting', async () => {
    const id = await thread();
    expect((await act('owner', id, { action: 'rename', title: 'Login flake' })).body).toMatchObject({ title: 'Login flake', titleSource: 'user' });
    expect((await act('owner', id, { action: 'rename', title: '' })).status).toBe(400);
    expect((await call('bob', '/thread-settings/org', 'PUT', { titleInstructions: 'x' })).status).toBe(403);
    expect((await call('owner', '/thread-settings/org', 'PUT', { titleInstructions: 'Start with a verb' })).status).toBe(200);
    expect((await call('owner', '/thread-settings/me', 'PUT', { titleInstructions: 'No ticket ids', regenerateWhen: 'each-message' })).body).toMatchObject({ regenerateWhen: 'each-message' });
    const seen: { messages: string[]; instructions: string[] }[] = [];
    store.titles = async (input) => { seen.push(input); return `Fix ${input.messages.at(-1)} ${'and more words '.repeat(6)}`; };
    const regen = await act('owner', id, { action: 'regenerate-title' });
    expect(seen[0]).toEqual({ messages: ['Fix the flaky login test in the auth package please'], instructions: ['Start with a verb', 'No ticket ids'] });
    expect(regen.body.title.length).toBeLessThanOrEqual(50);
    expect(regen.body).toMatchObject({ titleSource: 'auto' });
    await es.appendEvents(id as never, [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: { text: 'now the signup page', by: users.owner.id } }] as never);
    await until(async () => (await row(id)).title.startsWith('Fix now the signup page'));
    const { heuristicTitle } = await import('./store.js');
    store.titles = heuristicTitle;
    const auto = await heuristicTitle({ messages: ['  please   investigate why the nightly deploy pipeline keeps timing out on large repos '], instructions: [] });
    expect(auto).toBe('please investigate why the nightly deploy pipeline');
    await act('owner', id, { action: 'rename', title: 'Pinned name' });
    await es.appendEvents(id as never, [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: { text: 'more', by: users.owner.id } }] as never);
    await new Promise((r) => setTimeout(r, 500));
    expect((await row(id)).title).toBe('Pinned name');
    await call('owner', '/thread-settings/me', 'PUT', { regenerateWhen: null });
  });

  it('CAPY-018: archive keeps events dormant; unarchive (undo) starts no run; a message unarchives and runs with prior context', async () => {
    const id = await thread({ status: 'waiting' });
    expect((await act('owner', id, { action: 'archive' })).body).toMatchObject({ status: 'archived' });
    expect((await row(id)).archived_at).not.toBeNull();
    const events = (await pool.query('SELECT count(*)::int c FROM events WHERE thread_id=$1', [id])).rows[0].c;
    expect((await act('owner', id, { action: 'unarchive' })).body).toMatchObject({ status: 'waiting', archivedAt: null });
    expect((await pool.query('SELECT count(*)::int c FROM runs WHERE thread_id=$1', [id])).rows[0].c).toBe(0);
    expect((await pool.query(`SELECT payload FROM events WHERE thread_id=$1 AND kind='thread.status' ORDER BY seq`, [id])).rows.map((r) => r.payload.action)).toEqual(['archived', 'unarchived']);
    await act('owner', id, { action: 'archive' });
    expect((await pool.query('SELECT count(*)::int c FROM events WHERE thread_id=$1', [id])).rows[0].c).toBe(events + 2);
    const runner = new ThreadRunner({ store: es, driver: driver as never, adapters: new Map([['fake', fakeAdapter]]) });
    await runner.message(id, 'continue', 'queue', users.owner.id);
    await until(async () => { const t = await row(id); return t.archived_at === null && t.status !== 'archived' && t.status !== 'working'; });
    expect((await pool.query(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='run.ended'`, [id])).rows).toHaveLength(1);
    expect((await pool.query(`SELECT kind FROM events WHERE thread_id=$1 AND seq<=2 ORDER BY seq`, [id])).rows.map((r) => r.kind)).toEqual(['thread.created', 'user.message']);
    expect((await act('owner', await thread({ status: 'working' }), { action: 'archive' })).status).toBe(409);
  });

  it('CAPY-019: bulk archive, tag, file, pin and delete report per-thread results', async () => {
    const ids = [await thread(), await thread(), await thread()];
    const foreign = await thread({ owner: users.bob.id });
    const bulk = (body: Record<string, unknown>) => call('owner', '/threads/bulk', 'POST', { threadIds: [...ids, foreign], ...body });
    expect((await bulk({ action: 'pin' })).body.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, true, true, false]);
    await bulk({ action: 'tag', tag: 'auth' }); await bulk({ action: 'file', folder: 'Q4' }); await bulk({ action: 'archive' });
    const rows = (await pool.query('SELECT pinned,tags,folder,status FROM threads WHERE id=ANY($1) ORDER BY id', [ids])).rows;
    expect(rows.every((r) => r.pinned && r.tags.includes('auth') && r.folder === 'Q4' && r.status === 'archived')).toBe(true);
    expect((await row(foreign))).toMatchObject({ pinned: false, folder: null });
    expect((await call('owner', '/threads/bulk', 'POST', { threadIds: ids, action: 'rename' })).status).toBe(400);
    expect((await bulk({ action: 'delete' })).body.results.at(-1)).toMatchObject({ ok: false, code: 'flotilla/NotFound' });
    expect((await pool.query('SELECT count(*)::int c FROM threads WHERE id=ANY($1)', [ids])).rows[0].c).toBe(0);
  });

  it('CAPY-020: delete is a real hard delete and owner-only for private threads', async () => {
    const id = await thread();
    await pool.query(`INSERT INTO runs (id,thread_id,ordinal,trigger,state,usage) VALUES ('run_del',$1,1,'{}','completed','{}')`, [id]);
    await pool.query(`INSERT INTO cost_entries (thread_id,run_id,source,model,delta) VALUES ($1,'run_del','vendor-usd','m','{}')`, [id]);
    await pool.query(`INSERT INTO secrets (id,scope,scope_id,name,sealed,key_id) VALUES ('sec_del','thread',$1,'X','\\x00','k')`, [id]);
    await pool.query('INSERT INTO thread_members (thread_id,user_id,joined) VALUES ($1,$2,true)', [id, users.bob.id]);
    expect((await call('bob', `/threads/${id}`, 'DELETE')).status).toBe(403);
    expect((await call('carol', `/threads/${id}`, 'DELETE')).status).toBe(404);
    expect((await call('owner', `/threads/${id}`, 'DELETE')).status).toBe(204);
    for (const table of ['threads WHERE id', 'events WHERE thread_id', 'runs WHERE thread_id', 'cost_entries WHERE thread_id', 'thread_members WHERE thread_id', `secrets WHERE scope='thread' AND scope_id`])
      expect((await pool.query(`SELECT 1 FROM ${table}=$1`, [id])).rows).toHaveLength(0);
    const shared = await thread({ visibility: 'shared' });
    await act('bob', shared, { action: 'join' });
    expect((await call('bob', `/threads/${shared}`, 'DELETE')).status).toBe(204);
    expect((await call('owner', `/threads/${await thread({ status: 'working' })}`, 'DELETE')).status).toBe(409);
  });

  it('CAPY-021: read/unread state and unread mention badge per viewer', async () => {
    const id = await thread({ visibility: 'shared' });
    await act('bob', id, { action: 'join' });
    await agentSays(id, 'done with step one');
    const view = async (who: keyof typeof users) => (await call(who, `/threads/${id}/lifecycle`)).body;
    expect(await view('owner')).toMatchObject({ unread: true, unreadCount: 1, mentions: 0 });
    expect((await act('owner', id, { action: 'read' })).body).toMatchObject({ unread: false, unreadCount: 0 });
    await agentSays(id, 'hey @bob can you review?');
    expect(await view('bob')).toMatchObject({ unread: true, unreadCount: 2, mentions: 1 });
    expect(await view('owner')).toMatchObject({ unread: true, unreadCount: 1, mentions: 0 });
    await act('bob', id, { action: 'read' });
    expect(await view('bob')).toMatchObject({ unread: false, mentions: 0 });
    expect((await act('bob', id, { action: 'unread' })).body).toMatchObject({ unread: true, unreadCount: 0 });
  });

  it('CAPY-022: join, leave, subscribe and unsubscribe', async () => {
    const id = await thread({ visibility: 'shared' });
    expect((await act('bob', id, { action: 'join' })).body.member).toMatchObject({ joined: true, subscribed: true });
    expect((await call('bob', '/me/threads')).body.items.map((t: { id: string }) => t.id)).toContain(id);
    expect((await act('bob', id, { action: 'unsubscribe' })).body.member).toMatchObject({ joined: true, subscribed: false });
    expect((await act('bob', id, { action: 'subscribe' })).body.member).toMatchObject({ subscribed: true });
    expect((await act('bob', id, { action: 'leave' })).body.member).toMatchObject({ joined: false, subscribed: false });
    expect((await call('bob', '/me/threads')).body.items.map((t: { id: string }) => t.id)).not.toContain(id);
    expect((await act('owner', id, { action: 'leave' })).status).toBe(409);
    expect((await act('bob', await thread(), { action: 'join' })).status).toBe(404);
    expect((await pool.query(`SELECT payload->>'action' a FROM events WHERE thread_id=$1 AND kind='thread.status' ORDER BY seq`, [id])).rows.map((r) => r.a)).toEqual(['joined', 'left']);
  });

  it('CAPY-023: take over a shared thread; the previous owner stays a member', async () => {
    const id = await thread({ visibility: 'shared', connectionId: 'conn_owner' });
    expect((await act('bob', await thread(), { action: 'takeover' })).status).toBe(404);
    const res = await act('bob', id, { action: 'takeover' });
    expect(res.body).toMatchObject({ ownerId: users.bob.id, member: { joined: true } });
    expect((await row(id)).engine.connectionId).toBeNull();
    expect((await call('owner', `/threads/${id}/lifecycle`)).body.member).toMatchObject({ joined: true });
    const ev = (await pool.query(`SELECT payload FROM events WHERE thread_id=$1 AND kind='thread.status' ORDER BY seq DESC LIMIT 1`, [id])).rows[0].payload;
    expect(ev).toMatchObject({ action: 'takeover', from: users.owner.id, to: users.bob.id });
    const left = await thread({ visibility: 'shared' });
    await act('carol', left, { action: 'join' });
    await act('owner', left, { action: 'visibility', visibility: 'private' });
    expect((await act('carol', left, { action: 'leave' })).status).toBe(204);
    expect((await act('carol', left, { action: 'takeover' })).status).toBe(404);
    await act('owner', left, { action: 'visibility', visibility: 'shared' });
    await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_own',$1,'p','{}','trusted','{}')`, [users.owner.id]);
    await pool.query(`UPDATE threads SET project_id='prj_own' WHERE id=$1`, [left]);
    expect((await act('carol', left, { action: 'takeover' })).status).toBe(409);
  });

  it('CAPY-024: share dialog transfers ownership; connections reset, vendor logins never move', async () => {
    const id = await thread({ connectionId: 'conn_owner' });
    await pool.query(`INSERT INTO secrets (id,scope,scope_id,name,sealed,key_id) VALUES ('sec_own','personal',$1,'ANTHROPIC_API_KEY','\\x00','k')`, [users.owner.id]);
    expect((await act('owner', id, { action: 'visibility', visibility: 'shared' })).body).toMatchObject({ visibility: 'shared' });
    expect((await act('bob', id, { action: 'transfer', toUserId: users.carol.id })).status).toBe(403);
    expect((await act('owner', id, { action: 'transfer', toUserId: 'usr_nobody' })).status).toBe(404);
    expect((await act('owner', id, { action: 'transfer', toUserId: users.carol.id })).body).toMatchObject({ ownerId: users.carol.id });
    expect((await row(id)).engine).toMatchObject({ adapter: 'fake', connectionId: null });
    expect((await pool.query(`SELECT scope_id FROM secrets WHERE scope='personal'`)).rows.map((r) => r.scope_id)).toEqual([users.owner.id]);
    expect((await act('owner', id, { action: 'transfer', toUserId: users.bob.id })).status).toBe(403);
  });

  it('CAPY-473: idle auto-archive is off by default and skips pinned, open-PR and active threads', async () => {
    const old = async (opts: Parameters<typeof thread>[0] = {}) => { const id = await thread(opts); await pool.query(`UPDATE events SET at=now()-interval '10 days' WHERE thread_id=$1`, [id]); return id; };
    const idle = await old(); const pinned = await old(); const openPr = await old(); const mergedPr = await old(); const working = await old({ status: 'working' }); const fresh = await thread();
    await pool.query('UPDATE threads SET pinned=true WHERE id=$1', [pinned]);
    await pool.query(`INSERT INTO prs (repo,number,thread_id,head_branch) VALUES ('o/r',1,$1,'b'),('o/r',2,$2,'b')`, [openPr, mergedPr]);
    await es.appendEvents(mergedPr as never, [{ runId: null, kind: 'pr.merged', source: 'github', trust: 'trusted', payload: { repo: 'o/r', number: 2 } }] as never);
    await pool.query(`UPDATE events SET at=now()-interval '10 days' WHERE thread_id=$1`, [mergedPr]);
    expect(await store.archiveIdle()).toEqual([]);
    await call('owner', '/thread-settings/org', 'PUT', { autoArchiveDays: 7 });
    expect((await store.archiveIdle()).sort()).toEqual([idle, mergedPr].sort());
    for (const id of [pinned, openPr, working, fresh]) expect((await row(id)).status).not.toBe('archived');
    await call('owner', '/thread-settings/org', 'PUT', { autoArchiveDays: null });
  });

  it('CAPY-474: mark all as read includes archived threads', async () => {
    const a = await thread(); const b = await thread(); await agentSays(a, 'x'); await agentSays(b, 'y');
    await act('owner', b, { action: 'archive' });
    expect((await call('owner', '/threads/read-all', 'POST', {})).status).toBe(200);
    const all = (await call('owner', '/me/threads?archived=all')).body.items as { id: string; unread: boolean }[];
    expect(all.filter((t) => t.id === a || t.id === b).map((t) => t.unread)).toEqual([false, false]);
  });

  it('CAPY-475: thread cost by token kind, model and machine', async () => {
    const id = await thread();
    await pool.query(`UPDATE threads SET machine_id='mac_1' WHERE id=$1`, [id]);
    await pool.query(`INSERT INTO runs (id,thread_id,ordinal,trigger,state,usage) VALUES ('run_c',$1,1,'{}','completed','{}')`, [id]);
    const cost = (source: string, model: string | null, d: Record<string, number>) => pool.query('INSERT INTO cost_entries (thread_id,run_id,source,model,delta) VALUES ($1,$2,$3,$4,$5)', [id, 'run_c', source, model, JSON.stringify({ usd: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0, ...d })]);
    await cost('token-estimate', 'sonnet', { usd: 300, inputTokens: 100, outputTokens: 20, cacheTokens: 50 });
    await cost('token-estimate', 'sonnet', { usd: 200, inputTokens: 10, outputTokens: 5 });
    await cost('vendor-usd', 'gpt-5', { usd: 1000, inputTokens: 7, outputTokens: 3 });
    await cost('machine-estimate', null, { usd: 40, machineSec: 120 });
    const body = (await call('owner', `/threads/${id}/cost`)).body;
    expect(body.total).toEqual({ usd: 1540, inputTokens: 117, outputTokens: 28, cacheTokens: 50, machineSec: 120 });
    expect(body.byKind).toEqual({ input: 117, output: 28, cache: 50 });
    expect(body.byModel).toEqual([{ model: 'gpt-5', inputTokens: 7, outputTokens: 3, cacheTokens: 0, usd: 1000 }, { model: 'sonnet', inputTokens: 110, outputTokens: 25, cacheTokens: 50, usd: 500 }]);
    expect(body.byMachine).toEqual([{ machineId: 'mac_1', machineSec: 120, usd: 40 }]);
    expect((await call('bob', `/threads/${id}/cost`)).status).toBe(404);
  });
});
