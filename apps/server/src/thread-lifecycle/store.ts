import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import { migrate } from '../db/migrate.js';
import { EventStore, type Tx } from '../events/store.js';
import { BULK_ACTIONS, TITLE_MAX, type BulkThreadAction, type OwnershipTransfer, type RegenerateWhen, type ThreadAction, type ThreadCost, type ThreadLifecycle, type ThreadSettings, type TitleGenerator } from './types.js';

type Row = Record<string, any>;
const ACTIVE = ['queued', 'working'];
const WHEN: (RegenerateWhen | null)[] = ['never', 'first-message', 'each-message', null];
const str = (v: unknown, max: number, what: string): string => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new ApiFailure('ValidationFailed', `${what} must be 1-${max} characters`);
  return v.trim();
};

/** Collapses whitespace and cuts at a word boundary so titles never exceed TITLE_MAX characters. */
export function clipTitle(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s.length <= TITLE_MAX) return s;
  const cut = s.slice(0, TITLE_MAX + 1); const i = cut.lastIndexOf(' ');
  return (i > 20 ? cut.slice(0, i) : s.slice(0, TITLE_MAX)).trim();
}
/** Offline default: titles from the latest user message. A model-backed generator receives the same instructions. */
export const heuristicTitle: TitleGenerator = async ({ messages }) => clipTitle(messages.at(-1) ?? 'Untitled thread');

// Unread = agent replies (streamed deltas of one run count once), approvals, and other people's messages after the viewer's read mark.
const UNREAD = `e.thread_id=t.id AND e.seq>COALESCE(m.last_read_seq,0) AND (e.kind IN ('agent.delta','agent.message','approval.requested') OR (e.kind='user.message' AND e.payload->>'by'<>$1))`;
const VIEW = `SELECT t.*, m.user_id AS m_user, m.joined, m.subscribed, m.last_read_seq, m.marked_unread, COALESCE(x.unread_count,0)::int AS unread_count, COALESCE(x.mentions,0)::int AS mentions
  FROM threads t JOIN users u ON u.id=$1 LEFT JOIN thread_members m ON m.thread_id=t.id AND m.user_id=$1
  LEFT JOIN LATERAL (SELECT count(*) AS unread_count, count(*) FILTER (WHERE g.mention) AS mentions FROM (
    SELECT bool_and(e.kind<>'approval.requested') AND position(lower('@'||split_part(u.email,'@',1)) IN lower(string_agg(COALESCE(e.payload->>'text',''), '' ORDER BY e.seq)))>0 AS mention
    FROM events e WHERE ${UNREAD} GROUP BY CASE WHEN e.kind='agent.delta' AND e.run_id IS NOT NULL THEN 'run:'||e.run_id ELSE e.id END) g) x ON true`;
const toView = (r: Row): ThreadLifecycle => ({
  id: r.id, code: r.code, title: r.title, titleSource: r.title_source, status: r.status, ownerId: r.owner_id, visibility: r.visibility,
  archivedAt: r.archived_at?.toISOString() ?? null, pinned: r.pinned, tags: r.tags, folder: r.folder,
  member: r.m_user ? { userId: r.m_user, joined: r.joined === true, subscribed: r.subscribed, lastReadSeq: r.last_read_seq, markedUnread: r.marked_unread } : null,
  unread: Boolean(r.marked_unread) || r.unread_count > 0, unreadCount: r.unread_count, mentions: r.mentions
});

