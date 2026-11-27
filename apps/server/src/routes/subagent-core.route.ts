import { Hono, type Context } from 'hono';
import { subagentCore } from '../subagent-core/store.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, any>;

/** Subagents: draft, edit, start, read progress, review the diff, open a PR, send feedback. */
export function createSubagentCoreRoute(store = () => subagentCore()) {
  const app = new Hono();
  app.get('/threads/:id/subagents', async (c) => c.json({ items: await store().list(c.req.param('id'), userId(c)) }));
  app.post('/threads/:id/subagents', async (c) => c.json(await store().create(c.req.param('id'), userId(c), (await body(c)) as never), 201));
  app.get('/subagents/:id', async (c) => c.json(await store().get(c.req.param('id'), userId(c))));
  app.patch('/subagents/:id', async (c) => c.json(await store().update(c.req.param('id'), userId(c), await body(c))));
  app.post('/subagents/:id/start', async (c) => c.json(await store().start(c.req.param('id'), userId(c))));
  app.get('/subagents/:id/messages', async (c) => c.json(await store().messages(c.req.param('id'), userId(c), Number(c.req.query('after') ?? 0), Number(c.req.query('limit') ?? 100))));
  app.get('/subagents/:id/stream', async (c) => {
    const id = c.req.param('id'); await store().get(id, userId(c));
    const events = store().deps.runner.deps.store; const after = Number.parseInt(c.req.header('last-event-id') ?? c.req.query('after') ?? '0', 10) || 0;
    const subscription = await events.subscribe(id as never, after); const iterator = subscription[Symbol.asyncIterator](); let first = true;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        void (async () => {
          try {
            for (;;) {
              const next = await iterator.next(); if (next.done) break;
              controller.enqueue(new TextEncoder().encode(`${first ? 'retry: 1000\n' : ''}id: ${next.value.seq}\nevent: ${next.value.kind}\ndata: ${JSON.stringify(next.value)}\n\n`)); first = false;
            }
            controller.close();
          } catch (err) { controller.error(err); }
        })();
      },
      async cancel() { await iterator.return?.(); }
    });
    return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' } });
  });
  app.get('/subagents/:id/progress', async (c) => c.json(await store().progress(c.req.param('id'), userId(c))));
  app.get('/subagents/:id/diff', async (c) => c.json(await store().diff(c.req.param('id'), userId(c))));
  app.post('/subagents/:id/pr', async (c) => c.json(await store().openPr(c.req.param('id'), userId(c)), 201));
  app.post('/subagents/:id/feedback', async (c) => c.json(await store().feedback(c.req.param('id'), userId(c), (await body(c)).text)));
  return { basePath: '/api/v1', app, public: false };
}
export default createSubagentCoreRoute();
