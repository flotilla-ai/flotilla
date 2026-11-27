import { Hono } from 'hono';
import { verifyWebhook } from '../github/sync.js';
import { getCheckMonitor } from '../github/registry.js';
import { handleCheckRunWebhook } from '../github/webhook.js';
import { defaultWakeRouter } from './wakes.route.js';
export function createGithubWebhookRoute(secret = process.env.GITHUB_WEBHOOK_SECRET ?? '', onEvent: (body: unknown, event: string) => Promise<void> = async (body, event) => { if (event !== 'check_run') { await defaultWakeRouter().github(event, body as never); return; } const monitor = getCheckMonitor(); if (monitor) await handleCheckRunWebhook(monitor, body as never); await defaultWakeRouter().checksDone(body as never); }) {
  const app = new Hono();
  app.post('/github', async (c) => {
    const body = await c.req.text();
    if (!secret || !verifyWebhook(secret, body, c.req.header('x-hub-signature-256') ?? null)) return c.json({ error: 'bad signature' }, 401);
    await onEvent(JSON.parse(body), c.req.header('x-github-event') ?? 'check_run');
    return c.body(null, 202);
  });
  return { basePath: '/api/v1/webhooks', app, public: true };
}
export default createGithubWebhookRoute();
