import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import type { ThreadRunner } from '../runner/runner.js';
import { defaultRunner } from './threads.route.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
const text = (b: Record<string, unknown>) => { if (typeof b.text !== 'string' || !b.text.trim()) throw new ApiFailure('ValidationFailed', 'text required'); return b.text; };
const camel = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, x) => x.toUpperCase()), v]));

/** Durable thread inbox (queue / steer / interrupt), message versions, retry, context meter and request-card actions. */
export function createRunnerQueueRoute(runner: ThreadRunner | (() => ThreadRunner) = defaultRunner) {
  const r = () => (typeof runner === 'function' ? runner() : runner);
  const app = new Hono();
  const owned = async (c: Context) => { await r().assertOwner(c.req.param('id')!, userId(c)); return c.req.param('id')!; };
  app.get('/threads/:id/inbox', async (c) => { const id = await owned(c); await r().resumePending(); return c.json(await r().inbox.view(id)); });
  app.post('/threads/:id/inbox', async (c) => {
    const b = await body(c); const id = await owned(c);
    return c.json(await r().message(id, text(b), (b.mode ?? 'queue') as never, userId(c), (b.attachments ?? []) as string[]), 202);
  });
  app.patch('/threads/:id/inbox/:item', async (c) => { const b = await body(c); const id = await owned(c); return c.json({ item: await r().inbox.edit(id, c.req.param('item'), text(b)) }); });
  app.delete('/threads/:id/inbox/:item', async (c) => { const id = await owned(c); return c.json({ item: await r().inbox.cancel(id, c.req.param('item')) }); });
  app.post('/threads/:id/inbox/:item/send', async (c) => { const id = await owned(c); return c.json({ item: await r().sendNow(id, c.req.param('item')) }, 202); });
  app.get('/threads/:id/inbox/:item/versions', async (c) => { const id = await owned(c); return c.json({ items: await r().inbox.versions(id, c.req.param('item')) }); });
  app.post('/threads/:id/inbox/:item/versions', async (c) => { const b = await body(c); return c.json({ item: await r().newVersion(c.req.param('id'), c.req.param('item'), text(b), userId(c)) }, 201); });
  app.post('/threads/:id/retry', async (c) => { const b = await body(c); return c.json({ item: await r().retry(c.req.param('id'), userId(c), { model: b.model as string | undefined, connectionId: b.connectionId as string | undefined, effort: b.effort as string | null | undefined }) }, 202); });
  app.get('/threads/:id/context', async (c) => c.json(await r().context(c.req.param('id'), userId(c))));
  app.patch('/threads/:id/context', async (c) => { const b = await body(c); return c.json(await r().context(c.req.param('id'), userId(c), b.compactAt ?? null)); });

  const card = async (c: Context, set: string, args: unknown[] = []) => {
    const rows = await r().pool.query(`UPDATE approvals a SET ${set} FROM threads t WHERE a.id=$1 AND t.id=a.thread_id AND t.owner_id=$2 AND a.state='open' RETURNING a.*`, [c.req.param('id'), userId(c), ...args]);
    const row = rows.rows[0]; if (!row) throw new ApiFailure('NotFound', 'request not found');
    await r().deps.store.appendEvents(row.thread_id, [{ runId: null, kind: 'approval.updated', source: 'user', trust: 'trusted', payload: { approvalId: row.id, state: row.state, snoozedUntil: row.snoozed_until } }] as never);
    return c.json(camel(row));
  };
  app.post('/approvals/:id/later', async (c) => { const b = await body(c); const minutes = Number(b.minutes ?? 60); if (!(minutes > 0 && minutes <= 10_080)) throw new ApiFailure('ValidationFailed', 'minutes must be 1..10080'); return card(c, `snoozed_until=now() + make_interval(mins => $3)`, [minutes]); });
  app.post('/approvals/:id/dismiss', (c) => card(c, `state='dismissed'`));
  app.post('/captains/:id/approvals/dismiss', async (c) => {
    const rows = await r().pool.query(`UPDATE approvals a SET state='dismissed' FROM threads cap WHERE cap.id=$1 AND cap.owner_id=$2 AND a.state='open' AND (a.captain_id=$1 OR a.thread_id IN (SELECT id FROM threads WHERE crew_of=$1)) RETURNING a.id,a.thread_id`, [c.req.param('id'), userId(c)]);
    for (const row of rows.rows) await r().deps.store.appendEvents(row.thread_id, [{ runId: null, kind: 'approval.updated', source: 'user', trust: 'trusted', payload: { approvalId: row.id, state: 'dismissed' } }] as never);
    return c.json({ dismissed: rows.rowCount });
  });
  return { basePath: '/api/v1', app, public: false };
}
export default createRunnerQueueRoute();
