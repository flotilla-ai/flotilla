import { Hono, type Context } from 'hono';
import pg from 'pg';
import { UsageAnalyticsStore } from '../usage-analytics/index.js';

const user = (c: Context) => c.get('userId') as string;
let one: UsageAnalyticsStore | null = null;
export function usageAnalyticsStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') { one ??= new UsageAnalyticsStore(new pg.Pool({ connectionString: databaseUrl, max: 3 })); return one; }
export function createUsageAnalyticsRoute(getStore = () => usageAnalyticsStore()) {
  const app = new Hono();
  app.get('/workspace', async (c) => c.json(await getStore().workspace()));
  app.get('/usage/activity', async (c) => c.json(await getStore().activity(user(c))));
  app.get('/usage/by-member', async (c) => c.json(await getStore().memberUsage(user(c), c.req.query('sort'))));
  return { basePath: '/api/v1', app, public: false };
}
export default createUsageAnalyticsRoute();
