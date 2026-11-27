import { Hono, type Context } from 'hono';
import { automationStore } from '../automations-core/index.js';
import { defaultRunner } from './threads.route.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Stored automation definitions plus manual and GitHub-trigger entrypoints. */
export function createAutomationsCoreRoute(store = () => automationStore(undefined, { startRun: async ({ threadId, prompt }) => { await defaultRunner().message(threadId, prompt, 'queue'); } })) {
  const app = new Hono();
  app.post('/projects/:id/automations', async (c) => {
    const created = await store().create(userId(c), c.req.param('id'), await body(c));
    c.header('x-flotilla-redact-keys', 'webhookToken,webhookUrl');
    return c.json(created, 201);
  });
  app.get('/projects/:id/automations', async (c) => c.json({ items: await store().list(userId(c), c.req.param('id')) }));
  app.post('/automations/:id/trigger', async (c) => c.json(await store().trigger(userId(c), c.req.param('id'), await body(c)), 202));
  app.post('/automations/:id/github-trigger', async (c) => {
    const b = await body(c);
    return c.json(await store().triggerGithub(userId(c), c.req.param('id'), String(b.event ?? ''), b), 202);
  });
  app.get('/automations/:id/batches', async (c) => c.json({ items: await store().batches(userId(c), c.req.param('id')) }));
  app.post('/automations/:id/batches/:batch/flush', async (c) => c.json(await store().flushBatch(userId(c), c.req.param('id'), c.req.param('batch')), 202));
  app.post('/automations/:id/batches/:batch/cancel', async (c) => c.json(await store().cancelBatch(userId(c), c.req.param('id'), c.req.param('batch'))));
  return { basePath: '/api/v1', app, public: false };
}
export default createAutomationsCoreRoute();
