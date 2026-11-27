import { Hono } from 'hono';
import pg from 'pg';
import { canViewThread, viewable } from '../thread-api/access.js';

function camel(row: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(row).map(([k,v]) => [k.replace(/_([a-z])/g, (_,x) => x.toUpperCase()), v])); }
function userId(c: unknown): string { return (c as { get(key: string): string }).get('userId'); }

export function createReadRoute(pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla' })) {
  const app = new Hono();
  app.get('/threads', async (c) => {
    const rows = await pool.query('SELECT * FROM threads WHERE owner_id=$1 ORDER BY created_at,id', [userId(c)]);
    return c.json(rows.rows.map(camel));
  });
  app.get('/threads/:id', async (c) => {
    const rows = await pool.query(`SELECT t.* FROM threads t WHERE t.id=$1 AND ${viewable('$2')}`, [c.req.param('id'), userId(c)]);
    return rows.rows[0] ? c.json(camel(rows.rows[0])) : c.json({ error: 'not found' }, 404);
  });
  app.get('/threads/:id/messages', async (c) => {
    if (!(await canViewThread(pool, c.req.param('id'), userId(c)))) return c.json({ error: 'not found' }, 404);
    const after = Number(c.req.query('after') ?? 0);
    const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
    const rows = await pool.query(`SELECT id,thread_id,seq,run_id,kind,at,source,trust,payload,request_id FROM events WHERE thread_id=$1 AND seq>$2 AND EXISTS (SELECT 1 FROM threads t WHERE t.id=$1 AND ${viewable('$4')}) ORDER BY seq LIMIT $3`, [c.req.param('id'), after, limit, userId(c)]);
    return c.json(rows.rows.map(camel));
  });
  app.get('/approvals', async (c) => {
    const state = c.req.query('state');
    const rows = await pool.query('SELECT a.* FROM approvals a JOIN threads t ON t.id=a.thread_id WHERE t.owner_id=$1 AND ($2::text IS NULL OR a.state=$2) ORDER BY a.id', [userId(c), state ?? null]);
    return c.json(rows.rows.map(camel));
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createReadRoute();
