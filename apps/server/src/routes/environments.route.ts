import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { environmentMachine } from '../environments/executor.js';
import { environmentStore } from '../environments/store.js';
import { SETUP_FILES, parseEnvironmentSpec, parseSetupFile } from '../environments/types.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Project dev environments (versioned), repo setup-file import, the thread + menu, on-demand commands and agent environment tools. */
export function createEnvironmentsRoute(store = () => environmentStore()) {
  const app = new Hono();
  const project = (c: Context) => store().ownedProject(userId(c), c.req.param('id')!);
  app.get('/projects/:id/environment', async (c) => c.json(await store().current(await project(c))));
  app.put('/projects/:id/environment', async (c) => {
    const id = await project(c); const b = await body(c);
    return c.json(await store().replace(id, parseEnvironmentSpec(b.spec), { source: 'user', actor: userId(c), note: typeof b.note === 'string' ? b.note : '', baseVersion: Number.isInteger(b.baseVersion) ? b.baseVersion as number : undefined }));
  });
  app.get('/projects/:id/environment/versions', async (c) => c.json({ items: await store().history(await project(c)) }));
  app.post('/projects/:id/environment/import', async (c) => {
    const id = await project(c); const b = await body(c);
    if (!SETUP_FILES.includes(b.path as never) || typeof b.content !== 'string') throw new ApiFailure('ValidationFailed', `path must be one of ${SETUP_FILES.join(', ')} with string content`);
    return c.json(await store().replace(id, parseSetupFile(b.path as string, b.content), { source: 'repo-file', actor: userId(c), note: b.path as string }));
  });
  app.get('/threads/:id/environment', async (c) => { await store().ownedThread(userId(c), c.req.param('id')); return c.json(await store().menu(c.req.param('id'))); });
  app.post('/threads/:id/environment/commands/:name', async (c) => {
    const threadId = c.req.param('id'); const projectId = await store().threadProject(userId(c), threadId);
    const { spec } = await store().current(projectId);
    if (!spec.commands.some((x) => x.name === c.req.param('name'))) throw new ApiFailure('NotFound', 'command not found');
    return c.json(await store().executor(threadId, environmentMachine(threadId)).command(spec, c.req.param('name')));
  });
  app.post('/threads/:id/environment/tools/:name', async (c) => {
    const threadId = c.req.param('id'); const projectId = await store().threadProject(userId(c), threadId);
    return c.json(await store().tool(threadId, projectId, c.req.param('name'), await body(c), () => environmentMachine(threadId)));
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createEnvironmentsRoute();
