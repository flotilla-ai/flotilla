import { Hono } from 'hono';
import type { Event } from '@flotilla/core/types';
import { EventStore } from '../events/store.js';

function sse(event: Event): Uint8Array {
  return new TextEncoder().encode(`id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function createStreamRoute(store: EventStore): { basePath: string; app: Hono; public: boolean } {
  const app = new Hono().get('/threads/:id/stream', async (c) => {
    const threadId = c.req.param('id') as Event['threadId'];
    const after = Number.parseInt(c.req.query('after') ?? '0', 10) || 0;
    const subscription = await store.subscribe(threadId, after);
    const iterator = subscription[Symbol.asyncIterator]();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        void (async () => {
          try {
            for (;;) {
              const next = await iterator.next();
              if (next.done) break;
              controller.enqueue(sse(next.value));
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
  return { basePath: '/api/v1', app, public: false };
}

const store = new EventStore(process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla');

export default createStreamRoute(store);
