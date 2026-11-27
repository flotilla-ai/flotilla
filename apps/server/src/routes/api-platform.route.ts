import { Hono, type Context } from 'hono';
import { requireSession } from '../auth/requireSession.js';
import { apiPlatformStore } from '../api-platform/store.js';
import { ApiFailure, apiError, type ApiPrincipal } from '../api-platform/types.js';

const principal = (c: Context) => c.get('principal') as ApiPrincipal;
const json = (c: Context) => c.req.json().catch(() => ({}));
/** Reads the body, stopping as soon as it exceeds max bytes (null), so oversized bodies are never buffered whole. */
async function readLimited(c: Context, max: number): Promise<Buffer | null> {
  if (Number(c.req.header('content-length') ?? 0) > max) return null;
  const reader = c.req.raw.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const next = await reader?.read();
    if (!next || next.done) return Buffer.concat(chunks);
    size += next.value.length;
    if (size > max) { await reader!.cancel(); return null; }
    chunks.push(next.value);
  }
}

export function createApiPlatformRoute(store = () => apiPlatformStore()) {
  const app = new Hono();
  for (const path of ['/principal', '/api-keys', '/api-keys/*', '/files', '/files/*']) app.use(path, requireSession);
  app.get('/principal', (c) => c.json(principal(c)));
  app.post('/api-keys', async (c) => {
    if (principal(c).via !== 'session') return apiError(c, 'Forbidden', 'API keys are minted only from the Flotilla app');
    return c.json(await store().mintKey(principal(c).userId, await json(c)), 201);
  });
  app.get('/api-keys', async (c) => c.json(await store().listKeys(principal(c).userId)));
  app.delete('/api-keys/:id', async (c) => (await store().revokeKey(principal(c).userId, c.req.param('id'))) ? c.json({ id: c.req.param('id'), revoked: true }) : apiError(c, 'NotFound', 'API key not found'));
  app.post('/files', async (c) => {
    const base = process.env.FLOTILLA_PUBLIC_URL?.replace(/\/$/, '') ?? new URL(c.req.url).origin;
    return c.json(await store().createUpload(principal(c).userId, await json(c), base), 201);
  });
  app.get('/files', async (c) => c.json(await store().listFiles(principal(c).userId, c.req.query('limit'), c.req.query('cursor'))));
  app.get('/files/:id', async (c) => {
    const file = await store().getFile(principal(c).userId, c.req.param('id'));
    return file ? c.json(file) : apiError(c, 'NotFound', 'file not found');
  });
  app.put('/uploads/:id', async (c) => {
    const read = async () => (await readLimited(c, store().maxUploadBytes)) ?? Promise.reject(new ApiFailure('PayloadTooLarge', 'upload too large'));
    return c.json(await store().completeUpload(c.req.param('id'), c.req.query('token') ?? '', read));
  });
  app.post('/webhooks/automations/:secret', async (c) => {
    const raw = await readLimited(c, 256 * 1024);
    if (!raw) return apiError(c, 'PayloadTooLarge', 'webhook body exceeds 256 KiB');
    const text = raw.toString('utf8');
    let payload: unknown;
    try { payload = text ? JSON.parse(text) : {}; } catch { return apiError(c, 'ValidationFailed', 'webhook body must be JSON'); }
    const deliveryId = await store().deliverWebhook(c.req.param('secret'), payload);
    return deliveryId ? c.json({ deliveryId }, 202) : apiError(c, 'NotFound', 'no automation for this webhook');
  });
  const legacy = (c: Context) => {
    const url = new URL(c.req.url);
    return new Response(null, { status: 308, headers: { location: url.pathname.replace(/^\/api\/v1\/tasks/, '/api/v1/threads') + url.search, deprecation: 'true', link: '</api/v1/threads>; rel="successor-version"' } });
  };
  app.all('/tasks', legacy);
  app.all('/tasks/*', legacy);
  return { basePath: '/api/v1', app, public: true };
}
export default createApiPlatformRoute();
