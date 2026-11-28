import { Hono, type Context } from 'hono';
import { ComputeQuotaService, type Queryable } from '../compute-quota/index.js';
import { defaultRunner } from './threads.route.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Compute quota decisions and allocation state transitions. Disabled by default unless FLOTILLA_COMPUTE_ISOLATION is on. */
export function createComputeQuotaRoute(pool: Queryable | (() => Queryable) = () => defaultRunner().pool as never) {
  const svc = () => new ComputeQuotaService({ pool: typeof pool === 'function' ? pool() : pool });
  const app = new Hono();
  app.post('/threads/:id/compute/evaluate', async (c) => {
    const b = await body(c); const threadId = c.req.param('id'); await defaultRunner().assertOwner(threadId, userId(c));
    return c.json(await svc().evaluate({ userId: userId(c), threadId, captainId: b.captainId as string | undefined, request: (b.request ?? {}) as never }));
  });
  app.post('/compute/allocations/:captainId/state', async (c) => {
    const b = await body(c); const state = String(b.state ?? '') as never;
    if (!['running', 'sleeping', 'absent', 'stopped'].includes(state)) return c.json({ error: 'invalid state' }, 400);
    return c.json(await svc().setAllocationState(c.req.param('captainId'), state, (b.quota ?? {}) as never));
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createComputeQuotaRoute();
