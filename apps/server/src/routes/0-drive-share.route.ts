import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { driveStore } from '../drive-core/store.js';
import { DEFAULT_LIMITS } from '../drive-core/types.js';

async function readLimited(c: Context, max: number): Promise<Buffer | null> {
  if (Number(c.req.header('content-length') ?? 0) > max) return null;
  const reader = c.req.raw.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const next = await reader?.read(); if (!next || next.done) return Buffer.concat(chunks);
    size += next.value.length; if (size > max) { await reader!.cancel(); return null; }
    chunks.push(next.value);
  }
}

/** Anonymous Drive share links. The unguessable token is the capability; read links never write. */
export function createDriveShareRoute(store = () => driveStore()) {
  const app = new Hono();
  app.get('/drive/shared/:token/content', async (c) => {
    const { item } = await store().shared(c.req.param('token')!);
    return c.body(new Uint8Array(await store().content(item)), 200, { 'content-type': 'application/octet-stream', 'x-content-type-options': 'nosniff' });
  });
  app.put('/drive/shared/:token/content', async (c) => {
    const { share } = await store().shared(c.req.param('token')!);
    if (share.access !== 'write') throw new ApiFailure('Forbidden', 'share is read-only');
    const body = await readLimited(c, DEFAULT_LIMITS.uploadBytes);
    if (!body) throw new ApiFailure('PayloadTooLarge', 'shared upload too large');
    const item = await store().saveShared(c.req.param('token')!, body);
    return c.json({ id: item.id, version: item.version });
  });
  return { basePath: '/api/v1', app, public: true };
}
export default createDriveShareRoute();
