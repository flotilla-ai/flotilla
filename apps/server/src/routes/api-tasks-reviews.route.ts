import { Hono, type Context } from 'hono';
import pg from 'pg';
import { ApiTasksReviewsStore } from '../api-tasks-reviews/index.js';

const user = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
let one: ApiTasksReviewsStore | null = null;
export function apiTasksReviewsStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') { one ??= new ApiTasksReviewsStore(new pg.Pool({ connectionString: databaseUrl, max: 3 }), databaseUrl); return one; }
export function createApiTasksReviewsRoute(getStore = () => apiTasksReviewsStore()) {
  const app = new Hono();
  app.get('/tasks', async (c) => c.json(await getStore().listTasks(user(c))));
  app.get('/tasks/:id', async (c) => c.json(await getStore().getTask(user(c), c.req.param('id'))));
  app.get('/tasks/:id/messages', async (c) => c.json(await getStore().taskMessages(user(c), c.req.param('id'), c.req.query('cursor'), c.req.query('limit') === undefined ? undefined : Number(c.req.query('limit')))));
  app.get('/review-settings/:owner/:repo', async (c) => c.json(await getStore().reviewSettings(user(c), `${c.req.param('owner')}/${c.req.param('repo')}`)));
  app.put('/review-settings/:owner/:repo', async (c) => c.json(await getStore().reviewSettings(user(c), `${c.req.param('owner')}/${c.req.param('repo')}`, await body(c))));
  app.post('/review-runs', async (c) => c.json(await getStore().startReview(user(c), await body(c)), 201));
  app.get('/review-runs/:id/round', async (c) => c.json(await getStore().round(user(c), c.req.param('id'))));
  app.get('/review-pulls/:owner/:repo/:number', async (c) => c.json(await getStore().pull(user(c), `${c.req.param('owner')}/${c.req.param('repo')}`, Number(c.req.param('number')))));
  app.patch('/review-findings/statuses', async (c) => c.json(await getStore().updateFindingStatuses(user(c), await body(c))));
  return { basePath: '/api/v1', app, public: false };
}
export default createApiTasksReviewsRoute();
