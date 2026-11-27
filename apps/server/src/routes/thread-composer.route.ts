import { Hono, type Context } from 'hono';
import { threadComposer } from '../thread-composer/store.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Composer and reading UX: request cards (+ Undo dismiss), thread-code lookup, reading place, owner-approved feedback. */
export function createThreadComposerRoute(store = () => threadComposer()) {
  const app = new Hono();
  app.get('/thread-lookup', async (c) => c.json({ items: await store().lookup(userId(c), c.req.query('q') ?? '') }));
  app.get('/threads/:id/requests', async (c) => c.json({ items: await store().requests(c.req.param('id'), userId(c)) }));
  app.post('/approvals/:id/undo', async (c) => c.json(await store().undoDismiss(c.req.param('id'), userId(c))));
  app.get('/threads/:id/reading-place', async (c) => c.json(await store().readingPlace(c.req.param('id'), userId(c))));
  app.put('/threads/:id/reading-place', async (c) => c.json(await store().readingPlace(c.req.param('id'), userId(c), await body(c))));
  app.post('/threads/:id/feedback', async (c) => c.json(await store().draftFeedback(c.req.param('id'), userId(c), await body(c)), 201));
  app.post('/approvals/:id/feedback', async (c) => c.json(await store().answerFeedback(c.req.param('id'), userId(c), await body(c))));
  return { basePath: '/api/v1', app, public: false };
}
export default createThreadComposerRoute();
