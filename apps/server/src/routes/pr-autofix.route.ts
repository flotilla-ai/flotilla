import { Hono, type Context } from 'hono';
import pg from 'pg';
import { PrAutofixStore } from '../pr-autofix/index.js';
const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
let store: PrAutofixStore | null = null;
export function prAutofixStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') { store ??= new PrAutofixStore(new pg.Pool({ connectionString: databaseUrl })); return store }
export function createPrAutofixRoute(getStore = () => prAutofixStore()) {
  const app = new Hono();
  app.get('/pulls/settings', async (c) => c.json(await getStore().settings(userId(c))));
  app.put('/pulls/settings', async (c) => c.json(await getStore().updateSettings(userId(c), await body(c))));
  app.get('/pulls', async (c) => c.json({ items: await getStore().list(userId(c), c.req.query() as Record<string, unknown>) }));
  app.get('/pulls/:owner/:repo/:number', async (c) => c.json(await getStore().get(userId(c), `${c.req.param('owner')}/${c.req.param('repo')}`, Number(c.req.param('number')))));
  app.post('/pulls/:owner/:repo/:number/actions', async (c) => c.json(await getStore().act(userId(c), `${c.req.param('owner')}/${c.req.param('repo')}`, Number(c.req.param('number')), await body(c))));
  app.post('/pulls/:owner/:repo/:number/review', async (c) => c.json(await getStore().review(userId(c), `${c.req.param('owner')}/${c.req.param('repo')}`, Number(c.req.param('number')), await body(c))));
  return { basePath: '/api/v1', app, public: false };
}
export default createPrAutofixRoute();
