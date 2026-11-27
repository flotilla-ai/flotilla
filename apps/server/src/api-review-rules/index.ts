import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export interface ReviewRule { id: string; repo: string; rule: string; enabled: boolean; createdAt: string; updatedAt: string }
export interface ReviewFilterRule { id: string; repo: string; pathScope: string; action: 'include' | 'ignore'; pattern: string; enabled: boolean; createdAt: string; updatedAt: string }
export interface ReviewIgnorePath { id: string; repo: string; path: string; enabled: boolean; createdAt: string; updatedAt: string }
type Row = Record<string, any>;
const rid = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;
const repo = (v: unknown) => { const s = String(v ?? ''); if (!/^[^\s/]+\/[^\s/]+$/.test(s)) throw new ApiFailure('ValidationFailed', 'repo must be owner/repo'); return s };
const str = (v: unknown, name: string, max: number) => { if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new ApiFailure('ValidationFailed', `${name} must be 1-${max} characters`); return v.trim() };
const rule = (r: Row): ReviewRule => ({ id: r.id, repo: r.repo, rule: r.rule, enabled: r.enabled, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });
const filter = (r: Row): ReviewFilterRule => ({ id: r.id, repo: r.repo, pathScope: r.path_scope, action: r.action, pattern: r.pattern, enabled: r.enabled, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });
const ignore = (r: Row): ReviewIgnorePath => ({ id: r.id, repo: r.repo, path: r.path, enabled: r.enabled, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });
const bool = (v: unknown, fallback: boolean) => { if (v === undefined) return fallback; if (typeof v !== 'boolean') throw new ApiFailure('ValidationFailed', 'enabled must be boolean'); return v };

/** Owner-scoped public CRUD for durable review rules, path filters, and ignore paths. */
export class ApiReviewRulesStore {
  constructor(readonly pool: pg.Pool) {}
  private async q(sql: string, args: unknown[] = []) {
    try { return (await this.pool.query(sql, args)).rows as Row[] }
    catch (e) { if ((e as { code?: string }).code === '23505') throw new ApiFailure('Conflict', 'review configuration row already exists'); throw e }
  }
  private async one(table: string, userId: string, id: string): Promise<Row> {
    const [r] = await this.q(`SELECT * FROM ${table} WHERE id=$1 AND owner_id=$2`, [id, userId]);
    if (!r) throw new ApiFailure('NotFound', 'review configuration row not found');
    return r;
  }
  async listRules(userId: string, repoInput?: string): Promise<{ items: ReviewRule[] }> { return { items: (await this.q('SELECT * FROM api_review_rules WHERE owner_id=$1 AND ($2::text IS NULL OR repo=$2) ORDER BY created_at,id', [userId, repoInput ? repo(repoInput) : null])).map(rule) } }
  async createRule(userId: string, input: Row): Promise<ReviewRule> {
    const [r] = await this.q('INSERT INTO api_review_rules (id,owner_id,repo,rule) VALUES ($1,$2,$3,$4) RETURNING *', [rid('arr'), userId, repo(input.repo), str(input.rule, 'rule', 2000)]);
    return rule(r);
  }
  async getRule(userId: string, id: string): Promise<ReviewRule> { return rule(await this.one('api_review_rules', userId, id)) }
  async updateRule(userId: string, id: string, input: Row): Promise<ReviewRule> {
    await this.one('api_review_rules', userId, id);
    const [r] = await this.q('UPDATE api_review_rules SET rule=COALESCE($3,rule),enabled=$4,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *', [id, userId, input.rule === undefined ? null : str(input.rule, 'rule', 2000), bool(input.enabled, (await this.one('api_review_rules', userId, id)).enabled)]);
    return rule(r);
  }
  async deleteRule(userId: string, id: string): Promise<boolean> { return Boolean((await this.q('DELETE FROM api_review_rules WHERE id=$1 AND owner_id=$2 RETURNING id', [id, userId]))[0]) }
  async listFilters(userId: string, repoInput?: string): Promise<{ items: ReviewFilterRule[] }> { return { items: (await this.q('SELECT * FROM api_review_filter_rules WHERE owner_id=$1 AND ($2::text IS NULL OR repo=$2) ORDER BY created_at,id', [userId, repoInput ? repo(repoInput) : null])).map(filter) } }
  async createFilter(userId: string, input: Row): Promise<ReviewFilterRule> {
    const action = String(input.action ?? 'ignore'); if (!['include', 'ignore'].includes(action)) throw new ApiFailure('ValidationFailed', 'action must be include or ignore');
    const [r] = await this.q('INSERT INTO api_review_filter_rules (id,owner_id,repo,path_scope,action,pattern) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [rid('arf'), userId, repo(input.repo), str(input.pathScope ?? '**', 'pathScope', 256), action, str(input.pattern, 'pattern', 256)]);
    return filter(r);
  }
  async updateFilter(userId: string, id: string, input: Row): Promise<ReviewFilterRule> {
    const old = await this.one('api_review_filter_rules', userId, id); const action = input.action === undefined ? old.action : String(input.action); if (!['include', 'ignore'].includes(action)) throw new ApiFailure('ValidationFailed', 'action must be include or ignore');
    const [r] = await this.q('UPDATE api_review_filter_rules SET path_scope=$3,action=$4,pattern=$5,enabled=$6,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *', [id, userId, input.pathScope === undefined ? old.path_scope : str(input.pathScope, 'pathScope', 256), action, input.pattern === undefined ? old.pattern : str(input.pattern, 'pattern', 256), bool(input.enabled, old.enabled)]);
    return filter(r);
  }
  async deleteFilter(userId: string, id: string): Promise<boolean> { return Boolean((await this.q('DELETE FROM api_review_filter_rules WHERE id=$1 AND owner_id=$2 RETURNING id', [id, userId]))[0]) }
  async listIgnorePaths(userId: string, repoInput?: string): Promise<{ items: ReviewIgnorePath[] }> { return { items: (await this.q('SELECT * FROM api_review_ignore_paths WHERE owner_id=$1 AND ($2::text IS NULL OR repo=$2) ORDER BY created_at,id', [userId, repoInput ? repo(repoInput) : null])).map(ignore) } }
  async createIgnorePath(userId: string, input: Row): Promise<ReviewIgnorePath> {
    const [r] = await this.q('INSERT INTO api_review_ignore_paths (id,owner_id,repo,path) VALUES ($1,$2,$3,$4) RETURNING *', [rid('aip'), userId, repo(input.repo), str(input.path, 'path', 256)]);
    return ignore(r);
  }
  async updateIgnorePath(userId: string, id: string, input: Row): Promise<ReviewIgnorePath> {
    const old = await this.one('api_review_ignore_paths', userId, id);
    const [r] = await this.q('UPDATE api_review_ignore_paths SET path=$3,enabled=$4,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *', [id, userId, input.path === undefined ? old.path : str(input.path, 'path', 256), bool(input.enabled, old.enabled)]);
    return ignore(r);
  }
  async deleteIgnorePath(userId: string, id: string): Promise<boolean> { return Boolean((await this.q('DELETE FROM api_review_ignore_paths WHERE id=$1 AND owner_id=$2 RETURNING id', [id, userId]))[0]) }
}
