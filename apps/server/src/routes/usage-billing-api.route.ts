import { Hono, type Context } from 'hono';
import { runGates } from '../runner/runner.js';
import { usageStore } from '../usage-billing-api/store.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => (await c.req.json().catch(() => null)) as any;

/** Usage report/series, budget windows/balance and operator usage settings. */
export function createUsageBillingRoute(store = usageStore) {
  runGates.push((thread) => store().gate(thread));
  const app = new Hono();
  app.get('/usage', async (c) => c.json(await store().report(userId(c), c.req.query())));
  app.get('/usage/series', async (c) => c.json(await store().series(userId(c), c.req.query())));
  app.get('/usage/balance', async (c) => c.json(await store().balance()));
  app.put('/usage/budgets', async (c) => c.json(await store().setBudgets(userId(c), await body(c))));
  app.get('/usage/settings', async (c) => c.json(await store().settings()));
  app.put('/usage/settings', async (c) => c.json(await store().setSettings(userId(c), (await body(c)) ?? {})));
  return { basePath: '/api/v1', app, public: false };
}
export default createUsageBillingRoute();
