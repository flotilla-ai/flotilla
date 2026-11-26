import { Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

function userId(c: unknown): string { return (c as { get(key: string): string }).get('userId'); }

export function createProjectsRoute(pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla' })) {
  const app = new Hono();
  app.get('/', async (c) => {
    const rows = await pool.query('SELECT * FROM projects WHERE owner_id=$1 ORDER BY created_at,id', [userId(c)]);
    return c.json(rows.rows);
  });
  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!body.name || !body.repo) return c.json({ error: 'name and repo required' }, 400);
    const id = `prj_${randomBytes(8).toString('hex')}`;
    const trust = body.trust === 'trusted' ? (body.confirm === 'private-and-mine' ? 'trusted' : null) : 'untrusted';
    if (!trust) return c.json({ error: 'trusted requires confirm: private-and-mine' }, 400);
    const rows = await pool.query('INSERT INTO projects (id,owner_id,name,repo,trust,egress_allow,budget) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [id, userId(c), body.name, JSON.stringify(body.repo), trust, JSON.stringify(body.egressAllow ?? []), JSON.stringify(body.budget ?? {})]);
    return c.json(rows.rows[0], 201);
  });
  app.get('/:id', async (c) => {
    const rows = await pool.query('SELECT * FROM projects WHERE id=$1 AND owner_id=$2', [c.req.param('id'), userId(c)]);
    return rows.rows[0] ? c.json(rows.rows[0]) : c.json({ error: 'not found' }, 404);
  });
  app.patch('/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (body.trust === 'trusted' && body.confirm !== 'private-and-mine') return c.json({ error: 'trusted requires confirm: private-and-mine' }, 400);
    const rows = await pool.query('UPDATE projects SET trust=COALESCE($3,trust), egress_allow=COALESCE($4,egress_allow), budget=COALESCE($5,budget) WHERE id=$1 AND owner_id=$2 RETURNING *', [c.req.param('id'), userId(c), body.trust ?? null, body.egressAllow === undefined ? null : JSON.stringify(body.egressAllow), body.budget === undefined ? null : JSON.stringify(body.budget)]);
    return rows.rows[0] ? c.json(rows.rows[0]) : c.json({ error: 'not found' }, 404);
  });
  return { basePath: '/api/v1/projects', app, public: false };
}
export default createProjectsRoute();
