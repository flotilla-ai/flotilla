import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { machineCore, type MachineCore } from '../machines/machine-core.js';
import type { ThreadRunner } from '../runner/runner.js';
import { defaultRunner } from './threads.route.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Pool machine size setting, limits, wake button, 4 h keep-awake and the agent's machine tools. */
export function createMachineCoreRoute(core: () => MachineCore = () => machineCore(), runner: () => Pick<ThreadRunner, 'wakeMachine'> = () => defaultRunner()) {
  const app = new Hono();
  const thread = async (c: Context) => { const id = c.req.param('id')!; return { id, projectId: await core().ownedThread(userId(c), id) }; };
  app.get('/machines/limits', (c) => c.json(core().limits()));
  app.get('/projects/:id/machine', async (c) => { const id = await core().ownedProject(userId(c), c.req.param('id')); return c.json({ projectId: id, size: await core().size(id) }); });
  app.put('/projects/:id/machine', async (c) => c.json(await core().setSize(await core().ownedProject(userId(c), c.req.param('id')), (await body(c)).size)));
  app.get('/threads/:id/machine', async (c) => c.json(await core().state((await thread(c)).id)));
  app.post('/threads/:id/machine/wake', async (c) => { const t = await thread(c); await runner().wakeMachine(t.id); return c.json(await core().state(t.id)); });
  app.put('/threads/:id/machine/keep-awake', async (c) => { const t = await thread(c); await runner().wakeMachine(t.id); return c.json(await core().keepAwake(t.id, true)); });
  app.delete('/threads/:id/machine/keep-awake', async (c) => c.json(await core().keepAwake((await thread(c)).id, false)));
  app.post('/threads/:id/machine/tools/:name', async (c) => {
    const t = await thread(c);
    if (c.req.param('name') === 'machine.set_size') return c.json(await core().setSize(t.projectId, (await body(c)).size));
    if (c.req.param('name') === 'machine.wake') { await runner().wakeMachine(t.id); return c.json(await core().state(t.id)); }
    throw new ApiFailure('NotFound', 'machine tool not found');
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createMachineCoreRoute();
