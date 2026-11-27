import { Hono, type Context } from 'hono';
import pg from 'pg';
import { PreviewTokens, shareToken } from '../previews/index.js';
import { dockerPreviewMachine } from '../previews/machine.js';
import { previewStore, previewUrl } from '../previews/store.js';
import { RESERVED_PORTS, type PreviewMachine, type PreviewShare } from '../previews/types.js';
import { apiError } from '../api-platform/types.js';
export const previewTokens = new PreviewTokens();
function userId(c: unknown): string { return (c as { get(key: string): string }).get('userId'); }
const portOf = (raw: string | undefined) => { const n = Number(raw); return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null; };
const reserved = (port: number) => (RESERVED_PORTS as readonly number[]).includes(port);
export function createPreviewsRoute(tokens = previewTokens, pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla' }), machine: PreviewMachine = dockerPreviewMachine(), store = previewStore(pool)) {
  const app = new Hono();
  const owned = (c: Context) => store.thread(c.req.param('id')!, userId(c));
  app.post('/threads/:id/preview-token', async c => {
    const b = await c.req.json().catch(() => ({}));
    const port = Number(b.port);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return c.json({ error: 'valid port required' }, 400);
    const rows = await pool.query('SELECT code FROM threads WHERE id=$1 AND owner_id=$2', [c.req.param('id'), userId(c)]);
    if (!rows.rows[0]) return c.json({ error: 'not found' }, 404);
    const exp = Date.now() + 10 * 60_000;
    const payload = { threadId: c.req.param('id'), code: rows.rows[0].code, port, exp };
    return c.json({ token: tokens.mint(payload), shareToken: shareToken({ ...payload, iat: store.now() }) });
  });
  app.get('/threads/:id/previews', async c => {
    const t = await owned(c);
    if (!t) return apiError(c, 'NotFound', 'thread not found');
    const previews = await store.list(t.id);
    const exposed = new Set(previews.map((p) => p.port));
    const listening = await machine.listening(t.code).catch(() => [] as number[]);
    return c.json({ previews, suggestions: listening.filter((p) => !reserved(p) && !exposed.has(p)), reserved: RESERVED_PORTS });
  });
  app.put('/threads/:id/previews/:port', async c => {
    const t = await owned(c);
    if (!t) return apiError(c, 'NotFound', 'thread not found');
    const port = portOf(c.req.param('port'));
    if (!port) return apiError(c, 'ValidationFailed', 'valid port required');
    if (reserved(port)) return apiError(c, 'ValidationFailed', `port ${port} is reserved`);
    const b = await c.req.json().catch(() => ({})) as { hostname?: unknown; startCommand?: unknown };
    if (b.hostname != null && (typeof b.hostname !== 'string' || !/^[a-z0-9.-]{1,253}(:\d{1,5})?$/i.test(b.hostname))) return apiError(c, 'ValidationFailed', 'invalid hostname');
    if (b.startCommand != null && (typeof b.startCommand !== 'string' || !b.startCommand.trim() || b.startCommand.length > 1000)) return apiError(c, 'ValidationFailed', 'invalid startCommand');
    return c.json(await store.expose(t.id, port, { hostname: (b.hostname as string) ?? null, startCommand: (b.startCommand as string) ?? null }));
  });
  app.post('/threads/:id/previews/:port/share', async c => {
    const t = await owned(c); const port = portOf(c.req.param('port'));
    if (!t || !port) return apiError(c, 'NotFound', 'preview not found');
    const b = await c.req.json().catch(() => ({})) as { ttlMinutes?: unknown };
    const ttl = b.ttlMinutes ?? 60;
    if (!Number.isInteger(ttl) || (ttl as number) < 1 || (ttl as number) > 7 * 24 * 60) return apiError(c, 'ValidationFailed', 'ttlMinutes must be 1..10080');
    const iat = store.now(); const until = new Date(iat + (ttl as number) * 60_000);
    if (!await store.share(t.id, port, until)) return apiError(c, 'NotFound', 'preview not found');
    const token = shareToken({ threadId: t.id, code: t.code, port, exp: until.getTime(), iat });
    return c.json({ url: `${previewUrl(t.code, port)}?share=${token}`, expiresAt: until.toISOString() } satisfies PreviewShare);
  });
  app.delete('/threads/:id/previews/:port/share', async c => {
    const t = await owned(c); const port = portOf(c.req.param('port'));
    const preview = t && port ? await store.revoke(t.id, port) : null;
    return preview ? c.json(preview) : apiError(c, 'NotFound', 'preview not found');
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createPreviewsRoute();
