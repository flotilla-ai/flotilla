import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import { EventStore } from '../events/store.js';
import { threadLifecycle, type ThreadLifecycleStore } from '../thread-lifecycle/store.js';

/** A file attached in the composer; `fileId` is an `api_files` row the runner copies onto the agent's machine. */
export interface Attachment { fileId: string; name: string; contentType: string; size: number }
/** Per-browser send key; the other Enter combination inserts a newline. */
export interface ComposerKeymap { send: 'enter' | 'mod+enter' | 'shift+enter' }
export type RequestInline = { kind: 'env'; name: string } | { kind: 'desktop'; url: string } | { kind: 'feedback'; title: string; body: string } | null;
/** An open approval rendered as a card that says exactly what is needed. */
export interface RequestCard { id: string; threadId: string; kind: string; title: string; question: string; options: { id: string; label: string }[]; inline: RequestInline; state: string }
export interface ReadingPlace { threadId: string; seq: number | null; offset: number }
/** One heading-delimited part of an agent reply (the web splits replies; the type is shared by name). */
export interface ThreadSection { seq: number; index: number; heading: string | null; text: string }
export interface ThreadRef { id: string; code: string; title: string }

type Row = Record<string, any>;
const str = (v: unknown, max: number, name: string) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new ApiFailure('ValidationFailed', `${name} required (max ${max} chars)`); return v.trim(); };

export function requestCard(r: Row): RequestCard {
  const d = (r.detail ?? {}) as Row;
  const [title, inline]: [string, RequestInline] =
    d.pr ? [`Waiting on you to merge ${d.pr.repo}#${d.pr.number}`, null]
    : d.env ? [`Waiting on you to set ${d.env.name}`, { kind: 'env', name: d.env.name }]
    : d.desktop ? ['Waiting on you to use the desktop', { kind: 'desktop', url: d.desktop.url }]
    : d.feedback ? [`Waiting on you to approve feedback: ${d.feedback.title}`, { kind: 'feedback', title: d.feedback.title, body: d.feedback.body }]
    : [r.question, null];
  return { id: r.id, threadId: r.thread_id, kind: r.kind, title, question: r.question, options: r.options, inline, state: r.state };
}