export class ThreadLifecycleStore {
  readonly pool: pg.Pool;
  private readonly events: EventStore;
  private ready?: Promise<unknown>;
  private readonly deleteHooks: ((threadId: string) => Promise<void>)[] = [];
  titles: TitleGenerator = heuristicTitle;
  constructor(private readonly databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); this.events = new EventStore(databaseUrl, this.pool); }
  onDelete(hook: (threadId: string) => Promise<void>): void { this.deleteHooks.push(hook); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }
  private emit(threadId: string, payload: Record<string, unknown>, apply: (tx: Tx) => Promise<unknown>, source: 'user' | 'kernel' = 'user') {
    return this.events.appendEvents(threadId as never, [{ threadId: threadId as never, runId: null, kind: 'thread.status', source, trust: 'trusted', payload }], { apply: async (tx) => { await apply(tx); } });
  }
  private async member(threadId: string, userId: string, set: string, params: unknown[] = [], tx: Tx = this.pool) {
    await tx.query('INSERT INTO thread_members (thread_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [threadId, userId]);
    await tx.query(`UPDATE thread_members SET ${set} WHERE thread_id=$1 AND user_id=$2`, [threadId, userId, ...params]);
  }

  async view(threadId: string, userId: string): Promise<ThreadLifecycle> {
    const r = (await this.q(`${VIEW} WHERE t.id=$2`, [userId, threadId]))[0];
    if (!r || (r.owner_id !== userId && r.visibility !== 'shared' && !r.joined)) throw new ApiFailure('NotFound', 'thread not found');
    return toView(r);
  }
  async list(userId: string, archived: 'exclude' | 'only' | 'all' = 'exclude'): Promise<ThreadLifecycle[]> {
    const filter = archived === 'all' ? '' : archived === 'only' ? 'AND t.archived_at IS NOT NULL' : 'AND t.archived_at IS NULL';
    return (await this.q(`${VIEW} WHERE (t.owner_id=$1 OR m.joined OR (t.visibility='shared' AND m.joined IS NOT FALSE)) ${filter} ORDER BY t.pinned DESC, t.updated_at DESC, t.id`, [userId])).map(toView);
  }

  async apply(threadId: string, userId: string, a: ThreadAction): Promise<ThreadLifecycle | null> {
    const v = await this.view(threadId, userId);
    const owner = v.ownerId === userId;
    const participant = () => { if (!owner && !v.member?.joined) throw new ApiFailure('Forbidden', 'join the thread first'); };
    const ownerOnly = () => { if (!owner) throw new ApiFailure('Forbidden', 'only the thread owner can do this'); };
    const by = { by: userId };
    const set = (sql: string, params: unknown[] = []) => (tx: Tx) => tx.query(`UPDATE threads SET ${sql}, updated_at=now() WHERE id=$1`, [threadId, ...params]);
    switch (a.action) {
      case 'rename': { participant(); const title = str(a.title, 200, 'title'); await this.emit(threadId, { action: 'renamed', title, ...by }, set(`title=$2, title_source='user'`, [title])); break; }
      case 'regenerate-title': participant(); await this.regenerate(threadId, by); break;
      case 'archive': participant(); await this.archive(threadId, v.status, by); break;
      case 'unarchive': participant(); await this.unarchive(threadId, by); break;
      case 'delete': await this.remove(threadId, v, owner); return null;
      case 'read': await this.member(threadId, userId, `last_read_seq=COALESCE((SELECT max(seq) FROM events WHERE thread_id=$1),0), marked_unread=false`); break;
      case 'unread': await this.member(threadId, userId, 'marked_unread=true'); break;
      case 'subscribe': case 'unsubscribe': await this.member(threadId, userId, `subscribed=${a.action === 'subscribe'}`); break;
      case 'join': if (!owner && !v.member?.joined) await this.emit(threadId, { action: 'joined', ...by }, (tx) => this.member(threadId, userId, 'joined=true, subscribed=true', [], tx)); break;
      case 'leave':
        if (owner) throw new ApiFailure('Conflict', 'transfer ownership before leaving');
        if (v.member?.joined) await this.emit(threadId, { action: 'left', ...by }, (tx) => this.member(threadId, userId, 'joined=false, subscribed=false', [], tx));
        if (v.visibility === 'private') return null;
        break;
      case 'takeover': if (!owner && v.visibility !== 'shared') throw new ApiFailure('Forbidden', 'only shared threads can be taken over');
        if (!owner) await this.transfer({ threadId: v.id, from: v.ownerId, to: userId as never, via: 'takeover' }); break;
      case 'transfer': {
        ownerOnly();
        const to = str(a.toUserId, 200, 'toUserId');
        if (!(await this.q('SELECT 1 FROM users WHERE id=$1', [to]))[0]) throw new ApiFailure('NotFound', 'user not found');
        if (to !== userId) await this.transfer({ threadId: v.id, from: v.ownerId, to: to as never, via: 'transfer' });
        break;
      }
      case 'visibility':
        ownerOnly();
        if (a.visibility !== 'private' && a.visibility !== 'shared') throw new ApiFailure('ValidationFailed', 'visibility must be private or shared');
        await this.emit(threadId, { action: 'visibility', visibility: a.visibility, ...by }, set('visibility=$2', [a.visibility]));
        break;
      case 'pin': case 'unpin': participant(); await this.emit(threadId, { action: a.action === 'pin' ? 'pinned' : 'unpinned', ...by }, set(`pinned=${a.action === 'pin'}`)); break;
      case 'tag': { participant(); const tag = str(a.tag, 40, 'tag'); await this.emit(threadId, { action: 'tagged', tag, ...by }, set(`tags=(SELECT jsonb_agg(DISTINCT x ORDER BY x) FROM jsonb_array_elements_text(tags || to_jsonb($2::text)) x)`, [tag])); break; }
      case 'untag': { participant(); const tag = str(a.tag, 40, 'tag'); await this.emit(threadId, { action: 'untagged', tag, ...by }, set('tags=tags - $2::text', [tag])); break; }
      case 'file': { participant(); const folder = a.folder === null ? null : str(a.folder, 80, 'folder'); await this.emit(threadId, { action: 'filed', folder, ...by }, set('folder=$2', [folder])); break; }
      default: throw new ApiFailure('ValidationFailed', 'unknown action');
    }
    return this.view(threadId, userId);
  }

  async bulk(userId: string, body: BulkThreadAction): Promise<{ id: string; ok: boolean; code?: string; error?: string }[]> {
    if (!BULK_ACTIONS.includes(body?.action as never)) throw new ApiFailure('ValidationFailed', `action must be one of ${BULK_ACTIONS.join(', ')}`);
    if (!Array.isArray(body.threadIds) || !body.threadIds.length || body.threadIds.length > 200 || body.threadIds.some((x) => typeof x !== 'string')) throw new ApiFailure('ValidationFailed', 'threadIds must list 1-200 thread ids');
    const results = [];
    for (const id of body.threadIds) {
      try { await this.apply(id, userId, body); results.push({ id, ok: true }); }
      catch (err) { if (!(err instanceof ApiFailure)) throw err; results.push({ id, ok: false, code: `flotilla/${err.kind}`, error: err.message }); }
    }
    return results;
  }

  async readAll(userId: string): Promise<number> {
    const rows = await this.q(`INSERT INTO thread_members (thread_id,user_id,last_read_seq)
      SELECT t.id,$1,COALESCE((SELECT max(seq) FROM events WHERE thread_id=t.id),0) FROM threads t LEFT JOIN thread_members m ON m.thread_id=t.id AND m.user_id=$1 WHERE t.owner_id=$1 OR m.joined OR (t.visibility='shared' AND m.joined IS NOT FALSE)
      ON CONFLICT (thread_id,user_id) DO UPDATE SET last_read_seq=EXCLUDED.last_read_seq, marked_unread=false RETURNING thread_id`, [userId]);
    return rows.length;
  }

  private async archive(threadId: string, status: string, payload: Record<string, unknown>, source: 'user' | 'kernel' = 'user') {
    if (status === 'archived') return;
    if (ACTIVE.includes(status)) throw new ApiFailure('Conflict', 'stop the thread before archiving it');
    await this.emit(threadId, { action: 'archived', status: 'archived', ...payload }, (tx) => tx.query(`UPDATE threads SET archived_from=status, status='archived', archived_at=now(), updated_at=now() WHERE id=$1 AND status NOT IN ('queued','working','archived')`, [threadId]), source);
  }
  private async unarchive(threadId: string, payload: Record<string, unknown>, source: 'user' | 'kernel' = 'user') {
    await this.emit(threadId, { action: 'unarchived', ...payload }, (tx) => tx.query(`UPDATE threads SET status=CASE WHEN status='archived' THEN COALESCE(archived_from,'idle') ELSE status END, archived_at=NULL, archived_from=NULL, updated_at=now() WHERE id=$1`, [threadId]), source);
  }
  private async remove(threadId: string, v: ThreadLifecycle, owner: boolean) {
    if (!owner && (v.visibility === 'private' || !v.member?.joined)) throw new ApiFailure('Forbidden', v.visibility === 'private' ? 'only the owner can delete a private thread' : 'join the thread first');
    if (ACTIVE.includes(v.status)) throw new ApiFailure('Conflict', 'stop the thread before deleting it');
    for (const hook of this.deleteHooks) await hook(threadId);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE threads SET parent_id=NULL WHERE parent_id=$1', [threadId]);
      await client.query('UPDATE threads SET crew_of=NULL WHERE crew_of=$1', [threadId]);
      await client.query(`DELETE FROM secrets WHERE scope='thread' AND scope_id=$1`, [threadId]);
      await client.query('DELETE FROM threads WHERE id=$1', [threadId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }
  /** Ownership moves; connections reset so the new owner's own logins apply. Vendor logins and personal secrets never move. */
  private async transfer(t: OwnershipTransfer) {
    const ok = await this.q('SELECT 1 FROM threads t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=$1 AND (t.project_id IS NULL OR p.owner_id=$2)', [t.threadId, t.to]);
    if (!ok[0]) throw new ApiFailure('Conflict', 'the new owner must own the thread project');
    await this.emit(t.threadId, { action: t.via, from: t.from, to: t.to, by: t.via === 'takeover' ? t.to : t.from }, async (tx) => {
      await tx.query(`UPDATE threads SET owner_id=$2, engine=engine || '{"connectionId":null}'::jsonb, crew_of=NULL, updated_at=now() WHERE id=$1`, [t.threadId, t.to]);
      await tx.query('UPDATE threads SET crew_of=NULL, updated_at=now() WHERE crew_of=$1', [t.threadId]);
      for (const u of [t.from, t.to]) await this.member(t.threadId, u, 'joined=true, subscribed=true', [], tx);
    });
  }

  async settings(scope: 'org' | 'user', scopeId: string): Promise<ThreadSettings> {
    const r = (await this.q('SELECT * FROM thread_settings WHERE scope=$1 AND scope_id=$2', [scope, scopeId]))[0];
    return { titleInstructions: r?.title_instructions ?? '', regenerateWhen: r?.regenerate_when ?? null, autoArchiveDays: r?.auto_archive_days ?? null };
  }
  async putSettings(scope: 'org' | 'user', scopeId: string, body: Partial<ThreadSettings>): Promise<ThreadSettings> {
    const next = { ...(await this.settings(scope, scopeId)), ...body };
    if (typeof next.titleInstructions !== 'string' || next.titleInstructions.length > 2000) throw new ApiFailure('ValidationFailed', 'titleInstructions must be a string up to 2000 characters');
    if (!WHEN.includes(next.regenerateWhen)) throw new ApiFailure('ValidationFailed', 'regenerateWhen must be never, first-message, each-message or null');
    if (next.autoArchiveDays !== null && (!Number.isInteger(next.autoArchiveDays) || next.autoArchiveDays < 0 || next.autoArchiveDays > 3650)) throw new ApiFailure('ValidationFailed', 'autoArchiveDays must be 0-3650 or null');
    await this.q(`INSERT INTO thread_settings (scope,scope_id,title_instructions,regenerate_when,auto_archive_days) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (scope,scope_id) DO UPDATE SET title_instructions=$3, regenerate_when=$4, auto_archive_days=$5`, [scope, scopeId, next.titleInstructions, next.regenerateWhen, next.autoArchiveDays]);
    return next;
  }
  async isAdmin(userId: string): Promise<boolean> { return (await this.q(`SELECT 1 FROM users WHERE id=$1 AND role='admin'`, [userId])).length > 0; }

  private async regenerate(threadId: string, payload: Record<string, unknown>, source: 'user' | 'kernel' = 'user') {
    const t = (await this.q('SELECT owner_id FROM threads WHERE id=$1', [threadId]))[0];
    const messages = (await this.q(`SELECT payload->>'text' AS text FROM events WHERE thread_id=$1 AND kind='user.message' ORDER BY seq DESC LIMIT 20`, [threadId])).map((r) => String(r.text ?? '')).reverse();
    const [org, me] = await Promise.all([this.settings('org', 'org'), this.settings('user', t.owner_id)]);
    const title = clipTitle(await this.titles({ messages, instructions: [org.titleInstructions, me.titleInstructions].filter(Boolean) })) || clipTitle(await heuristicTitle({ messages, instructions: [] }));
    await this.emit(threadId, { action: 'title-regenerated', title, ...payload }, (tx) => tx.query(`UPDATE threads SET title=$2, title_source='auto', updated_at=now() WHERE id=$1`, [threadId, title]), source);
  }

  /** Reacts to a committed event: a user message unarchives the thread and may regenerate an auto title. */
  async onEvent(threadId: string, seq: number): Promise<void> {
    const e = (await this.q('SELECT kind FROM events WHERE thread_id=$1 AND seq=$2', [threadId, seq]))[0];
    if (e?.kind !== 'user.message') return;
    const t = (await this.q('SELECT owner_id, archived_at, title_source FROM threads WHERE id=$1', [threadId]))[0];
    if (!t) return;
    if (t.archived_at) await this.unarchive(threadId, { via: 'message' }, 'kernel');
    if (t.title_source !== 'auto') return;
    const [org, me] = await Promise.all([this.settings('org', 'org'), this.settings('user', t.owner_id)]);
    const when = me.regenerateWhen ?? org.regenerateWhen ?? 'never';
    const first = when === 'first-message' && (await this.q(`SELECT count(*)::int c FROM events WHERE thread_id=$1 AND kind='user.message'`, [threadId]))[0].c === 1;
    if (when === 'each-message' || first) await this.regenerate(threadId, { via: 'message' }, 'kernel');
  }
  async listen(): Promise<() => Promise<void>> {
    await this.q('SELECT 1');
    const client = new pg.Client({ connectionString: this.databaseUrl });
    await client.connect();
    let chain = Promise.resolve();
    client.on('notification', (msg) => {
      let n: { threadId?: string; seq?: number };
      try { n = JSON.parse(msg.payload ?? ''); } catch { return; }
      if (typeof n.threadId === 'string' && typeof n.seq === 'number') chain = chain.then(() => this.onEvent(n.threadId!, n.seq!)).catch((err) => console.error('thread-lifecycle', err));
    });
    await client.query('LISTEN flotilla_events');
    return async () => { await chain; await client.end(); };
  }

  /** Archives threads idle longer than the owner's (else org's) autoArchiveDays; null/0 = off (default). */
  async archiveIdle(now = new Date()): Promise<string[]> {
    const days = 'NULLIF(COALESCE(us.auto_archive_days, os.auto_archive_days),0)';
    const rows = await this.q(`SELECT t.id, t.status FROM threads t
      LEFT JOIN thread_settings us ON us.scope='user' AND us.scope_id=t.owner_id
      LEFT JOIN thread_settings os ON os.scope='org' AND os.scope_id='org'
      WHERE t.status IN ('idle','waiting','failed') AND NOT t.pinned AND t.needs_you='[]'::jsonb AND ${days} IS NOT NULL
        AND COALESCE((SELECT max(at) FROM events e WHERE e.thread_id=t.id), t.updated_at) < $1::timestamptz - make_interval(days => ${days})
        AND NOT EXISTS (SELECT 1 FROM prs p WHERE p.thread_id=t.id AND NOT EXISTS (SELECT 1 FROM events e WHERE e.thread_id=t.id AND e.kind IN ('pr.merged','pr.closed') AND e.payload->>'number'=p.number::text))`, [now.toISOString()]);
    for (const r of rows) await this.archive(r.id, r.status, { via: 'idle' }, 'kernel');
    return rows.map((r) => r.id);
  }

  async cost(threadId: string, userId: string): Promise<ThreadCost> {
    await this.view(threadId, userId);
    const sum = (k: string) => `COALESCE(sum((delta->>'${k}')::bigint),0)::bigint AS "${k}"`;
    const cols = ['usd', 'inputTokens', 'outputTokens', 'cacheTokens', 'machineSec'].map(sum).join(',');
    const num = (r: Row) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, k === 'model' || k === 'machineId' ? x : Number(x)])) as Row;
    const total = num((await this.q(`SELECT ${cols} FROM cost_entries WHERE thread_id=$1`, [threadId]))[0]);
    const byModel = (await this.q(`SELECT model, ${cols} FROM cost_entries WHERE thread_id=$1 AND source<>'machine-estimate' GROUP BY model ORDER BY model NULLS LAST`, [threadId])).map(num).map(({ model, inputTokens, outputTokens, cacheTokens, usd }) => ({ model, inputTokens, outputTokens, cacheTokens, usd }));
    const machine = num((await this.q(`SELECT t.machine_id AS "machineId", ${cols} FROM threads t LEFT JOIN cost_entries c ON c.thread_id=t.id AND c.source='machine-estimate' WHERE t.id=$1 GROUP BY t.machine_id`, [threadId]))[0]);
    return { threadId: threadId as never, total: total as never, byKind: { input: total.inputTokens, output: total.outputTokens, cache: total.cacheTokens },
      byModel, byMachine: machine.machineSec || machine.usd ? [{ machineId: machine.machineId, machineSec: machine.machineSec, usd: machine.usd }] : [] };
  }
}

const stores = new Map<string, ThreadLifecycleStore>();
export function threadLifecycle(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): ThreadLifecycleStore {
  let s = stores.get(databaseUrl);
  if (!s) stores.set(databaseUrl, (s = new ThreadLifecycleStore(databaseUrl)));
  return s;
}
