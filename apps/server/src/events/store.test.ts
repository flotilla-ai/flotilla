import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Event } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore, type NewEvent } from './store.js';
import { createStreamRoute } from '../routes/stream.route.js';

const exec = promisify(execFile);
let container = '';
let databaseUrl = '';
let store: EventStore;
const userId = 'usr_test';

async function docker(args: string[]): Promise<string> {
  const out = await exec('docker', args);
  return out.stdout.trim();
}

async function waitPostgres(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      await docker(['exec', container, 'pg_isready', '-U', 'postgres']);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error('postgres did not become ready');
}

async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  return store.pool.query<T>(sql, params);
}

async function makeThread(): Promise<Event['threadId']> {
  const n = Math.random().toString(36).slice(2, 8);
  const id = `thr_${n}` as Event['threadId'];
  await query(
    `INSERT INTO threads (id, code, project_id, role, owner_id, title, status, engine, budget, spent)
     VALUES ($1,$2,NULL,'thread',$3,'test','idle','{}','{}','{}')`,
    [id, `FLO-T${n}`, userId]
  );
  return id;
}

function ev(threadId: Event['threadId'], text: string): NewEvent {
  return { threadId, runId: null, kind: 'agent.message', source: 'adapter', trust: 'trusted', payload: { text } };
}

beforeAll(async () => {
  container = await docker(['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16']);
  const portLine = await docker(['port', container, '5432/tcp']);
  const port = portLine.split(':').pop();
  databaseUrl = `postgres://postgres@127.0.0.1:${port}/postgres`;
  await waitPostgres();
  for (let i = 0; i < 40; i++) {
    try {
      const probe = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 });
      await probe.connect();
      await probe.query('SELECT 1');
      await probe.end();
      break;
    } catch (err) {
      if (i === 39) throw err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  await migrate(databaseUrl);
  store = new EventStore(databaseUrl);
  await query('INSERT INTO users (id, email, role) VALUES ($1,$2,$3)', [userId, 'test@example.invalid', 'admin']);
}, 120000);

afterAll(async () => {
  if (store) await store.close();
  if (container) await docker(['rm', '-f', container]).catch(() => '');
}, 30000);

describe('event store', () => {
  it('keeps seq gap-free per thread under 20 concurrent appends', async () => {
    const threadId = await makeThread();
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.appendEvents(threadId, [ev(threadId, `m${i}`)])));
    const rows = await query<{ seq: number }>('SELECT seq FROM events WHERE thread_id=$1 ORDER BY seq', [threadId]);
    expect(rows.rows.map((r) => r.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('rolls back the event insert when apply throws', async () => {
    const threadId = await makeThread();
    await expect(store.appendEvents(threadId, [ev(threadId, 'rollback')], {
      apply: async () => { throw new Error('projection failed'); }
    })).rejects.toThrow('projection failed');
    const rows = await query('SELECT count(*)::int AS n FROM events WHERE thread_id=$1', [threadId]);
    expect(rows.rows[0].n).toBe(0);
  });

  it('returns original events for a duplicate requestId', async () => {
    const threadId = await makeThread();
    const first = await store.appendEvents(threadId, [ev(threadId, 'once'), ev(threadId, 'batch')], { requestId: 'req-1' });
    expect(first).toHaveLength(2);
    const second = await store.appendEvents(threadId, [ev(threadId, 'twice')], { requestId: 'req-1' });
    expect(second.map((e) => e.id)).toEqual(first.map((e) => e.id));
    const rows = await query('SELECT count(*)::int AS n FROM events WHERE thread_id=$1', [threadId]);
    expect(rows.rows[0].n).toBe(2);
  });

  it('streams replayed events after seq 2 in order and then live events', async () => {
    const threadId = await makeThread();
    for (let i = 1; i <= 5; i++) await store.appendEvents(threadId, [ev(threadId, `seed${i}`)]);
    const route = createStreamRoute(store);
    const res = await route.app.request(`http://local/${threadId}/stream?after=2`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    async function readOne(): Promise<void> {
      const next = await reader.read();
      if (!next.done) text += decoder.decode(next.value);
    }
    await readOne();
    await readOne();
    await readOne();
    await store.appendEvents(threadId, [ev(threadId, 'live')]);
    await readOne();
    await reader.cancel();
    const seqs = [...text.matchAll(/id: (\d+)/g)].map((m) => Number(m[1]));
    expect(seqs.slice(0, 4)).toEqual([3, 4, 5, 6]);
    expect(text).toContain('live');
  }, 15000);

  it('delivers an append on one connection to subscribe on another', async () => {
    const threadId = await makeThread();
    const subscription = await store.subscribe(threadId, 0);
    const iterator = subscription[Symbol.asyncIterator]();
    const next = iterator.next();
    await new Promise((r) => setTimeout(r, 100));
    const [inserted] = await store.appendEvents(threadId, [ev(threadId, 'notify')]);
    const got = await next;
    expect(got.done).toBe(false);
    expect(got.value?.id).toBe(inserted.id);
    await iterator.return?.();
  });

  it('keeps event payloads out of NOTIFY payloads', async () => {
    const threadId = await makeThread();
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const notification = new Promise<string>((resolve, reject) => {
      client.on('notification', (msg) => resolve(msg.payload ?? ''));
      client.on('error', reject);
    });
    await client.query('LISTEN flotilla_events');
    await store.appendEvents(threadId, [ev(threadId, 'secret-shaped-payload')]);
    const payload = JSON.parse(await notification) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['seq', 'threadId']);
    expect(JSON.stringify(payload)).not.toContain('secret-shaped-payload');
    await client.end();
  });
});
