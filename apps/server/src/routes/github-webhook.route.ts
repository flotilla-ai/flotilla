import { Hono } from 'hono';
import { verifyWebhook } from '../github/sync.js';
import { getCheckMonitor } from '../github/registry.js';
import { handleCheckRunWebhook } from '../github/webhook.js';
import { defaultWakeRouter } from './wakes.route.js';
import { automationStore } from '../automations-core/index.js';
import { automationRuntimeDeps } from '../automations-core/runtime.js';
import { reviewPushFromWebhook } from '../review-core/index.js';
import { reviewCoreStore } from './review-core.route.js';
import { handlePrCommentWebhook } from '../pr-mentions/index.js';
import { prMentionsStore, liveMentionGateway } from './pr-mentions.route.js';
import { defaultRunner } from './threads.route.js';
const defaultEvent = async (body: unknown, event: string) => { if (event === 'pull_request') await reviewPushFromWebhook(reviewCoreStore(), body as never); if (event === 'issue_comment') { const mention = await handlePrCommentWebhook(prMentionsStore(), reviewCoreStore(), liveMentionGateway(), defaultRunner(), body as never); if (!mention?.handled) await defaultWakeRouter().github(event, body as never); else if ((mention as any).threadId) { const repo=(body as any).repository?.full_name; const number=(body as any).issue?.number; await prMentionsStore().pool.query(`UPDATE wake_watches SET state='fired' WHERE thread_id=$1 AND kind='pr' AND target=$2 AND state='active' AND payload->>'what'<>'checks'`,[(mention as any).threadId,`${repo}#${number}`]); } return; } if (event !== 'check_run') { await defaultWakeRouter().github(event, body as never); return; } const monitor = getCheckMonitor(); if (monitor) await handleCheckRunWebhook(monitor, body as never); await defaultWakeRouter().checksDone(body as never); };
const defaultAutomation = async (body: Record<string, unknown>, event: string, delivery: string | null) => automationStore(undefined, automationRuntimeDeps()).githubEvent(event, { ...body, delivery_id: delivery });
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
