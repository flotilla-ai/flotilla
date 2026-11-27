import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { threadLifecycle } from '../thread-lifecycle/store.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, any>;

/** Thread lifecycle: titles, archive, delete, read state, membership, ownership, bulk actions, settings and cost. */
export function createThreadLifecycleRoute(store = () => threadLifecycle()) {
  const app = new Hono();
  app.get('/me/threads', async (c) => {
    const archived = c.req.query('archived') === 'all' ? 'all' : c.req.query('archived') === 'true' ? 'only' : 'exclude';
    return c.json({ items: await store().list(userId(c), archived) });
  });
  app.post('/threads/bulk', async (c) => c.json({ results: await store().bulk(userId(c), (await body(c)) as never) }));
  app.post('/threads/read-all', async (c) => c.json({ marked: await store().readAll(userId(c)) }));
  app.get('/threads/:id/lifecycle', async (c) => c.json(await store().view(c.req.param('id'), userId(c))));
  app.post('/threads/:id/lifecycle', async (c) => {
    const view = await store().apply(c.req.param('id'), userId(c), (await body(c)) as never);
    return view ? c.json(view) : c.body(null, 204);
  });
  app.delete('/threads/:id', async (c) => { await store().apply(c.req.param('id'), userId(c), { action: 'delete' }); return c.body(null, 204); });
  app.get('/threads/:id/cost', async (c) => c.json(await store().cost(c.req.param('id'), userId(c))));
  const scope = async (c: Context, write: boolean): Promise<['org' | 'user', string]> => {
    if (c.req.param('scope') === 'me') return ['user', userId(c)];
    if (c.req.param('scope') !== 'org') throw new ApiFailure('NotFound', 'settings scope not found');
    if (write && !(await store().isAdmin(userId(c)))) throw new ApiFailure('Forbidden', 'only admins can change org settings');
    return ['org', 'org'];
  };
  app.get('/thread-settings/:scope', async (c) => c.json(await store().settings(...(await scope(c, false)))));
  app.put('/thread-settings/:scope', async (c) => c.json(await store().putSettings(...(await scope(c, true)), await body(c))));
  return { basePath: '/api/v1', app, public: false };
}
export default createThreadLifecycleRoute();
