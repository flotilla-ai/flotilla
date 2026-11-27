import { Hono, type Context } from 'hono';
import pg from 'pg';
import { ReviewCoreStore, type ReviewSource } from '../review-core/index.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
let singleton: ReviewCoreStore | null = null;
export function reviewCoreStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla') {
  singleton ??= new ReviewCoreStore(new pg.Pool({ connectionString: databaseUrl })); return singleton;
}
export function createReviewCoreRoute(getStore = () => reviewCoreStore()) {
  const app = new Hono();
  app.get('/reviews/settings/:owner/:repo', async (c) => c.json(await getStore().settings(userId(c), `${c.req.param('owner')}/${c.req.param('repo')}`)));
  app.put('/reviews/settings/:owner/:repo', async (c) => c.json(await getStore().settings(userId(c), `${c.req.param('owner')}/${c.req.param('repo')}`, await body(c))));
  app.post('/reviews', async (c) => { const b = await body(c); return c.json(await getStore().start(userId(c), b, (b.source ?? 'api') as ReviewSource), 201); });
  app.post('/reviews/push', async (c) => { const b = await body(c); const r = await getStore().push(userId(c), b.repo, b.prNumber, b.headSha); return r ? c.json(r, 201) : c.json({ skipped: true }, 200); });
  app.get('/reviews/:owner/:repo/:number', async (c) => c.json(await getStore().state(userId(c), `${c.req.param('owner')}/${c.req.param('repo')}`, Number(c.req.param('number')))));
  app.post('/reviews/:id/findings', async (c) => c.json({ items: await getStore().addFindings(userId(c), c.req.param('id'), ((await body(c)).items ?? []) as any) }, 201));
  app.put('/review-findings/:id/triage', async (c) => c.json(await getStore().triage(userId(c), c.req.param('id'), (await body(c)).status)));
  app.put('/reviews/:id/ready-override', async (c) => c.json(await getStore().overrideReady(userId(c), c.req.param('id'), (await body(c)).enabled)));
  return { basePath: '/api/v1', app, public: false };
}
export default createReviewCoreRoute();
