import { randomBytes } from 'node:crypto';
import { scrubString } from '@flotilla/core/kernel/scrub';
import type { RunTokenService } from '../captain/tools/tokens.js';

export type MemoryScope = 'captain' | 'user';
export type MemoryKind = 'preference' | 'rule' | 'fact' | 'worklog';
export type MemoryEntry = { id: string; scope: MemoryScope; subjectId: string; captainId?: string | null; kind: MemoryKind; text: string; createdAt?: string };
export type Queryable = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> };

export function secretLike(text: string): boolean {
  if (scrubString(text, {}) !== text) return true;
  return /password\s*[:=]|\b(?:card|cc|cvv)\s*[:=]|\b\d{12,19}\b|\b(?:otp|totp|2fa|one[- ]time code)\s*[:=]|\b\d{6,8}\b/i.test(text);
}
function terms(text: string): Set<string> { return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2)); }
export function rankMemory(entries: MemoryEntry[], query: string, k = 8): MemoryEntry[] {
  const q = terms(query);
  const score = (e: MemoryEntry) => [...terms(e.text)].filter((t) => q.has(t)).length + (e.kind === 'rule' ? 1000 : 0);
  return entries.map((e) => [score(e), e] as const).filter(([s, e]) => e.kind === 'rule' || s > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, e]) => e);
}

export class MemoryV2Service {
  constructor(private deps: { pool: Queryable; tokens?: RunTokenService }) {}
  auth(token: string | undefined) { const x = this.deps.tokens?.authenticate(token); if (!x) throw new Error('unauthorized'); return x; }
  async save(opts: { scope: MemoryScope; subjectId: string; captainId?: string | null; kind?: MemoryKind; text: string; threadId?: string | null; createdBy?: string | null }): Promise<MemoryEntry> {
    if (!['captain', 'user'].includes(opts.scope)) throw new Error('invalid scope');
    if (!opts.text.trim()) throw new Error('empty memory');
    if (secretLike(opts.text)) throw new Error('secret-like memory refused');
    const id = `mem_${randomBytes(8).toString('hex')}`;
    const kind = opts.kind ?? 'fact';
    await this.deps.pool.query(`INSERT INTO rules_memory (id,scope,subject_id,text,thread_id,created_by,kind,captain_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, opts.scope, opts.subjectId, opts.text, opts.threadId ?? null, opts.createdBy ?? null, kind, opts.captainId ?? null]);
    return { id, scope: opts.scope, subjectId: opts.subjectId, captainId: opts.captainId ?? null, kind, text: opts.text };
  }
  async list(opts: { scope: MemoryScope; subjectId: string; captainId?: string | null; query?: string; limit?: number }): Promise<{ items: MemoryEntry[]; warning: string }> {
    const rows = await this.deps.pool.query(`SELECT id,scope,subject_id as "subjectId",captain_id as "captainId",kind,text,created_at as "createdAt" FROM rules_memory WHERE scope=$1 AND subject_id=$2 AND ($3::text IS NULL OR captain_id=$3) ORDER BY created_at DESC`, [opts.scope, opts.subjectId, opts.captainId ?? null]);
    const items = rankMemory(rows.rows as never as MemoryEntry[], opts.query ?? '', opts.limit ?? 8);
    return { items, warning: 'memory may be stale; re-check changing facts' };
  }
  async forget(id: string, subjectId: string): Promise<boolean> { const r = await this.deps.pool.query(`DELETE FROM rules_memory WHERE id=$1 AND subject_id=$2`, [id, subjectId]); return (r.rowCount ?? 0) > 0; }
  async worklog(opts: { userId: string; captainId: string; runId: string; title: string; outcome: string; links?: string[] }): Promise<MemoryEntry> {
    const text = `${new Date().toISOString().slice(0, 10)} ${opts.title}: ${opts.outcome}${opts.links?.length ? ` (${opts.links.join(', ')})` : ''}`;
    return this.save({ scope: 'captain', subjectId: opts.captainId, captainId: opts.captainId, kind: 'worklog', text, threadId: opts.captainId, createdBy: opts.userId });
  }
  async call(token: string | undefined, name: string, args: Record<string, unknown>): Promise<{ status: number; body: unknown }> { return this.mcpCall(token, name, args); }
  async mcpCall(token: string | undefined, name: string, args: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
    try {
      const run = this.auth(token);
      if (name === 'memory.save') return { status: 200, body: await this.save({ scope: (args.scope ?? 'captain') as MemoryScope, subjectId: args.scope === 'user' ? String(args.userId ?? run.captainId) : run.captainId, captainId: args.scope === 'user' ? null : run.captainId, kind: args.kind as MemoryKind | undefined, text: String(args.text ?? ''), threadId: run.captainId }) };
      if (name === 'memory.list') return { status: 200, body: await this.list({ scope: (args.scope ?? 'captain') as MemoryScope, subjectId: args.scope === 'user' ? String(args.userId ?? run.captainId) : run.captainId, captainId: args.scope === 'user' ? null : run.captainId, query: String(args.query ?? '') }) };
      if (name === 'memory.forget') return { status: 200, body: { forgotten: await this.forget(String(args.id ?? ''), run.captainId) } };
      return { status: 404, body: { error: 'unknown tool' } };
    } catch (err) { return { status: err instanceof Error && err.message === 'unauthorized' ? 401 : 400, body: { error: err instanceof Error ? err.message : 'error' } }; }
  }
}
