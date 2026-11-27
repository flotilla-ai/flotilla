import { Hono, type Context } from 'hono';
import pg from 'pg';
import { PluginLifecycleStore } from '../plugin-lifecycle/index.js';

const user = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
let one: PluginLifecycleStore | null = null;
export function pluginLifecycleStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') { one ??= new PluginLifecycleStore(new pg.Pool({ connectionString: databaseUrl, max: 3 })); return one }
export function createPluginLifecycleRoute(getStore = () => pluginLifecycleStore()) {
  const app = new Hono();
  app.get('/mcp/plugins', async (c) => c.json(await getStore().list(user(c))));
  app.post('/mcp/plugins', async (c) => c.json(await getStore().install(user(c), await body(c)), 201));
  app.post('/mcp/plugins/:id/sync', async (c) => c.json(await getStore().sync(user(c), c.req.param('id'))));
  app.post('/mcp/plugins/:id/approve-update', async (c) => c.json(await getStore().approveUpdate(user(c), c.req.param('id'))));
  app.post('/mcp/plugins/:id/rollback', async (c) => c.json(await getStore().rollback(user(c), c.req.param('id'))));
  app.post('/mcp/plugins/:id/servers/:server/connect', async (c) => c.json(await getStore().connect(user(c), c.req.param('id'), c.req.param('server'), (await body(c)).keys)));
  app.get('/mcp/plugins/resolve/:projectId?', async (c) => c.json(await getStore().resolve(user(c), c.req.param('projectId') ?? null)));
  return { basePath: '/api/v1', app, public: false };
}
export default createPluginLifecycleRoute();
