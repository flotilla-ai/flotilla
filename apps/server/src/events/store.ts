import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { Event } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';

export type NewEvent = Omit<Event, 'id' | 'seq' | 'at'>;
export type Tx = { query: pg.PoolClient['query'] };

function id(): Event['id'] {
  return `evt_${randomBytes(16).toString('base64url')}` as Event['id'];
}

function toEvent(row: {
  id: string; thread_id: string; seq: number; run_id: string | null; kind: Event['kind'];
  at: Date | string; source: Event['source']; trust: Event['trust']; payload: unknown;
}): Event {
  return {
    id: row.id as Event['id'],
    seq: row.seq,
    threadId: row.thread_id as Event['threadId'],
    runId: row.run_id as Event['runId'],
    kind: row.kind,
    at: row.at instanceof Date ? row.at.toISOString() : row.at,
    source: row.source,
    trust: row.trust,
    payload: row.payload
  };
}

const eventColumns = 'id, thread_id, seq, run_id, kind, at, source, trust, payload';

export class EventStore {
  readonly pool: pg.Pool;
  private readonly databaseUrl: string;
  private migrated?: Promise<unknown>;

  constructor(databaseUrl: string, pool?: pg.Pool) {
    this.databaseUrl = databaseUrl;
    this.pool = pool ?? new pg.Pool({ connectionString: databaseUrl, max: 4 });
  }

  private ensureMigrated(): Promise<unknown> {
    if (!this.migrated) {
      const running = migrate(this.databaseUrl);
      this.migrated = running;
      running.catch(() => {
        if (this.migrated === running) this.migrated = undefined;
      });
    }
    return this.migrated;
  }

  async appendEvents(
    threadId: Event['threadId'],
    events: NewEvent[],
    opts: { requestId?: string; apply?: (tx: Tx) => Promise<void> } = {}
  ): Promise<Event[]> {
    if (events.length === 0) return [];
    await this.ensureMigrated();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [threadId]);
      if (opts.requestId) {
        const existing = await client.query(
          `SELECT ${eventColumns} FROM events WHERE thread_id = $1 AND request_id = $2 ORDER BY seq`,
          [threadId, opts.requestId]
        );
        if (existing.rows.length > 0) {
          await client.query('ROLLBACK');
          return existing.rows.map(toEvent);
        }
      }

      const max = await client.query<{ max: number | null }>('SELECT max(seq) FROM events WHERE thread_id = $1', [threadId]);
      let seq = (max.rows[0]?.max ?? 0) + 1;
      const inserted: Event[] = [];
      for (const event of events) {
        const row = {
          id: id(), threadId, seq, runId: event.runId ?? null, kind: event.kind,
          source: event.source, trust: event.trust, payload: event.payload ?? null
        };
        const result = await client.query(
          `INSERT INTO events (id, thread_id, seq, run_id, kind, source, trust, payload, request_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${eventColumns}`,
          [row.id, threadId, seq, row.runId, row.kind, row.source, row.trust, row.payload, opts.requestId ?? null]
        );
        inserted.push(toEvent(result.rows[0]));
        seq += 1;
      }
      if (opts.apply) await opts.apply({ query: client.query.bind(client) });
      for (const event of inserted) {
        await client.query('SELECT pg_notify($1, $2)', ['flotilla_events', JSON.stringify({ threadId, seq: event.seq })]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      if (opts.requestId && typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        const existing = await this.pool.query(
          `SELECT ${eventColumns} FROM events WHERE thread_id = $1 AND request_id = $2 ORDER BY seq`,
          [threadId, opts.requestId]
        );
        if (existing.rows.length > 0) return existing.rows.map(toEvent);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async listAfter(threadId: Event['threadId'], afterSeq: number, limit = 1000): Promise<Event[]> {
    await this.ensureMigrated();
    const rows = await this.pool.query(
      `SELECT ${eventColumns} FROM events WHERE thread_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`,
      [threadId, afterSeq, limit]
    );
    return rows.rows.map(toEvent);
  }

  async subscribe(threadId: Event['threadId'], afterSeq = 0): Promise<AsyncIterable<Event>> {
    await this.ensureMigrated();
    const client = new pg.Client({ connectionString: this.pool.options.connectionString });
    await client.connect();
    await client.query('LISTEN flotilla_events');
    return new EventSubscription(client, threadId, afterSeq);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class EventSubscription implements AsyncIterable<Event>, AsyncIterator<Event> {
  private last: number;
  private waiters: (() => void)[] = [];
  private ended = false;

  constructor(private client: pg.Client, private threadId: Event['threadId'], afterSeq: number) {
    this.last = afterSeq;
    client.on('notification', (msg) => {
      if (!msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload) as { threadId?: string; seq?: number };
        if (payload.threadId === threadId) this.wake();
      } catch {
        // Notifications carry only ids; malformed payloads are ignored as wakes.
      }
    });
  }

  private wake(): void {
    for (const wake of this.waiters.splice(0)) wake();
  }

  private async waitForWake(): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 1000);
      this.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async next(): Promise<IteratorResult<Event>> {
    while (!this.ended) {
      const rows = await this.client.query(
        `SELECT ${eventColumns} FROM events WHERE thread_id = $1 AND seq > $2 ORDER BY seq LIMIT 100`,
        [this.threadId, this.last]
      );
      if (rows.rows.length > 0) {
        const event = toEvent(rows.rows[0]);
        this.last = event.seq;
        return { value: event, done: false };
      }
      await this.waitForWake();
    }
    return { value: undefined, done: true };
  }

  async return(): Promise<IteratorResult<Event>> {
    this.ended = true;
    this.wake();
    await this.client.end();
    return { value: undefined, done: true };
  }

  [Symbol.asyncIterator](): AsyncIterator<Event> {
    return this;
  }
}
