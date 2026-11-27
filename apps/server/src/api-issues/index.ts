import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export interface IssueState { id: string; name: string; position: number; isDefault: boolean }
export interface IssueLabel { id: string; name: string; color: string; description: string }
export interface Issue { id: string; identifier: string; title: string; body: string; stateId: string; assigneeId: string | null; creatorId: string; dueDate: string | null; labels: string[]; createdAt: string; updatedAt: string; closedAt: string | null }
export interface IssueComment { id: string; issueId: string; authorId: string; body: string; createdAt: string; updatedAt: string }
export interface IssueRelation { id: string; issueId: string; otherIssueId: string; type: 'relates' | 'blocks' | 'parent' }
export interface IssueLink { id: string; issueId: string; kind: 'pull-request' | 'thread'; target: string }

type Row = Record<string, any>;
const rid = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
const state = (r: Row): IssueState => ({ id: r.id, name: r.name, position: Number(r.position), isDefault: r.is_default });
const label = (r: Row): IssueLabel => ({ id: r.id, name: r.name, color: r.color, description: r.description });
const issue = (r: Row): Issue => ({ id: r.id, identifier: r.identifier, title: r.title, body: r.body, stateId: r.state_id, assigneeId: r.assignee_id, creatorId: r.creator_id, dueDate: iso(r.due_date)?.slice(0, 10) ?? null, labels: r.labels ?? [], createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(), closedAt: iso(r.closed_at) });
const comment = (r: Row): IssueComment => ({ id: r.id, issueId: r.issue_id, authorId: r.author_id, body: r.body, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });
const relation = (r: Row): IssueRelation => ({ id: r.id, issueId: r.issue_id, otherIssueId: r.other_issue_id, type: r.type });
const link = (r: Row): IssueLink => ({ id: r.id, issueId: r.issue_id, kind: r.kind, target: r.target });
const text = (v: unknown, name: string, max: number, optional = false): string => {
  if (v == null && optional) return '';
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new ApiFailure('ValidationFailed', `${name} must be 1-${max} characters`);
  return v.trim();
};
const dueDate = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new ApiFailure('ValidationFailed', 'dueDate must be YYYY-MM-DD');
  return v;
};
const idList = (v: unknown): string[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > 50 || v.some((x) => typeof x !== 'string')) throw new ApiFailure('ValidationFailed', 'expected an array of at most 50 ids');
  return v as string[];
};

/** Durable built-in issue tracker public API: issues, comments, timeline, relations, links, files, states, labels and prefix. */
export class ApiIssuesStore {
  constructor(readonly pool: pg.Pool) {}
  private async q(sql: string, args: unknown[] = []): Promise<Row[]> { return (await this.pool.query(sql, args)).rows; }
  private async event(issueId: string, actorId: string, kind: string, payload: Record<string, unknown> = {}): Promise<void> {
    await this.pool.query('INSERT INTO issue_events (id,issue_id,actor_id,kind,payload) VALUES ($1,$2,$3,$4,$5)', [rid('iev'), issueId, actorId, kind, JSON.stringify(payload)]);
  }
  private async oneIssue(idOrIdentifier: string): Promise<Row> {
    const [r] = await this.q('SELECT * FROM issues WHERE id=$1 OR identifier=$1', [idOrIdentifier]);
    if (!r) throw new ApiFailure('NotFound', 'issue not found');
    return r;
  }
  private async stateExists(id: string): Promise<void> { if (!(await this.q('SELECT 1 FROM issue_states WHERE id=$1', [id]))[0]) throw new ApiFailure('NotFound', 'issue state not found'); }
  private async validateLabels(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const rows = await this.q('SELECT id FROM issue_labels WHERE id=ANY($1::text[])', [ids]);
    if (rows.length !== new Set(ids).size) throw new ApiFailure('NotFound', 'issue label not found');
  }
  private async validateFiles(ownerId: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const rows = await this.q(`SELECT id FROM api_files WHERE owner_id=$1 AND id=ANY($2::text[]) AND uploaded_at IS NOT NULL`, [ownerId, ids]);
    if (rows.length !== new Set(ids).size) throw new ApiFailure('NotFound', 'uploaded issue file not found');
  }

