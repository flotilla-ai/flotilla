import { Hono, type Context } from 'hono';
import { modelsCatalogStore } from '../models-catalog/store.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, any>;

/** Model catalog, per-user/org connections (owner → org → free), selection resolve, picker and favorites. Keys are write-only. */
export function createModelsCatalogRoute(store = () => modelsCatalogStore()) {
  const app = new Hono();
  app.get('/models/catalog', (c) => c.json({ items: store().catalog.models }));
  app.get('/models/providers', (c) => c.json({ items: store().providers(c.req.query('q')) }));
  app.post('/models/check-access', async (c) => c.json(await store().check(userId(c), (await body(c)) as never)));
  app.post('/models/resolve', async (c) => c.json(await store().resolve(userId(c), await body(c))));
  app.get('/models/picker', async (c) => c.json({ items: await store().picker(userId(c)) }));
  app.put('/me/model-favorites', async (c) => c.json({ items: await store().setFavorites(userId(c), (await body(c)).models) }));
  app.get('/connections', async (c) => c.json({ items: await store().list(userId(c)) }));
  app.post('/connections', async (c) => c.json(await store().create(userId(c), (await body(c)) as never), 201));
  app.put('/connections/order', async (c) => { const b = await body(c); return c.json({ items: await store().reorder(userId(c), b.scope, b.ids) }); });
  app.patch('/connections/:id', async (c) => c.json(await store().patch(userId(c), c.req.param('id'), await body(c))));
  app.post('/connections/:id/test', async (c) => c.json(await store().test(userId(c), c.req.param('id'))));
  app.get('/connections/:id/models', async (c) => c.json({ items: await store().findModels(userId(c), c.req.param('id'), c.req.query('q')) }));
  app.delete('/connections/:id', async (c) => { await store().remove(userId(c), c.req.param('id')); return c.body(null, 204); });
  return { basePath: '/api/v1', app, public: false };
}
export default createModelsCatalogRoute();
