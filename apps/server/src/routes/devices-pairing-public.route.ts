import { Hono } from 'hono';
import { devicesPairingStore } from '../devices-pairing/index.js';

/** Public device-runner pairing claim and heartbeat endpoints. Pairing codes/tokens are bearer capabilities; only hashes are stored. */
export function createDevicesPairingPublicRoute(store = devicesPairingStore()) {
  const app = new Hono();
  app.post('/pair', async (c) => { const b = await c.req.json().catch(() => ({})); return c.json(await store.claimPairing(String(b.code ?? ''), b), 201); });
  app.post('/heartbeat', async (c) => { const b = await c.req.json().catch(() => ({})); return c.json(await store.heartbeat(c.req.header('authorization')?.replace(/^Bearer /, '') ?? '', String(b.status ?? 'online') as 'online')); });
  app.post('/folders', async (c) => c.json(await store.reportFolders(c.req.header('authorization')?.replace(/^Bearer /, '') ?? '', (await c.req.json().catch(() => ({}))).folders)));
  return { basePath: '/api/v1/device-pairing', app, public: true };
}
export default createDevicesPairingPublicRoute();
