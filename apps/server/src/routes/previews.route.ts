import { Hono } from 'hono';
import pg from 'pg';
import { PreviewTokens, shareToken } from '../previews/index.js';
export const previewTokens = new PreviewTokens();
function userId(c: unknown): string { return (c as { get(key: string): string }).get('userId'); }
export function createPreviewsRoute(tokens = previewTokens, pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla' })) {
  const app = new Hono();
  app.post('/threads/:id/preview-token', async c => {
    const b = await c.req.json().catch(() => ({}));
    const port = Number(b.port);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return c.json({ error: 'valid port required' }, 400);
    const rows = await pool.query('SELECT code FROM threads WHERE id=$1 AND owner_id=$2', [c.req.param('id'), userId(c)]);
    if (!rows.rows[0]) return c.json({ error: 'not found' }, 404);
    const exp = Date.now() + 10 * 60_000;
    const payload = { threadId: c.req.param('id'), code: rows.rows[0].code, port, exp };
    return c.json({ token: tokens.mint(payload), shareToken: shareToken(payload) });
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createPreviewsRoute();
