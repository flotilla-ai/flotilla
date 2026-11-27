import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ApiFailure, apiErrorStatus } from '../api-platform/types.js';
import { driveStore } from '../drive-core/store.js';
import { CARDS, DEFAULT_LIMITS, DriveFailure, parsePath, parseScope } from '../drive-core/types.js';

const userId = (c: Context) => c.get('userId') as string;
const failure = (c: Context, err: DriveFailure) => c.json({ error: err.message, code: `flotilla/${err.kind}`, card: err.card }, apiErrorStatus[err.kind]);
const carded = (fn: (c: Context) => Promise<Response>) => async (c: Context) => { try { return await fn(c); } catch (err) { if (err instanceof DriveFailure) return failure(c, err); throw err; } };

/** Drive: scoped items, uploads (32 MB), versions and restore, and what a thread gets mounted. */
export function createDriveRoute(store = () => driveStore()) {
  const app = new Hono();
  const scope = async (c: Context, write = false) => { const s = parseScope(c.req.query('scope'), userId(c)); await store().access(userId(c), s, write); return s; };
  app.get('/drive/scopes', async (c) => c.json({ items: await store().scopes(userId(c)) }));
  app.get('/drive/items', async (c) => { const s = await scope(c); const parent = c.req.query('parent'); return c.json({ items: await store().list(s, parent ? parsePath(parent) : undefined) }); });
  app.put('/drive/files', bodyLimit({ maxSize: DEFAULT_LIMITS.uploadBytes, onError: (c) => failure(c, new DriveFailure(CARDS.upload_too_large(c.req.query('path') ?? 'the file'))) }), carded(async (c) => {
    const path = parsePath(c.req.query('path')); const s = await scope(c, true); const base = c.req.query('baseVersion');
    if (base !== undefined && !/^\d+$/.test(base)) throw new ApiFailure('ValidationFailed', 'baseVersion must be a version number');
    return c.json(await store().save(s, path, Buffer.from(await c.req.arrayBuffer()), { by: userId(c), source: 'upload', upload: true, baseVersion: base === undefined ? undefined : Number(base) }));
  }));
  app.get('/drive/items/:id', async (c) => c.json(await store().item(userId(c), c.req.param('id')!)));
  app.get('/drive/items/:id/content', async (c) => {
    const item = await store().item(userId(c), c.req.param('id')!);
    return c.body(new Uint8Array(await store().content(item)), 200, { 'content-type': 'application/octet-stream', 'x-content-type-options': 'nosniff', 'x-flotilla-drive-version': String(item.version), 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(item.name)}` });
  });
  app.delete('/drive/items/:id', async (c) => { await store().remove(await store().item(userId(c), c.req.param('id')!, true)); return c.body(null, 204); });
  app.get('/drive/items/:id/versions', async (c) => c.json({ items: await store().versions(await store().item(userId(c), c.req.param('id')!)) }));
  app.get('/drive/items/:id/versions/:version/content', async (c) => {
    const item = await store().item(userId(c), c.req.param('id')!); const version = Number(c.req.param('version'));
    if (!Number.isInteger(version)) throw new ApiFailure('ValidationFailed', 'version must be a number');
    return c.body(new Uint8Array(await store().versionContent(item, version)), 200, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
  });
  app.get('/drive/items/:id/compare', async (c) => {
    const item = await store().item(userId(c), c.req.param('id')!); const a = Number(c.req.query('a')); const b = Number(c.req.query('b'));
    if (!Number.isInteger(a) || !Number.isInteger(b)) throw new ApiFailure('ValidationFailed', 'a and b version numbers are required');
    return c.json(await store().compare(item, a, b));
  });
  app.post('/drive/items/:id/shares', async (c) => {
    const item = await store().item(userId(c), c.req.param('id')!, true); const b = (await c.req.json().catch(() => null)) as { access?: unknown } | null;
    return c.json(await store().createShare(userId(c), item, b?.access), 201);
  });
  app.get('/drive/shares', async (c) => c.json({ items: await store().shares(userId(c)) }));
  app.delete('/drive/shares/:id', async (c) => { await store().revokeShare(userId(c), c.req.param('id')!); return c.body(null, 204); });
  app.post('/drive/items/:id/restore', carded(async (c) => {
    const item = await store().item(userId(c), c.req.param('id')!, true); const b = (await c.req.json().catch(() => null)) as { version?: unknown } | null;
    if (!Number.isInteger(b?.version)) throw new ApiFailure('ValidationFailed', 'version required');
    return c.json(await store().restore(item, b!.version as number, userId(c)));
  }));
  app.get('/threads/:id/drive', async (c) => c.json(await store().view(await store().ownedThread(userId(c), c.req.param('id')!))));
  app.get('/threads/:id/drive/copy', async (c) => c.body(new Uint8Array(await store().localCopy(await store().ownedThread(userId(c), c.req.param('id')!))), 200, { 'content-type': 'application/x-tar', 'x-flotilla-drive-sync': 'none' }));
  return { basePath: '/api/v1', app, public: false };
}
export default createDriveRoute();
