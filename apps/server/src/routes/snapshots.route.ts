import { Hono, type Context } from 'hono';
import { snapshotStore } from '../snapshots/store.js';

const userId = (c: Context) => c.get('userId') as string;

/** Project snapshot spec, rebuild request, boot plan and build history with per-step logs. */
export function createSnapshotsRoute(store = () => snapshotStore()) {
  const app = new Hono();
  const project = (c: Context) => store().ownedProject(userId(c), c.req.param('id')!);
  app.get('/projects/:id/snapshot', async (c) => { const p = await project(c); return c.json({ ...(await store().spec(p.id)), boot: await store().bootPlan(p.id) }); });
  app.put('/projects/:id/snapshot', async (c) => {
    const p = await project(c); const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    return c.json({ spec: await store().putSpec(p, b.spec) });
  });
  app.post('/projects/:id/snapshot/rebuild', async (c) => { await store().requestRebuild((await project(c)).id); return c.body(null, 202); });
  app.get('/projects/:id/snapshots/builds', async (c) => c.json({ items: await store().history((await project(c)).id) }));
  app.get('/projects/:id/snapshots/builds/:buildId', async (c) => c.json(await store().build((await project(c)).id, c.req.param('buildId'))));
  return { basePath: '/api/v1', app, public: false };
}
export default createSnapshotsRoute();
