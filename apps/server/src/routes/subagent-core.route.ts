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
  app.get('/subagents/:id/progress', async (c) => c.json(await store().progress(c.req.param('id'), userId(c))));
  app.get('/subagents/:id/diff', async (c) => c.json(await store().diff(c.req.param('id'), userId(c))));
  app.post('/subagents/:id/pr', async (c) => c.json(await store().openPr(c.req.param('id'), userId(c)), 201));
  app.post('/subagents/:id/feedback', async (c) => c.json(await store().feedback(c.req.param('id'), userId(c), (await body(c)).text)));
  return { basePath: '/api/v1', app, public: false };
}
export default createSubagentCoreRoute();
