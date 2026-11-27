import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export type DeliveryMode = 'queue' | 'steer' | 'interrupt';
export type InboxState = 'waiting_upload' | 'pending' | 'delivered' | 'cancelled';
/** One durable user/kernel message addressed to a thread; versions of an edited message share `rootId`. */
export interface ThreadInboxItem { id: string; threadId: string; rootId: string; version: number; mode: DeliveryMode; plan: boolean; state: InboxState; text: string; attachments: string[]; by: string | null; runId: string | null; createdAt: string; deliveredAt: string | null }
export type MessageVersion = Pick<ThreadInboxItem, 'id' | 'rootId' | 'version' | 'text' | 'state' | 'createdAt'>;
export interface PlanGate { approvalId: string; threadId: string; runId: string; options: [{ id: 'approve'; label: string }, { id: 'revise'; label: string }] }
export type AdapterErrorKind = 'rate_limited' | 'overloaded' | 'auth' | 'context_length' | 'provider';
export interface AdapterError { kind: AdapterErrorKind; retryable: boolean; message: string }
export interface InboxView { items: ThreadInboxItem[]; queuedCount: number; folded: boolean }
export interface ContextMeter { usedTokens: number; compactAt: number; compactSupported: boolean }

export const PLAN_PROMPT = 'Plan mode: explore and ask questions first. Do not edit files, run mutating commands, push or open pull requests. End with a plan for approval.\n\n';
export const DELIVERY_MODES: DeliveryMode[] = ['queue', 'steer', 'interrupt'];

export function parseCommand(text: string): { kind: 'plan' | 'side' | null; body: string } {
  const m = /^\/(plan|btw|side)(?:\s+|$)([\s\S]*)$/.exec(text.trimStart());
  return m ? { kind: m[1] === 'plan' ? 'plan' : 'side', body: m[2].trim() } : { kind: null, body: text };
}

export function adapterError(message = ''): AdapterError {
  const m = message.toLowerCase();
  const kind: AdapterErrorKind = /rate.?limit|\b429\b/.test(m) ? 'rate_limited' : /overload|\b529\b|\b503\b|unavailable/.test(m) ? 'overloaded'
    : /auth|\b401\b|\b403\b|api key|credential/.test(m) ? 'auth' : /context|too long|max.?tokens/.test(m) ? 'context_length' : 'provider';
  return { kind, retryable: kind !== 'auth' && kind !== 'context_length', message: message.slice(0, 500) };
}

type Row = Record<string, any>;
const item = (r: Row): ThreadInboxItem => ({ id: r.id, threadId: r.thread_id, rootId: r.root_id, version: r.version, mode: r.mode, plan: r.plan, state: r.state, text: r.text, attachments: r.attachments, by: r.by_user, runId: r.run_id, createdAt: r.created_at.toISOString(), deliveredAt: r.delivered_at?.toISOString() ?? null });
const order = 'ORDER BY priority DESC, seq';

export class RunnerQueue {
  constructor(private readonly pool: pg.Pool) {}
  private async one(sql: string, args: unknown[]): Promise<ThreadInboxItem | null> { const r = (await this.pool.query(sql, args)).rows[0]; return r ? item(r) : null; }

  async validateAttachments(ownerId: string, attachments?: string[]): Promise<Row[]> {
    const files = attachments ?? [];
    if (!Array.isArray(files) || files.some((f) => typeof f !== 'string')) throw new ApiFailure('ValidationFailed', 'attachments must be file ids');
    const owned = files.length ? (await this.pool.query('SELECT id,uploaded_at FROM api_files WHERE owner_id=$1 AND id = ANY($2::text[])', [ownerId, files])).rows : [];
    if (owned.length !== new Set(files).size) throw new ApiFailure('ValidationFailed', 'unknown attachment');
    return owned;
  }

