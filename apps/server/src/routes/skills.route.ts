import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { skillStore } from '../skills/store.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, any>;
const SOURCES = ['builtin', 'repo', 'drive', 'plugin'];

/** Skills page (load states, markers), Drive/plugin skill folders, copy-import from other tools, invocation preview and per-thread invocations. */
export function createSkillsRoute(store = () => skillStore()) {
  const app = new Hono();
  app.get('/skills', async (c) => c.json({ items: await store().list(userId(c), await store().ownedProject(userId(c), c.req.query('projectId'))) }));
  app.post('/skills', async (c) => {
    const b = await body(c);
    if (b.source !== 'drive' && b.source !== 'plugin') throw new ApiFailure('ValidationFailed', 'source must be drive or plugin');
    if (b.source === 'plugin' && (typeof b.plugin !== 'string' || !b.plugin)) throw new ApiFailure('ValidationFailed', 'plugin skills need a plugin name');
    if (typeof b.folder !== 'string' || !/^[\w.-]{1,64}$/.test(b.folder) || typeof b.files?.['SKILL.md'] !== 'string') throw new ApiFailure('ValidationFailed', 'folder and files["SKILL.md"] are required');
    if (Object.entries(b.files).some(([p, v]) => typeof v !== 'string' || !p || p.startsWith('/') || p.split('/').some((s) => !s || s === '..' || s === '.'))) throw new ApiFailure('ValidationFailed', 'files must map relative paths to strings');
    return c.json(await store().save(userId(c), { source: b.source, projectId: b.projectId, plugin: b.plugin, folder: b.folder, files: b.files }));
  });
  app.post('/skills/import', async (c) => { const b = await body(c); if (!Array.isArray(b.files)) throw new ApiFailure('ValidationFailed', 'files must be an array'); return c.json({ items: await store().import(userId(c), { from: b.from, projectId: b.projectId, files: b.files }) }); });
  app.put('/skills/disabled', async (c) => {
    const b = await body(c);
    if (!SOURCES.includes(b.source) || typeof b.name !== 'string' || typeof b.disabled !== 'boolean') throw new ApiFailure('ValidationFailed', 'source, name and disabled are required');
    await store().setDisabled(userId(c), b.source, b.name, b.disabled); return c.json({ ok: true });
  });
  app.post('/skills/resolve', async (c) => { const b = await body(c); if (typeof b.text !== 'string') throw new ApiFailure('ValidationFailed', 'text is required'); return c.json({ invocations: await store().resolve(userId(c), await store().ownedProject(userId(c), b.projectId), b.text) }); });
  app.delete('/skills/:id', async (c) => { await store().remove(userId(c), c.req.param('id')); return c.body(null, 204); });
  app.get('/threads/:id/skills', async (c) => { await store().ownedThread(userId(c), c.req.param('id')); return c.json({ invocations: await store().invocations(c.req.param('id')) }); });
  return { basePath: '/api/v1', app, public: false };
}
export default createSkillsRoute();
