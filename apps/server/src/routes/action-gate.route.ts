import { Hono, type Context } from 'hono';
import { ActionGateService, type Queryable } from '../action-gate/index.js';
import { defaultRunner } from './threads.route.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Internal action-gate evaluation and background-card expiry endpoints. Browser/research proxies enforce the result. */
export function createActionGateRoute(pool: Queryable | (() => Queryable) = () => defaultRunner().pool as never) {
  const svc = () => new ActionGateService(typeof pool === 'function' ? pool() : pool);
  const app = new Hono();
  app.post('/threads/:id/action-gate/evaluate', async (c) => {
    const b = await body(c); const threadId = c.req.param('id');
    await defaultRunner().assertOwner(threadId, userId(c));
    return c.json(await svc().evaluate({
      userId: userId(c), threadId, runId: (b.runId as string | undefined) ?? null,
      input: (b.input ?? {}) as never, rules: (b.rules ?? {}) as never, background: b.background === true
    }));
  });
  app.post('/action-gate/expire-background', async (c) => c.json({ expired: await svc().expireBackground(new Date(), userId(c)) }));
  return { basePath: '/api/v1', app, public: false };
}
export default createActionGateRoute();
