import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';

const exec = promisify(execFile);
type Who = 'owner' | 'bob' | 'carol';
let container = ''; let url = ''; let pool: pg.Pool; let app: Hono; let es: EventStore;
const users: Record<Who, { id: string; token: string }> = {} as never;
let n = 0;

async function call(who: Who, path: string, method = 'GET', json?: unknown): Promise<{ status: number; body: any }> {
  const headers = new Headers({ authorization: `Bearer ${users[who].token}` });
  if (json !== undefined) headers.set('content-type', 'application/json');
  const res = await app.request(`http://local/api/v1${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}
const verb = (who: Who, id: string, name: string, json: unknown = {}) => call(who, `/threads/${id}/${name}`, 'POST', json);
async function thread(opts: { status?: string; visibility?: string } = {}): Promise<string> {
  const id = `thr_api${++n}`;
  await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent,visibility) VALUES ($1,$2,'thread',$3,'Initial title',$4,$5,$7,$8,$6)`,
    [id, `FLO-A${n}`, users.owner.id, opts.status ?? 'idle', JSON.stringify({ adapter: 'fake', model: null, effort: null, connectionId: null }), opts.visibility ?? 'private', JSON.stringify({ maxUsd: null, maxTokens: null, maxWallSec: null, scope: 'thread', onHit: 'pause-and-ask', warnAt: 0.8 }), JSON.stringify({ usd: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0 })]);
  await es.appendEvents(id as never, [{ runId: null, kind: 'thread.created', source: 'kernel', trust: 'trusted', payload: { title: 'Initial title' } }, { runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: { text: 'Fix the flaky login test in the auth package please' } }] as never);
  return id;
}
const lastSeq = async (id: string): Promise<number> => (await pool.query('SELECT COALESCE(max(seq),0)::int s FROM events WHERE thread_id=$1', [id])).rows[0].s;

