import { Hono, type Context } from 'hono';
import { parseNames, parseVariables, secretsStore } from '../secrets/store.js';
import type { SecretScope } from '../secrets/types.js';

const userId = (c: Context) => c.get('userId') as string;
const camel = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, x) => x.toUpperCase()), v]));

/** Write-only env vars (project = shared, me = personal) and the native thread export; no route ever returns a value. */
export function createSecretsRoute(store = () => secretsStore()) {
  const app = new Hono();
  const scoped = (scope: SecretScope, scopeId: (c: Context) => Promise<string>) => {
    const base = scope === 'project' ? '/projects/:id/environment-variables' : '/me/environment-variables';
    app.get(base, async (c) => c.json({ items: await store().list(scope, await scopeId(c)) }));
    app.put(base, async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { variables?: unknown };
      const mutations = parseVariables(body.variables ?? null);
      return c.json({ items: await store().mutate(scope, await scopeId(c), mutations, userId(c)) });
    });
    app.delete(base, async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { names?: unknown };
      const mutations = parseNames(body.names ?? c.req.query('names'));
      return c.json({ items: await store().mutate(scope, await scopeId(c), mutations, userId(c)) });
    });
  };
  scoped('project', (c) => store().ownedProject(userId(c), c.req.param('id')!));
  scoped('personal', async (c) => userId(c));
  app.get('/threads/:id/environment-variables', async (c) => {
    await store().ownedThread(userId(c), c.req.param('id'));
    return c.json({ items: await store().grants(c.req.param('id')) });
  });
  app.get('/threads/:id/export', async (c) => {
    const thread = await store().ownedThread(userId(c), c.req.param('id'));
    const q = (sql: string) => store().pool.query(sql, [thread.id]).then((r) => r.rows.map(camel));
    return c.json({
      format: 'flotilla.thread-export/v1', exportedAt: new Date().toISOString(), thread: camel(thread),
      runs: await q('SELECT * FROM runs WHERE thread_id=$1 ORDER BY ordinal'),
      events: await q('SELECT id,seq,run_id,kind,at,source,trust,payload FROM events WHERE thread_id=$1 ORDER BY seq'),
      environmentVariables: await store().grants(thread.id)
    });
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createSecretsRoute();