  async add(input: { threadId: string; text: string; mode: DeliveryMode; plan?: boolean; by: string | null; ownerId: string; attachments?: string[]; rootId?: string; version?: number; priority?: number }): Promise<ThreadInboxItem> {
    const files = input.attachments ?? [];
    const owned = await this.validateAttachments(input.ownerId, files);
    const id = `inb_${randomBytes(10).toString('base64url')}`;
    const priority = input.priority ?? 0;
    return (await this.one(`INSERT INTO thread_inbox (id,thread_id,root_id,version,mode,plan,state,text,attachments,by_user,priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      CASE WHEN $11::int > 0 THEN (SELECT coalesce(max(priority),0)+1 FROM thread_inbox WHERE thread_id=$2) ELSE 0 END) RETURNING *`,
    [id, input.threadId, input.rootId ?? id, input.version ?? 1, input.mode, input.plan ?? false, owned.some((f) => !f.uploaded_at) ? 'waiting_upload' : 'pending', input.text, JSON.stringify(files), input.by, priority]))!;
  }
  claim(threadId: string, runId: string) { return this.one(`UPDATE thread_inbox SET state='delivered',delivered_at=now(),run_id=$2 WHERE id=(SELECT id FROM thread_inbox WHERE thread_id=$1 AND state='pending' ${order} LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`, [threadId, runId]); }
  markDelivered(id: string, runId: string) { return this.one(`UPDATE thread_inbox SET state='delivered',delivered_at=now(),run_id=$2 WHERE id=$1 AND state='pending' RETURNING *`, [id, runId]); }
  async hasPending(threadId: string) { return (await this.pool.query(`SELECT 1 FROM thread_inbox WHERE thread_id=$1 AND state='pending' LIMIT 1`, [threadId])).rows.length > 0; }
  async view(threadId: string): Promise<InboxView> {
    const items = (await this.pool.query(`SELECT * FROM thread_inbox WHERE thread_id=$1 AND state IN ('pending','waiting_upload') ${order}`, [threadId])).rows.map(item);
    return { items, queuedCount: items.length, folded: items.length >= 2 };
  }
  get(threadId: string, id: string) { return this.one('SELECT * FROM thread_inbox WHERE thread_id=$1 AND id=$2', [threadId, id]); }
  private async pendingOnly(threadId: string, id: string, sql: string, args: unknown[] = []) {
    if (!(await this.get(threadId, id))) throw new ApiFailure('NotFound', 'message not found');
    const row = await this.one(sql, [threadId, id, ...args]);
    if (!row) throw new ApiFailure('Conflict', 'message was already read by the agent');
    return row;
  }
  edit(threadId: string, id: string, text: string) { return this.pendingOnly(threadId, id, `UPDATE thread_inbox SET text=$3 WHERE thread_id=$1 AND id=$2 AND state IN ('pending','waiting_upload') RETURNING *`, [text]); }
  cancel(threadId: string, id: string) { return this.pendingOnly(threadId, id, `UPDATE thread_inbox SET state='cancelled' WHERE thread_id=$1 AND id=$2 AND state IN ('pending','waiting_upload') RETURNING *`); }
  prioritize(threadId: string, id: string) { return this.pendingOnly(threadId, id, `UPDATE thread_inbox SET priority=(SELECT coalesce(max(priority),0)+1 FROM thread_inbox WHERE thread_id=$1) WHERE thread_id=$1 AND id=$2 AND state IN ('pending','waiting_upload') RETURNING *`); }
  async cancelAll(threadId: string) { await this.pool.query(`UPDATE thread_inbox SET state='cancelled' WHERE thread_id=$1 AND state IN ('pending','waiting_upload')`, [threadId]); }
  async versions(threadId: string, id: string): Promise<MessageVersion[]> {
    const rows = (await this.pool.query('SELECT * FROM thread_inbox WHERE thread_id=$1 AND root_id=(SELECT root_id FROM thread_inbox WHERE thread_id=$1 AND id=$2) ORDER BY version', [threadId, id])).rows.map(item);
    if (!rows.length) throw new ApiFailure('NotFound', 'message not found');
    return rows.map(({ id: vid, rootId, version, text, state, createdAt }) => ({ id: vid, rootId, version, text, state, createdAt }));
  }
  lastDelivered(threadId: string) { return this.one(`SELECT * FROM thread_inbox WHERE thread_id=$1 AND state='delivered' ORDER BY delivered_at DESC, seq DESC LIMIT 1`, [threadId]); }
  /** Uploads finished since the message was sent: release it; returns the threads to kick. */
  async releaseUploads(): Promise<string[]> {
    const rows = await this.pool.query(`UPDATE thread_inbox i SET state='pending' WHERE state='waiting_upload' AND NOT EXISTS (SELECT 1 FROM api_files f WHERE f.id IN (SELECT jsonb_array_elements_text(i.attachments)) AND f.uploaded_at IS NULL) RETURNING thread_id`);
    return [...new Set(rows.rows.map((r) => r.thread_id as string))];
  }
  async pendingThreads(): Promise<string[]> {
    return (await this.pool.query(`SELECT DISTINCT i.thread_id FROM thread_inbox i JOIN threads t ON t.id=i.thread_id WHERE i.state='pending' AND t.status IN ('queued','working','waiting')`)).rows.map((r) => r.thread_id);
  }
}
