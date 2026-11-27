import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { WakeRouter } from '../wakes/router.js';
import { defaultRunner } from './threads.route.js';

let singleton: WakeRouter | null = null;
export function defaultWakeRouter(): WakeRouter { singleton ??= new WakeRouter({ runner: defaultRunner() }); return singleton; }
const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, any>;

/** Watches, timers, waiting state, background jobs, cross-thread read/send, held messages and per-event response settings. */
export function createWakesRoute(router: WakeRouter | (() => WakeRouter) = defaultWakeRouter) {
  const r = () => (typeof router === 'function' ? router() : router);
  const app = new Hono();
  const owned = async (c: Context) => { await r().deps.runner.assertOwner(c.req.param('id')!, userId(c)); return c.req.param('id')!; };
  app.get('/me/watches', async (c) => c.json({ watches: await r().watches(userId(c)) }));
  app.delete('/watches/:wid', async (c) => c.json(await r().stop(c.req.param('wid'), userId(c))));
  app.get('/threads/:id/waiting', async (c) => c.json(await r().waiting(await owned(c))));
  app.post('/threads/:id/watches', async (c) => { const b = await body(c); return c.json(await r().watchPr(await owned(c), String(b.repo ?? ''), Number(b.number), b.what ?? 'checks'), 201); });
  app.post('/threads/:id/timers', async (c) => { const b = await body(c); return c.json(await r().timer(await owned(c), Number(b.inSec), String(b.note ?? '')), 201); });
  app.post('/threads/:id/jobs', async (c) => { const b = await body(c); return c.json(await r().startJob(await owned(c), { kind: b.kind === 'transfer' ? 'transfer' : 'command', argv: b.argv, timeoutSec: b.timeoutSec, maxUsd: b.maxUsd ?? null, label: b.label }), 202); });
  app.get('/threads/:id/peek', async (c) => c.json(await r().peek(c.req.param('id'), userId(c), { q: c.req.query('q'), save: c.req.query('save') === '1' })));
  app.post('/threads/:id/send', async (c) => { const b = await body(c); if (typeof b.text !== 'string' || !b.text.trim() || typeof b.to !== 'string') throw new ApiFailure('ValidationFailed', 'to and text required'); return c.json(await r().send(c.req.param('id'), b.to, b.text, userId(c)), 202); });
  app.put('/threads/:id/hold', async (c) => { const id = await owned(c); const hold = (await body(c)).hold === true; await r().pool.query('UPDATE threads SET hold_incoming=$2 WHERE id=$1', [id, hold]); return c.json({ hold }); });
  app.get('/threads/:id/held', async (c) => c.json({ items: await r().held(await owned(c)) }));
  app.post('/held/:hid/:verb{allow|decline}', async (c) => c.json(await r().release(c.req.param('hid'), userId(c), c.req.param('verb') === 'allow')));
  const scope = async (c: Context, write: boolean): Promise<['org' | 'user', string]> => {
    if (c.req.param('scope') === 'me') return ['user', userId(c)];
    if (c.req.param('scope') !== 'org') throw new ApiFailure('NotFound', 'settings scope not found');
    if (write && !(await r().pool.query(`SELECT 1 FROM users WHERE id=$1 AND role='admin'`, [userId(c)])).rows.length) throw new ApiFailure('Forbidden', 'only admins can change org settings');
    return ['org', 'org'];
  };
  app.get('/wake-settings/:scope', async (c) => c.json(await r().settings(...(await scope(c, false)))));
  app.put('/wake-settings/:scope', async (c) => { const [s, id] = await scope(c, true); return c.json(await r().putSettings(s, id, await body(c))); });
  app.get('/wake-settings/me/effective', async (c) => c.json(await r().policy(userId(c))));
  return { basePath: '/api/v1', app, public: false };
}
export default createWakesRoute();
