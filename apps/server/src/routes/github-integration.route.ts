import { Hono, type Context } from 'hono';
import pg from 'pg';
import { GitHubIntegrationStore } from '../github-integration/index.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
let store: GitHubIntegrationStore | null = null;
export function githubIntegrationStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') {
  store ??= new GitHubIntegrationStore(new pg.Pool({ connectionString: databaseUrl })); return store;
}
export function createGitHubIntegrationRoute(getStore = () => githubIntegrationStore()) {
  const app = new Hono();
  app.get('/github/accounts', async (c) => c.json({ items: await getStore().accounts(userId(c)) }));
  app.post('/github/accounts', async (c) => c.json(await getStore().connect(userId(c), await body(c)), 201));
  app.get('/github/accounts/:id/installations', async (c) => c.json({ items: await getStore().installations(userId(c), c.req.param('id')) }));
  app.post('/github/accounts/:id/installations', async (c) => c.json(await getStore().install(userId(c), c.req.param('id'), await body(c)), 201));
  app.put('/github/accounts/:id/commit-identity', async (c) => { const b = await body(c); return c.json(await getStore().setIdentity(userId(c), c.req.param('id'), b.identity, b.commitEmail)); });
  app.put('/github/pulls/:owner/:repo/:number/commit-identity', async (c) => c.json(await getStore().setPrIdentity(userId(c), `${c.req.param('owner')}/${c.req.param('repo')}`, Number(c.req.param('number')), (await body(c)).identity)));
  app.delete('/github/accounts/:id', async (c) => {
    const admin = ((c as any).get('principal') as { role?: string } | undefined)?.role === 'admin' || (await getStore().pool.query(`SELECT role FROM users WHERE id=$1`, [userId(c)])).rows[0]?.role === 'admin';
    await getStore().unlink(userId(c), c.req.param('id'), admin); return c.body(null, 204);
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createGitHubIntegrationRoute();
