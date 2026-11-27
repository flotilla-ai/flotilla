import { Hono, type Context } from 'hono';
import { devicesPairingStore } from '../devices-pairing/index.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Owner-facing paired-device management. */
export function createDevicesPairingRoute(store = devicesPairingStore()) {
  const app = new Hono();
  app.post('/pairing-codes', async (c) => { c.header('x-flotilla-no-replay', 'true'); return c.json(await store.createPairing(userId(c)), 201); });
  app.get('/', async (c) => c.json({ items: await store.list(userId(c)) }));
  app.get('/machine-picker', async (c) => c.json(await store.machinePicker(userId(c))));
  app.patch('/:id', async (c) => c.json(await store.update(userId(c), c.req.param('id'), await body(c))));
  app.post('/:id/approve', async (c) => c.json(await store.approve(userId(c), c.req.param('id'))));
  app.post('/:id/revoke', async (c) => c.json(await store.revoke(userId(c), c.req.param('id'))));
  return { basePath: '/api/v1/devices', app, public: false };
}
export default createDevicesPairingRoute();
