import { Hono } from 'hono';
import { verifyWebhook } from '../github/sync.js';
import { getCheckMonitor } from '../github/registry.js';
import { handleCheckRunWebhook } from '../github/webhook.js';
import { defaultWakeRouter } from './wakes.route.js';
import { automationStore } from '../automations-core/index.js';
import { defaultRunner } from './threads.route.js';
const defaultEvent = async (body: unknown, event: string) => { if (event !== 'check_run') { await defaultWakeRouter().github(event, body as never); return; } const monitor = getCheckMonitor(); if (monitor) await handleCheckRunWebhook(monitor, body as never); await defaultWakeRouter().checksDone(body as never); };
const defaultAutomation = async (body: Record<string, unknown>, event: string, delivery: string | null) => automationStore(undefined, { startRun: async ({ threadId, prompt }) => { await defaultRunner().message(threadId, prompt, 'queue'); } }).githubEvent(event, { ...body, delivery_id: delivery });
export function createGithubWebhookRoute(secret = process.env.GITHUB_WEBHOOK_SECRET ?? '', onEvent?: (body: unknown, event: string) => Promise<void>, onAutomation: (body: Record<string, unknown>, event: string, delivery: string | null) => Promise<unknown> = defaultAutomation) {
  const eventHandler = onEvent ?? defaultEvent; const automationHandler = onEvent ? async () => undefined : onAutomation;
  const app = new Hono();
  app.post('/github', async (c) => {
    const body = await c.req.text();
    if (!secret || !verifyWebhook(secret, body, c.req.header('x-hub-signature-256') ?? null)) return c.json({ error: 'bad signature' }, 401);
    const parsed = JSON.parse(body) as Record<string, unknown>; const eventName = c.req.header('x-github-event') ?? 'check_run';
    await eventHandler(parsed, eventName);
    await automationHandler(parsed, eventName, c.req.header('x-github-delivery') ?? null);
    return c.body(null, 202);
  });
  return { basePath: '/api/v1/webhooks', app, public: true };
}
export default createGithubWebhookRoute();
