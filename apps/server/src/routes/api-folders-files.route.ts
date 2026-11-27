import { Hono, type Context } from 'hono';
import { apiPlatformStore } from '../api-platform/store.js';
import { ApiFailure } from '../api-platform/types.js';
import { threadLifecycle } from '../thread-lifecycle/store.js';
import { ApiFoldersFilesStore } from '../api-folders-files/index.js';

const user = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => { try { return await c.req.json() as Record<string, unknown>; } catch { throw new ApiFailure('ValidationFailed', 'request body must be valid JSON'); } };
let one: ApiFoldersFilesStore | null = null;
export function apiFoldersFilesStore(): ApiFoldersFilesStore {
  if (!one) { const files = apiPlatformStore(); one = new ApiFoldersFilesStore(files.pool, threadLifecycle(), files); }
  return one;
}
export function createApiFoldersFilesRoute(getStore = () => apiFoldersFilesStore()) {
  const app = new Hono();
  app.get('/folders', async (c) => c.json(await getStore().folders(user(c))));
  app.get('/folders/:name/threads', async (c) => c.json(await getStore().folderThreads(user(c), c.req.param('name'))));
  app.put('/threads/:id/folder', async (c) => c.json(await getStore().fileThread(user(c), c.req.param('id'), await body(c))));
  app.delete('/threads/:id/folder', async (c) => c.json(await getStore().unfileThread(user(c), c.req.param('id'))));
  app.post('/threads/:id/pin', async (c) => c.json(await getStore().setPinned(user(c), c.req.param('id'), true)));
  app.delete('/threads/:id/pin', async (c) => c.json(await getStore().setPinned(user(c), c.req.param('id'), false)));
  app.get('/users', async (c) => c.json(await getStore().listUsers()));
  app.get('/files/:id/download', async (c) => {
    const f = await getStore().downloadFile(user(c), c.req.param('id'));
    if (!f) throw new ApiFailure('NotFound', 'file not found');
    return new Response(f.data, { headers: { 'content-type': f.contentType, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}` } });
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createApiFoldersFilesRoute();
