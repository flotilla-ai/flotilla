import { Hono } from 'hono';
import type { Event } from '@flotilla/core/types';
import { EventStore } from '../events/store.js';
import { SSE_RETRY_MS, frameType } from '../api-platform/types.js';

function sse(event: Event, publicFrames: boolean, first: boolean): Uint8Array {
  const type = frameType(event.kind);
  const data = publicFrames ? { type, ...event } : event;
  return new TextEncoder().encode(`${first ? `retry: ${SSE_RETRY_MS}\n` : ''}id: ${event.seq}\nevent: ${publicFrames ? type : event.kind}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createStreamRoute(store: EventStore): { basePath: string; app: Hono; public: boolean } {
  const app = new Hono().get('/:id/stream', async (c) => {
    const threadId = c.req.param('id') as Event['threadId'];
    const userId = (c as unknown as { get(key: string): string | undefined }).get('userId');
    if (userId) {
      const owner = await store.pool.query('SELECT 1 FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]);
      if (!owner.rows[0]) return c.json({ error: 'not found' }, 404);
    }
    const after = Number.parseInt(c.req.header('last-event-id') ?? c.req.query('after') ?? '0', 10) || 0;
    const publicFrames = c.req.query('frames') === 'public';
    let first = true;
    const subscription = await store.subscribe(threadId, after);
    const iterator = subscription[Symbol.asyncIterator]();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        void (async () => {
          try {
            for (;;) {
              const next = await iterator.next();
              if (next.done) break;
              controller.enqueue(sse(next.value, publicFrames, first));
              first = false;
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        })();
      },
      async cancel() {
        await iterator.return?.();
      }
    });
    return new Response(body, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive'
      }
    });
  });
  return { basePath: '/api/v1/threads', app, public: false };
}

const store = new EventStore(process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla');

export default createStreamRoute(store);