export class ThreadComposerStore {
  readonly pool: pg.Pool;
  readonly lifecycle: ThreadLifecycleStore;
  constructor(databaseUrl: string, private readonly events = new EventStore(databaseUrl)) { this.pool = events.pool; this.lifecycle = threadLifecycle(databaseUrl); }
  private async owned(threadId: string, userId: string): Promise<Row> {
    const t = (await this.pool.query('SELECT id,code,owner_id FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId])).rows[0];
    if (!t) throw new ApiFailure('NotFound', 'thread not found');
    return t;
  }
  private event(threadId: string, kind: string, payload: unknown) { return this.events.appendEvents(threadId as never, [{ runId: null, kind, source: 'user', trust: 'trusted', payload }] as never); }

  async requests(threadId: string, userId: string): Promise<RequestCard[]> {
    await this.owned(threadId, userId);
    return (await this.pool.query(`SELECT * FROM approvals WHERE thread_id=$1 AND state='open' AND (snoozed_until IS NULL OR snoozed_until<=now()) ORDER BY id`, [threadId])).rows.map(requestCard);
  }
  /** Undo for Dismiss: a dismissed card that was never answered opens again. */
  async undoDismiss(approvalId: string, userId: string): Promise<RequestCard> {
    const r = (await this.pool.query(`UPDATE approvals a SET state='open' FROM threads t WHERE a.id=$1 AND t.id=a.thread_id AND t.owner_id=$2 AND a.state='dismissed' AND a.answer IS NULL RETURNING a.*`, [approvalId, userId])).rows[0];
    if (!r) throw new ApiFailure('NotFound', 'dismissed request not found');
    await this.event(r.thread_id, 'approval.updated', { approvalId, state: 'open' });
    return requestCard(r);
  }

  async lookup(userId: string, q: string): Promise<ThreadRef[]> {
    const needle = q.trim().toLowerCase().replace(/^@/, ''); if (!needle) return [];
    return (await this.lifecycle.list(userId, 'all')).filter((t) => t.code.toLowerCase() === needle || t.title.toLowerCase().includes(needle) || (needle.includes('-') && t.code.toLowerCase().startsWith(needle)))
      .slice(0, 20).map((t) => ({ id: t.id, code: t.code, title: t.title }));
  }

  async readingPlace(threadId: string, userId: string, set?: { seq?: unknown; offset?: unknown }): Promise<ReadingPlace> {
    await this.lifecycle.view(threadId, userId);
    if (set) {
      if (!Number.isInteger(set.seq) || (set.seq as number) < 0) throw new ApiFailure('ValidationFailed', 'seq must be a non-negative integer');
      const offset = Number.isInteger(set.offset) ? set.offset : 0;
      await this.pool.query(`INSERT INTO thread_reading_places (thread_id,user_id,seq,offset_px) VALUES ($1,$2,$3,$4) ON CONFLICT (thread_id,user_id) DO UPDATE SET seq=$3,offset_px=$4,updated_at=now()`, [threadId, userId, set.seq, offset]);
    }
    const r = (await this.pool.query('SELECT seq,offset_px FROM thread_reading_places WHERE thread_id=$1 AND user_id=$2', [threadId, userId])).rows[0];
    return { threadId, seq: r ? Number(r.seq) : null, offset: r?.offset_px ?? 0 };
  }

  /** Drafts a feedback report as a request card; nothing leaves Flotilla until the owner approves it. */
  async draftFeedback(threadId: string, userId: string, input: { title?: unknown; body?: unknown }): Promise<RequestCard> {
    await this.owned(threadId, userId);
    const feedback = { title: str(input.title, 200, 'title'), body: str(input.body, 20_000, 'body') };
    const id = `apr_${randomBytes(10).toString('base64url')}`;
    const r = (await this.pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail) VALUES ($1,$2,'decision',$3,$4,false,'open',$5) RETURNING *`,
      [id, threadId, 'Send this feedback report to your tracker?', JSON.stringify([{ id: 'send', label: 'Send' }, { id: 'discard', label: 'Discard' }]), JSON.stringify({ feedback })])).rows[0];
    await this.event(threadId, 'approval.requested', { approvalId: id, kind: 'decision', question: r.question });
    return requestCard(r);
  }
  async answerFeedback(approvalId: string, userId: string, input: { optionId?: unknown; title?: unknown; body?: unknown }): Promise<RequestCard & { sent: boolean }> {
    const r = (await this.pool.query(`SELECT a.*, t.code FROM approvals a JOIN threads t ON t.id=a.thread_id WHERE a.id=$1 AND t.owner_id=$2 AND a.state='open' AND a.detail ? 'feedback'`, [approvalId, userId])).rows[0];
    if (!r) throw new ApiFailure('NotFound', 'feedback request not found');
    if (input.optionId !== 'send' && input.optionId !== 'discard') throw new ApiFailure('ValidationFailed', 'optionId must be send or discard');
    const sent = input.optionId === 'send';
    const report = { title: input.title === undefined ? r.detail.feedback.title : str(input.title, 200, 'title'), body: input.body === undefined ? r.detail.feedback.body : str(input.body, 20_000, 'body'), threadId: r.thread_id, threadCode: r.code };
    if (sent) {
      const url = process.env.FLOTILLA_FEEDBACK_URL; if (!url) throw new ApiFailure('ValidationFailed', 'no feedback tracker configured (FLOTILLA_FEEDBACK_URL)');
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report), redirect: 'error' }).catch(() => null);
      if (!res?.ok) throw new ApiFailure('Conflict', 'feedback tracker rejected the report');
    }
    const done = (await this.pool.query(`UPDATE approvals SET state='answered',answer=$2,detail=jsonb_set(detail,'{feedback}',$3) WHERE id=$1 AND state='open' RETURNING *`, [approvalId, JSON.stringify({ optionId: input.optionId, by: userId, at: new Date().toISOString() }), JSON.stringify({ title: report.title, body: report.body })])).rows[0];
    await this.event(r.thread_id, 'approval.resolved', { approvalId, optionId: input.optionId, sent });
    return { ...requestCard(done), sent };
  }
}

const stores = new Map<string, ThreadComposerStore>();
export function threadComposer(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): ThreadComposerStore {
  let s = stores.get(databaseUrl);
  if (!s) stores.set(databaseUrl, (s = new ThreadComposerStore(databaseUrl)));
  return s;
}
