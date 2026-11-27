import { Hono, type Context } from 'hono';
import { modelPolicyApi } from '../models-catalog/model-policy-api.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, any>;

/** Model list, per-user model policy (run-out, never free, excluded adapters, background model). */
export function createModelPolicyRoute(api = modelPolicyApi) {
  const app = new Hono();
  app.get('/models', async (c) => c.json({ items: await api().models(userId(c)) }));
  app.post('/models/background', async (c) => c.json(await api().background(userId(c), (await body(c)).engine ?? null)));
  app.get('/me/model-policy', async (c) => c.json(await api().store.policy(userId(c))));
  app.put('/me/model-policy', async (c) => c.json(await api().store.setPolicy(userId(c), await body(c))));
  return { basePath: '/api/v1', app, public: false };
}
export default createModelPolicyRoute();
