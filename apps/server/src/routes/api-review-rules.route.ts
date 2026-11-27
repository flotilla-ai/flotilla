import { Hono, type Context } from 'hono';
import pg from 'pg';
import { ApiReviewRulesStore } from '../api-review-rules/index.js';

const user = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
let one: ApiReviewRulesStore | null = null;
export function apiReviewRulesStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') { one ??= new ApiReviewRulesStore(new pg.Pool({ connectionString: databaseUrl, max: 3 })); return one; }
export function createApiReviewRulesRoute(getStore = () => apiReviewRulesStore()) {
  const app = new Hono();
  app.get('/review-rules', async (c) => c.json(await getStore().listRules(user(c), c.req.query('repo'))));
  app.post('/review-rules', async (c) => c.json(await getStore().createRule(user(c), await body(c)), 201));
  app.get('/review-rules/:id', async (c) => c.json(await getStore().getRule(user(c), c.req.param('id'))));
  app.patch('/review-rules/:id', async (c) => c.json(await getStore().updateRule(user(c), c.req.param('id'), await body(c))));
  app.delete('/review-rules/:id', async (c) => (await getStore().deleteRule(user(c), c.req.param('id'))) ? c.body(null, 204) : c.body(null, 404));
  app.get('/review-filter-rules', async (c) => c.json(await getStore().listFilters(user(c), c.req.query('repo'))));
  app.post('/review-filter-rules', async (c) => c.json(await getStore().createFilter(user(c), await body(c)), 201));
  app.patch('/review-filter-rules/:id', async (c) => c.json(await getStore().updateFilter(user(c), c.req.param('id'), await body(c))));
  app.delete('/review-filter-rules/:id', async (c) => (await getStore().deleteFilter(user(c), c.req.param('id'))) ? c.body(null, 204) : c.body(null, 404));
  app.get('/review-ignore-paths', async (c) => c.json(await getStore().listIgnorePaths(user(c), c.req.query('repo'))));
  app.post('/review-ignore-paths', async (c) => c.json(await getStore().createIgnorePath(user(c), await body(c)), 201));
  app.patch('/review-ignore-paths/:id', async (c) => c.json(await getStore().updateIgnorePath(user(c), c.req.param('id'), await body(c))));
  app.delete('/review-ignore-paths/:id', async (c) => (await getStore().deleteIgnorePath(user(c), c.req.param('id'))) ? c.body(null, 204) : c.body(null, 404));
  return { basePath: '/api/v1', app, public: false };
}
export default createApiReviewRulesRoute();