/** Reads public SSE frames after `after` until `count` frames arrive or 5 s pass. */
async function frames(who: Who, id: string, after: number, count: number, during?: () => Promise<unknown>): Promise<{ status: number; ended?: boolean; frames: { id: number; event: string; data: any }[] }> {
  const res = await app.request(`http://local/api/v1/threads/${id}/stream?frames=public`, { headers: { authorization: `Bearer ${users[who].token}`, 'last-event-id': String(after) } });
  if (res.status !== 200) return { status: res.status, frames: [] };
  await during?.();
  const reader = res.body!.getReader(); const out: { id: number; event: string; data: any }[] = []; let text = ''; let ended = false;
  const deadline = Date.now() + 5000;
  while (out.length < count && Date.now() < deadline) {
    const next = await Promise.race([reader.read(), new Promise<null>((r) => setTimeout(() => r(null), deadline - Date.now()))]);
    if (!next || next.done) { ended = !!next; break; }
    text += new TextDecoder().decode(next.value);
    const blocks = text.split('\n\n'); text = blocks.pop()!;
    for (const b of blocks) {
      const f = Object.fromEntries(b.split('\n').filter((l) => /^(id|event|data): /.test(l)).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 2)]));
      out.push({ id: Number(f.id), event: f.event, data: JSON.parse(f.data) });
    }
  }
  await reader.cancel();
  return { status: 200, ended, frames: out };
}
const actions = (f: { data: any }[]) => f.map((x) => `${x.data.type}:${x.data.payload.action}`);

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
  app = await (await import('../loader.js')).createApp();
  for (const [name, id] of [['owner', ownerId], ['bob', 'usr_bob'], ['carol', 'usr_carol']] as const) {
    if (name !== 'owner') await pool.query(`INSERT INTO users (id,email,role) VALUES ($1,$2,'member')`, [id, `${name}@x`]);
    const s = await auth.createSession(id);
    const minted = await app.request('http://local/api/v1/api-keys', { method: 'POST', headers: { cookie: `flotilla_session=${s.id}`, 'x-flotilla-csrf': s.csrfToken, 'content-type': 'application/json' }, body: JSON.stringify({ name: `${name}-ci` }) });
    users[name] = { id, token: ((await minted.json()) as { token: string }).token };
  }
}, 60_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('thread lifecycle public API (bearer keys)', () => {
  it('CAPY-544: POST /threads/:id/rename returns the thread and emits a status frame', async () => {
    const id = await thread(); const seq = await lastSeq(id);
    const res = await verb('owner', id, 'rename', { title: 'Login flake' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, title: 'Login flake', titleSource: 'user', ownerId: users.owner.id });
    expect((await verb('owner', id, 'rename', { title: '' })).body).toMatchObject({ code: 'flotilla/ValidationFailed' });
    expect((await verb('carol', id, 'rename', { title: 'x' })).body).toMatchObject({ code: 'flotilla/NotFound' });
    const s = await frames('owner', id, seq, 1);
    expect(s.frames[0]).toMatchObject({ event: 'status', data: { type: 'status', kind: 'thread.status', payload: { action: 'renamed', title: 'Login flake', by: users.owner.id } } });
  });

  it('CAPY-545/546: archive and unarchive round-trip with status frames; active threads cannot be archived', async () => {
    const id = await thread(); const seq = await lastSeq(id);
    expect((await verb('owner', id, 'archive')).body).toMatchObject({ status: 'archived', archivedAt: expect.any(String) });
    expect((await call('owner', `/threads/${id}`)).body).toMatchObject({ status: 'archived' });
    expect((await verb('owner', id, 'unarchive')).body).toMatchObject({ status: 'idle', archivedAt: null });
    expect((await verb('owner', await thread({ status: 'working' }), 'archive')).body).toMatchObject({ code: 'flotilla/Conflict' });
    expect(actions((await frames('owner', id, seq, 2)).frames)).toEqual(['status:archived', 'status:unarchived']);
  });

  it('CAPY-547: POST /threads/:id/takeover moves ownership of a shared thread and streams the transfer', async () => {
    expect((await verb('bob', await thread(), 'takeover')).body).toMatchObject({ code: 'flotilla/NotFound' });
    const id = await thread({ visibility: 'shared' }); const seq = await lastSeq(id);
    expect((await verb('bob', id, 'takeover')).body).toMatchObject({ ownerId: users.bob.id, member: { joined: true, subscribed: true } });
    const f = (await frames('owner', id, seq, 1)).frames;
    expect(f[0].data.payload).toMatchObject({ action: 'takeover', from: users.owner.id, to: users.bob.id });
  });

  it('CAPY-548: POST /threads/:id/regenerate-title returns an auto title of at most 50 chars and streams it', async () => {
    const id = await thread(); const seq = await lastSeq(id);
    await verb('owner', id, 'rename', { title: 'Pinned by hand' });
    const res = await verb('owner', id, 'regenerate-title');
    expect(res.body.titleSource).toBe('auto');
    expect(res.body.title.length).toBeLessThanOrEqual(50);
    expect(res.body.title.startsWith('Fix the flaky login test')).toBe(true);
    const f = (await frames('owner', id, seq, 2)).frames;
    expect(f.map((x) => x.data.payload)).toMatchObject([{ action: 'renamed' }, { action: 'title-regenerated', title: res.body.title }]);
  });

  it('CAPY-549/550: read and unread return the viewer read state and emit no shared frame', async () => {
    const id = await thread({ visibility: 'shared' });
    await verb('bob', id, 'join');
    await es.appendEvents(id as never, [{ runId: null, kind: 'agent.message', source: 'adapter', trust: 'untrusted', payload: { text: 'hey @bob step one is done' } }] as never);
    expect((await call('bob', `/threads/${id}/lifecycle`)).body).toMatchObject({ unread: true, unreadCount: 1, mentions: 1 });
    const seq = await lastSeq(id);
    expect((await verb('bob', id, 'read')).body).toEqual({ threadId: id, unread: false, unreadCount: 0, mentions: 0, lastReadSeq: seq, markedUnread: false });
    expect((await verb('bob', id, 'unread')).body).toEqual({ threadId: id, unread: true, unreadCount: 0, mentions: 0, lastReadSeq: seq, markedUnread: true });
    expect((await call('owner', `/threads/${id}/lifecycle`)).body).toMatchObject({ unread: true, unreadCount: 1 });
    expect((await verb('carol', await thread(), 'read')).body).toMatchObject({ code: 'flotilla/NotFound' });
    await verb('owner', id, 'rename', { title: 'after read' });
    expect(actions((await frames('owner', id, seq, 1)).frames)).toEqual(['status:renamed']);
  });

  it('CAPY-551..554: join, leave, subscribe and unsubscribe return membership; join/leave stream', async () => {
    const id = await thread({ visibility: 'shared' }); const seq = await lastSeq(id);
    expect((await verb('bob', id, 'join')).body.member).toMatchObject({ userId: users.bob.id, joined: true, subscribed: true });
    expect((await verb('bob', id, 'unsubscribe')).body.member).toMatchObject({ joined: true, subscribed: false });
    expect((await verb('bob', id, 'subscribe')).body.member).toMatchObject({ joined: true, subscribed: true });
    expect((await verb('bob', id, 'leave')).body.member).toMatchObject({ joined: false, subscribed: false });
    expect((await verb('owner', id, 'leave')).body).toMatchObject({ code: 'flotilla/Conflict' });
    expect((await verb('carol', await thread(), 'join')).body).toMatchObject({ code: 'flotilla/NotFound' });
    expect(actions((await frames('owner', id, seq, 2)).frames)).toEqual(['status:joined', 'status:left']);
    const priv = await thread({ visibility: 'shared' });
    await verb('carol', priv, 'join');
    await pool.query(`UPDATE threads SET visibility='private' WHERE id=$1`, [priv]);
    const leave = () => app.request(`http://local/api/v1/threads/${priv}/leave`, { method: 'POST', headers: { authorization: `Bearer ${users.carol.token}`, 'idempotency-key': `leave-${priv}` } });
    expect((await leave()).status).toBe(204);
    const replay = await leave();
    expect([replay.status, replay.headers.get('idempotent-replayed')]).toEqual([204, 'true']);
  });

  it('collaborators: joined or shared viewers can open detail, messages and the live stream; strangers cannot', async () => {
    const shared = await thread({ visibility: 'shared' });
    await verb('bob', shared, 'join');
    const priv = await thread();
    await pool.query('INSERT INTO thread_members (thread_id,user_id,joined) VALUES ($1,$2,true)', [priv, users.bob.id]);
    for (const id of [shared, priv]) {
      expect((await call('bob', `/threads/${id}`)).body).toMatchObject({ id });
      expect((await call('bob', `/threads/${id}/messages`)).body.map((e: { kind: string }) => e.kind)).toContain('user.message');
      const s = await frames('bob', id, 0, 1);
      expect(s.status).toBe(200);
      expect(s.frames[0]).toMatchObject({ id: 1, event: 'status', data: { kind: 'thread.created' } });
    }
    expect((await call('carol', `/threads/${shared}`)).status).toBe(200);
    for (const path of [`/threads/${priv}`, `/threads/${priv}/messages`]) expect((await call('carol', path)).status).toBe(404);
    expect((await frames('carol', priv, 0, 1)).status).toBe(404);
  });

  it('collaborators: an open stream ends when the viewer loses access, before any later frame', async () => {
    const id = await thread({ visibility: 'shared' });
    const s = await frames('bob', id, 0, 5, async () => {
      await call('owner', `/threads/${id}/lifecycle`, 'POST', { action: 'visibility', visibility: 'private' });
      await verb('owner', id, 'rename', { title: 'Private now' });
    });
    expect(s.ended).toBe(true);
    expect(s.frames.map((f) => f.data.kind)).toEqual(['thread.created', 'user.message']);
  });
});
