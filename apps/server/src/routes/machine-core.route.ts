import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { machineCore, type MachineCore } from '../machines/machine-core.js';
import { machineUxStore, type WorkspaceDriver } from '../machine-ux-network/index.js';
import type { ThreadRunner } from '../runner/runner.js';
import { defaultRunner } from './threads.route.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Pool machine size setting, limits, wake button, 4 h keep-awake and the agent's machine tools. */
export function createMachineCoreRoute(core: () => MachineCore = () => machineCore(), runner: () => ThreadRunner = () => defaultRunner()) {
  const app = new Hono();
  const thread = async (c: Context) => { const id = c.req.param('id')!; return { id, projectId: await core().ownedThread(userId(c), id) }; };
  const driver = () => runner().deps.driver as unknown as WorkspaceDriver;
  const awakeLease = async (threadId: string) => (await core().pool.query('SELECT container_id FROM machine_leases WHERE thread_id=$1 AND state=\'awake\'', [threadId])).rows[0];
  const transportFor = async (threadId: string) => {
    const lease = await awakeLease(threadId);
    if (!lease?.container_id) throw new ApiFailure('Conflict', 'machine is not awake');
    return driver().transport(lease.container_id);
  };
  app.get('/machines/limits', (c) => c.json(core().limits()));
  app.get('/projects/:id/machine', async (c) => { const id = await core().ownedProject(userId(c), c.req.param('id')); return c.json({ projectId: id, size: await core().size(id) }); });
  app.put('/projects/:id/machine', async (c) => c.json(await core().setSize(await core().ownedProject(userId(c), c.req.param('id')), (await body(c)).size)));
  app.get('/threads/:id/machine', async (c) => c.json(await core().state((await thread(c)).id)));
  app.get('/threads/:id/machine/network', async (c) => c.json(await machineUxStore(core().databaseUrl).network((await thread(c)).id)));
  app.put('/threads/:id/machine/network', async (c) => c.json(await machineUxStore(core().databaseUrl).setNetwork((await thread(c)).id, (await body(c)).mode)));
  app.post('/threads/:id/machine/wake', async (c) => { const t = await thread(c); await runner().wakeMachine(t.id); return c.json(await core().state(t.id)); });
  app.post('/threads/:id/machine/resize', async (c) => {
    const t = await thread(c); const size = (await body(c)).size;
    await core().setSize(t.projectId, size); await core().sleepNow(t.id); await runner().wakeMachine(t.id);
    return c.json(await core().state(t.id));
  });
  app.get('/threads/:id/machine/files', async (c) => c.json({ items: await machineUxStore(core().databaseUrl).listFiles((await thread(c)).id, driver(), c.req.query('path') ?? '') }));
  app.get('/threads/:id/machine/files/read', async (c) => c.json(await machineUxStore(core().databaseUrl).readFile((await thread(c)).id, driver(), c.req.query('path') ?? '')));
  app.post('/threads/:id/machine/shell', async (c) => {
    const t = await thread(c); const b = await body(c); await runner().wakeMachine(t.id);
    return c.json(await machineUxStore(core().databaseUrl).runCommand(t.id, await transportFor(t.id), String(b.command ?? ''), String(b.cwd ?? '/workspace'), Number(b.timeoutMs ?? 750)));
  });
  app.get('/threads/:id/machine/background', async (c) => { const t = await thread(c); const lease = await awakeLease(t.id); return c.json({ items: await machineUxStore(core().databaseUrl).commands(t.id, lease?.container_id ? driver().transport(lease.container_id) : undefined) }); });
  app.post('/threads/:id/machine/background/:commandId/stop', async (c) => { const t = await thread(c); return c.json(await machineUxStore(core().databaseUrl).stopCommand(t.id, c.req.param('commandId'), await transportFor(t.id))); });
  app.post('/threads/:id/machine/desktop', async (c) => { await thread(c); throw new ApiFailure('Conflict', 'pool machines do not run a desktop server yet'); });
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
