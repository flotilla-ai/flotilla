import { Hono, type Context } from 'hono';
import { MemoryV2Service, type Queryable } from '../memory-v2/index.js';
import { defaultRunner } from './threads.route.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Captain/user memory inspection route. Agent access uses the token-authorized /mcp/memory service seam. */
export function createMemoryV2Route(pool: Queryable | (() => Queryable) = () => defaultRunner().pool as never) {
  const svc = () => new MemoryV2Service({ pool: typeof pool === 'function' ? pool() : pool });
  const app = new Hono();
  app.get('/captains/:id/memory', async (c) => { const captainId = c.req.param('id'); await defaultRunner().assertOwner(captainId, userId(c)); return c.json(await svc().list({ scope: 'captain', subjectId: captainId, captainId, query: c.req.query('q') ?? '' })); });
  app.post('/captains/:id/memory', async (c) => { const captainId = c.req.param('id'); await defaultRunner().assertOwner(captainId, userId(c)); const b = await body(c); return c.json(await svc().save({ scope: 'captain', subjectId: captainId, captainId, kind: b.kind as never, text: String(b.text ?? ''), createdBy: userId(c) }), 201); });
  app.delete('/captains/:id/memory/:memory', async (c) => { const captainId = c.req.param('id'); await defaultRunner().assertOwner(captainId, userId(c)); return c.json({ forgotten: await svc().forget(c.req.param('memory'), captainId) }); });
  return { basePath: '/api/v1', app, public: false };
}
export default createMemoryV2Route();