  async listIssues(filters: Record<string, string | undefined>): Promise<{ items: Issue[] }> {
    const where: string[] = []; const args: unknown[] = [];
    if (filters.stateId) { args.push(filters.stateId); where.push(`state_id=$${args.length}`); }
    if (filters.assigneeId) { args.push(filters.assigneeId); where.push(`assignee_id=$${args.length}`); }
    if (filters.labelId) { args.push(filters.labelId); where.push(`labels ? $${args.length}`); }
    if (filters.q) { args.push(`%${filters.q}%`); where.push(`(title ILIKE $${args.length} OR body ILIKE $${args.length} OR identifier ILIKE $${args.length})`); }
    const rows = await this.q(`SELECT * FROM issues ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT 500`, args);
    return { items: rows.map(issue) };
  }
  async createIssue(userId: string, input: Record<string, unknown>): Promise<Issue> {
    const title = text(input.title, 'title', 200);
    if (input.body !== undefined && typeof input.body !== 'string') throw new ApiFailure('ValidationFailed', 'body must be a string');
    const body = typeof input.body === 'string' ? input.body : ''; if (body.length > 20000) throw new ApiFailure('ValidationFailed', 'body must be at most 20000 characters');
    const [def] = await this.q('SELECT id FROM issue_states WHERE is_default ORDER BY position LIMIT 1');
    const stateId = input.stateId == null ? def.id : String(input.stateId); await this.stateExists(stateId);
    const labels = idList(input.labelIds); await this.validateLabels(labels);
    const fileIds = idList(input.fileIds); await this.validateFiles(userId, fileIds);
    if (input.assigneeId != null && !(await this.q('SELECT 1 FROM users WHERE id=$1', [String(input.assigneeId)]))[0]) throw new ApiFailure('NotFound', 'assignee not found');
    const id = rid('iss');
    await this.pool.query(`WITH n AS (SELECT nextval(pg_get_serial_sequence('issues','number')::regclass) AS num)
      INSERT INTO issues (id,number,identifier,title,body,state_id,assignee_id,creator_id,due_date,labels)
      SELECT $1,n.num,(SELECT prefix FROM issue_settings WHERE id='org')||'-'||n.num,$2,$3,$4,$5,$6,$7,$8 FROM n RETURNING *`,
      [id, title, body, stateId, input.assigneeId == null ? null : String(input.assigneeId), userId, dueDate(input.dueDate), JSON.stringify(labels)]);
    for (const fileId of fileIds) await this.pool.query('INSERT INTO issue_files (id,issue_id,file_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [rid('isf'), id, fileId]);
    await this.event(id, userId, 'created', { title });
    return issue((await this.oneIssue(id)));
  }
  async getIssue(id: string): Promise<Issue> { return issue(await this.oneIssue(id)); }
  async updateIssue(userId: string, id: string, input: Record<string, unknown>): Promise<Issue> {
    const old = await this.oneIssue(id); const next: Record<string, unknown> = {}; const changed: Record<string, unknown> = {};
    if (input.title !== undefined) next.title = changed.title = text(input.title, 'title', 200);
    if (input.body !== undefined) { if (typeof input.body !== 'string' || input.body.length > 20000) throw new ApiFailure('ValidationFailed', 'body must be at most 20000 characters'); next.body = changed.body = input.body; }
    if (input.stateId !== undefined) { const v = String(input.stateId); await this.stateExists(v); next.state_id = changed.stateId = v; }
    if (input.assigneeId !== undefined) { const v = input.assigneeId == null ? null : String(input.assigneeId); if (v && !(await this.q('SELECT 1 FROM users WHERE id=$1', [v]))[0]) throw new ApiFailure('NotFound', 'assignee not found'); next.assignee_id = changed.assigneeId = v; }
    if (input.dueDate !== undefined) next.due_date = changed.dueDate = dueDate(input.dueDate);
    if (input.labelIds !== undefined) { const ids = idList(input.labelIds); await this.validateLabels(ids); next.labels = changed.labels = JSON.stringify(ids); }
    if (!Object.keys(next).length) return issue(old);
    const cols = Object.keys(next).map((k, i) => `${k}=$${i + 2}`).join(',');
    await this.pool.query(`UPDATE issues SET ${cols},closed_at=CASE WHEN $${Object.keys(next).length + 2} IN (SELECT id FROM issue_states WHERE lower(name) IN ('done','canceled','cancelled')) THEN COALESCE(closed_at,now()) ELSE NULL END,updated_at=now() WHERE id=$1`, [old.id, ...Object.values(next), next.state_id ?? old.state_id]);
    await this.event(old.id, userId, 'updated', changed);
    return issue(await this.oneIssue(old.id));
  }
  async listComments(id: string): Promise<{ items: IssueComment[] }> { const r = await this.oneIssue(id); return { items: (await this.q('SELECT * FROM issue_comments WHERE issue_id=$1 ORDER BY created_at,id', [r.id])).map(comment) }; }
  async addComment(userId: string, id: string, input: Record<string, unknown>): Promise<IssueComment> {
    const r = await this.oneIssue(id); const body = text(input.body, 'body', 20000); const cid = rid('icm');
    const [row] = await this.q('INSERT INTO issue_comments (id,issue_id,author_id,body) VALUES ($1,$2,$3,$4) RETURNING *', [cid, r.id, userId, body]);
    await this.event(r.id, userId, 'commented', { commentId: cid });
    return comment(row);
  }
  async timeline(id: string): Promise<{ items: unknown[] }> {
    const r = await this.oneIssue(id);
    const rows = await this.q(`SELECT id,kind,actor_id,payload,created_at,NULL::text AS body FROM issue_events WHERE issue_id=$1 UNION ALL SELECT id,'comment',author_id,'{}'::jsonb,created_at,body FROM issue_comments WHERE issue_id=$1 ORDER BY created_at,id`, [r.id]);
    return { items: rows.map((x) => ({ id: x.id, kind: x.kind, actorId: x.actor_id, payload: x.payload, body: x.body, createdAt: x.created_at.toISOString() })) };
  }
  async listRelations(id: string): Promise<{ items: IssueRelation[] }> { const r = await this.oneIssue(id); return { items: (await this.q('SELECT * FROM issue_relations WHERE issue_id=$1 OR other_issue_id=$1 ORDER BY created_at,id', [r.id])).map(relation) }; }
  async relate(userId: string, id: string, input: Record<string, unknown>): Promise<IssueRelation> {
    const r = await this.oneIssue(id); const other = await this.oneIssue(String(input.otherIssueId ?? '')); const type = String(input.type ?? 'relates');
    if (!['relates', 'blocks', 'parent'].includes(type)) throw new ApiFailure('ValidationFailed', 'type must be relates, blocks or parent');
    const [row] = await this.q('INSERT INTO issue_relations (id,issue_id,other_issue_id,type) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *', [rid('ire'), r.id, other.id, type]);
    if (!row) throw new ApiFailure('Conflict', 'relation already exists');
    await this.event(r.id, userId, 'related', { otherIssueId: other.id, type });
    return relation(row);
  }
  async unrelate(userId: string, id: string, relationId: string): Promise<boolean> {
    const r = await this.oneIssue(id); const rows = await this.q('DELETE FROM issue_relations WHERE id=$1 AND (issue_id=$2 OR other_issue_id=$2) RETURNING id', [relationId, r.id]);
    if (rows[0]) await this.event(r.id, userId, 'unrelated', { relationId });
    return Boolean(rows[0]);
  }
  async link(userId: string, id: string, input: Record<string, unknown>): Promise<IssueLink> {
    const r = await this.oneIssue(id); const kind = String(input.kind ?? ''); if (!['pull-request', 'thread'].includes(kind)) throw new ApiFailure('ValidationFailed', 'kind must be pull-request or thread');
    const target = text(input.target, 'target', 500);
    const [row] = await this.q('INSERT INTO issue_links (id,issue_id,kind,target) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *', [rid('ilk'), r.id, kind, target]);
    if (!row) throw new ApiFailure('Conflict', 'link already exists');
    await this.event(r.id, userId, 'linked', { kind, target });
    return link(row);
  }
  async unlink(userId: string, id: string, linkId: string): Promise<boolean> {
    const r = await this.oneIssue(id); const rows = await this.q('DELETE FROM issue_links WHERE id=$1 AND issue_id=$2 RETURNING id', [linkId, r.id]);
    if (rows[0]) await this.event(r.id, userId, 'unlinked', { linkId });
    return Boolean(rows[0]);
  }
  async attachFiles(userId: string, id: string, input: Record<string, unknown>): Promise<{ attached: number }> {
    const r = await this.oneIssue(id); const ids = idList(input.fileIds); await this.validateFiles(userId, ids);
    for (const fileId of ids) await this.pool.query('INSERT INTO issue_files (id,issue_id,file_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [rid('isf'), r.id, fileId]);
    if (ids.length) await this.event(r.id, userId, 'files-attached', { fileIds: ids });
    return { attached: ids.length };
  }
  async downloadFile(id: string, fileId: string): Promise<{ name: string; contentType: string; data: Buffer } | null> {
    const r = await this.oneIssue(id);
    const [row] = await this.q('SELECT f.name,f.content_type,f.data FROM issue_files x JOIN api_files f ON f.id=x.file_id WHERE x.issue_id=$1 AND x.file_id=$2', [r.id, fileId]);
    return row ? { name: row.name, contentType: row.content_type, data: row.data } : null;
  }
  async states(): Promise<{ items: IssueState[] }> { return { items: (await this.q('SELECT * FROM issue_states ORDER BY position')).map(state) }; }
  async createState(userId: string, input: Record<string, unknown>): Promise<IssueState> {
    const name = text(input.name, 'name', 80); const id = rid('ist');
    const [r] = await this.q('INSERT INTO issue_states (id,name,position,is_default) VALUES ($1,$2,COALESCE((SELECT max(position) FROM issue_states),0)+1,false) RETURNING *', [id, name]);
    void userId; return state(r);
  }
  async updateState(id: string, input: Record<string, unknown>): Promise<IssueState> {
    const name = input.name === undefined ? null : text(input.name, 'name', 80);
    const [r] = await this.q('UPDATE issue_states SET name=COALESCE($2,name) WHERE id=$1 RETURNING *', [id, name]);
    if (!r) throw new ApiFailure('NotFound', 'issue state not found');
    return state(r);
  }
  async reorderStates(input: Record<string, unknown>): Promise<{ items: IssueState[] }> {
    const ids = idList(input.ids); const existing = await this.q('SELECT id FROM issue_states');
    if (ids.length !== existing.length || new Set(ids).size !== ids.length || existing.some((r) => !ids.includes(r.id))) throw new ApiFailure('ValidationFailed', 'ids must reorder every issue state exactly once');
    for (const [i, id] of ids.entries()) await this.pool.query('UPDATE issue_states SET position=$2 WHERE id=$1', [id, -i - 1]);
    for (const [i, id] of ids.entries()) await this.pool.query('UPDATE issue_states SET position=$2 WHERE id=$1', [id, i + 1]);
    return this.states();
  }
  async deleteState(id: string): Promise<boolean> {
    const [r] = await this.q('SELECT is_default,(SELECT count(*)::int c FROM issues WHERE state_id=$1)c FROM issue_states WHERE id=$1', [id]);
    if (!r) return false;
    if (r.is_default || r.c) throw new ApiFailure('Conflict', 'default or in-use issue state cannot be deleted');
    return Boolean((await this.q('DELETE FROM issue_states WHERE id=$1 RETURNING id', [id]))[0]);
  }
  async setDefaultState(id: string): Promise<IssueState> {
    await this.pool.query(`UPDATE issue_states SET is_default=(id=$1)`, [id]);
    const [r] = await this.q('SELECT * FROM issue_states WHERE id=$1', [id]);
    if (!r) throw new ApiFailure('NotFound', 'issue state not found');
    return state(r);
  }
  async labels(): Promise<{ items: IssueLabel[] }> { return { items: (await this.q('SELECT * FROM issue_labels ORDER BY name,id')).map(label) }; }
  async createLabel(input: Record<string, unknown>): Promise<IssueLabel> {
    const name = text(input.name, 'name', 80); const color = typeof input.color === 'string' && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : '#888888'; const description = typeof input.description === 'string' ? input.description.slice(0, 500) : '';
    const [r] = await this.q('INSERT INTO issue_labels (id,name,color,description) VALUES ($1,$2,$3,$4) RETURNING *', [rid('ilb'), name, color, description]);
    return label(r);
  }
  async updateLabel(id: string, input: Record<string, unknown>): Promise<IssueLabel> {
    const color = input.color === undefined ? null : String(input.color); if (color && !/^#[0-9a-f]{6}$/i.test(color)) throw new ApiFailure('ValidationFailed', 'color must be #rrggbb');
    const [r] = await this.q('UPDATE issue_labels SET name=COALESCE($2,name),color=COALESCE($3,color),description=COALESCE($4,description) WHERE id=$1 RETURNING *', [id, input.name === undefined ? null : text(input.name, 'name', 80), color, typeof input.description === 'string' ? input.description.slice(0, 500) : null]);
    if (!r) throw new ApiFailure('NotFound', 'issue label not found');
    return label(r);
  }
  async deleteLabel(id: string): Promise<boolean> {
    await this.pool.query(`UPDATE issues SET labels=COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements_text(labels) x WHERE x<>$1),'[]'::jsonb),updated_at=now() WHERE labels ? $1`, [id]);
    return Boolean((await this.q('DELETE FROM issue_labels WHERE id=$1 RETURNING id', [id]))[0]);
  }
  async prefix(): Promise<{ prefix: string }> { return { prefix: (await this.q(`SELECT prefix FROM issue_settings WHERE id='org'`))[0].prefix }; }
  async setPrefix(input: Record<string, unknown>): Promise<{ prefix: string }> {
    const prefix = text(input.prefix, 'prefix', 10).toUpperCase(); if (!/^[A-Z][A-Z0-9]{1,9}$/.test(prefix)) throw new ApiFailure('ValidationFailed', 'prefix must be 2-10 uppercase letters/numbers starting with a letter');
    await this.pool.query(`UPDATE issue_settings SET prefix=$1,updated_at=now() WHERE id='org'`, [prefix]);
    return { prefix };
  }
}
