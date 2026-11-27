import { Hono } from 'hono';
import { driveStore } from '../drive-core/store.js';

/** Anonymous Drive share links. The unguessable token is the capability; read links never write. */
export function createDriveShareRoute(store = () => driveStore()) {
  const app = new Hono();
  app.get('/drive/shared/:token/content', async (c) => {
    const { item } = await store().shared(c.req.param('token')!);
    return c.body(new Uint8Array(await store().content(item)), 200, { 'content-type': 'application/octet-stream', 'x-content-type-options': 'nosniff' });
  });
  app.put('/drive/shared/:token/content', async (c) => {
    const item = await store().saveShared(c.req.param('token')!, Buffer.from(await c.req.arrayBuffer()));
    return c.json({ id: item.id, version: item.version });
  });
  return { basePath: '/api/v1', app, public: true };
}
export default createDriveShareRoute();
