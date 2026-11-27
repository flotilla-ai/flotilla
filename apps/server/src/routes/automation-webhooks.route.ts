import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { automationStore } from '../automations-core/index.js';

async function limitedJson(c: Context): Promise<{ payload: Record<string, unknown>; raw: string }> {
  if (Number(c.req.header('content-length') ?? 0) > 256 * 1024) throw new ApiFailure('PayloadTooLarge', 'webhook body exceeds 256 KB');
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > 256 * 1024) throw new ApiFailure('PayloadTooLarge', 'webhook body exceeds 256 KB');
  const parsed = JSON.parse(raw || '{}') as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ApiFailure('ValidationFailed', 'webhook body must be a JSON object');
  return { payload: parsed as Record<string, unknown>, raw };
}

/** Anonymous per-automation webhook capability URLs. The token is never stored in plaintext. */
export function createAutomationWebhooksRoute(store = () => automationStore()) {
  const app = new Hono();
  app.post('/automation-webhooks/:token', async (c) => {
    const { payload, raw } = await limitedJson(c);
    const result = await store().webhook(c.req.param('token'), payload, c.req.header('idempotency-key') ?? null, c.req.header('x-flotilla-signature') ?? null, raw);
    return c.json(result, 202);
  });
  return { basePath: '/api/v1', app, public: true };
}
export default createAutomationWebhooksRoute();
