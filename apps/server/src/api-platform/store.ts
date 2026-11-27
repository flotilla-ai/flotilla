import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../db/migrate.js';
import { ApiFailure, decodeCursor, encodeCursor, pageLimit, type ApiFile, type ApiKey, type ApiPrincipal, type FileRef, type List, type Page, type UploadGrant } from './types.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const rid = (prefix: string) => `${prefix}_${randomBytes(8).toString('hex')}`;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
type Row = Record<string, any>;
const toKey = (r: Row): ApiKey => ({ id: r.id, name: r.name, prefix: r.prefix, userId: r.user_id, createdBy: r.created_by, expiresAt: iso(r.expires_at), lastUsedAt: iso(r.last_used_at), revokedAt: iso(r.revoked_at), createdAt: r.created_at.toISOString() });
const toFile = (r: Row): ApiFile => ({ id: r.id, name: r.name, contentType: r.content_type, size: Number(r.size), status: r.uploaded_at ? 'uploaded' : 'pending', createdAt: r.created_at.toISOString() });
const fileCols = 'id,name,content_type,size,uploaded_at,created_at';

export type Idempotency = { state: 'new' | 'conflict' | 'pending' } | { state: 'replay'; status: number; body: string; contentType: string };

export class ApiPlatformStore {
  readonly pool: pg.Pool;
  rateLimitPerMin = Number(process.env.FLOTILLA_API_RATE_PER_MIN ?? 600);
  keyRecheckMs = 30_000;
  maxUploadBytes = Number(process.env.FLOTILLA_UPLOAD_MAX_BYTES ?? 25 * 1024 * 1024);
  private windows = new Map<string, { start: number; count: number }>();
  private ready?: Promise<unknown>;
  constructor(private readonly databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }

  async mintKey(authorId: string, input: { name?: unknown; expiresAt?: unknown; serviceUser?: { name?: unknown } }): Promise<{ key: ApiKey; token: string }> {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) throw new ApiFailure('ValidationFailed', 'name required (max 100 chars)');
    const expiresAt = input.expiresAt == null ? null : new Date(String(input.expiresAt));
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) throw new ApiFailure('ValidationFailed', 'expiresAt must be a future ISO timestamp');
    let userId = authorId;
    if (input.serviceUser) {
      userId = rid('usr');
      await this.q(`INSERT INTO users (id,email,role,created_by) VALUES ($1,$2,'service',$3)`, [userId, `${userId}@service.flotilla.invalid`, authorId]);
    }
    const token = `flt_${randomBytes(32).toString('base64url')}`;
    const [row] = await this.q('INSERT INTO api_keys (id,user_id,created_by,name,prefix,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [rid('key'), userId, authorId, input.name.trim(), token.slice(0, 12), sha256(token), expiresAt]);
    return { key: toKey(row), token };
  }
  async listKeys(userId: string): Promise<List<ApiKey>> {
    return { items: (await this.q('SELECT * FROM api_keys WHERE created_by=$1 OR user_id=$1 ORDER BY created_at DESC, id DESC LIMIT 100', [userId])).map(toKey) };
  }
  async revokeKey(userId: string, id: string): Promise<boolean> {
    return (await this.q('UPDATE api_keys SET revoked_at=now() WHERE id=$1 AND (created_by=$2 OR user_id=$2) AND revoked_at IS NULL RETURNING id', [id, userId])).length > 0;
  }
  async principalForToken(token: string): Promise<ApiPrincipal | null> {
    if (!token.startsWith('flt_')) return null;
    const [row] = await this.q(`UPDATE api_keys k SET last_used_at=now() FROM users u WHERE u.id=k.user_id AND k.token_hash=$1 AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > now()) RETURNING k.id, k.user_id, k.created_by, u.role`, [sha256(token)]);
    return row ? { kind: row.role === 'service' ? 'service' : 'user', userId: row.user_id, authorId: row.created_by, via: 'api-key', keyId: row.id } : null;
  }
  async keyActive(keyId: string): Promise<boolean> {
    return (await this.q('SELECT 1 FROM api_keys WHERE id=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())', [keyId])).length > 0;
  }
  /** Fixed one-minute window per key; returns seconds to wait, 0 when allowed. */
  allow(keyId: string, now = Date.now()): number {
    const w = this.windows.get(keyId);
    if (!w || now - w.start >= 60_000) { this.windows.set(keyId, { start: now, count: 1 }); return 0; }
    if (w.count >= this.rateLimitPerMin) return Math.max(1, Math.ceil((w.start + 60_000 - now) / 1000));
    w.count++;
    return 0;
  }

  async beginRequest(principalId: string, requestId: string, method: string, path: string): Promise<Idempotency> {
    await this.q(`DELETE FROM api_idempotency WHERE principal_id=$1 AND request_id=$2 AND (created_at < now() - interval '24 hours' OR (status IS NULL AND created_at < now() - interval '5 minutes'))`, [principalId, requestId]);
    if ((await this.q('INSERT INTO api_idempotency (principal_id,request_id,method,path) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING 1', [principalId, requestId, method, path])).length) return { state: 'new' };
    const [row] = await this.q('SELECT method,path,status,body,content_type FROM api_idempotency WHERE principal_id=$1 AND request_id=$2', [principalId, requestId]);
    if (!row) return { state: 'pending' };
    if (row.method !== method || row.path !== path) return { state: 'conflict' };
    if (row.status === null) return { state: 'pending' };
    return { state: 'replay', status: row.status, body: row.body, contentType: row.content_type };
  }
  async finishRequest(principalId: string, requestId: string, res: { status: number; body: string; contentType: string } | null): Promise<void> {
    if (!res) await this.q('DELETE FROM api_idempotency WHERE principal_id=$1 AND request_id=$2 AND status IS NULL', [principalId, requestId]);
    else await this.q('UPDATE api_idempotency SET status=$3, body=$4, content_type=$5 WHERE principal_id=$1 AND request_id=$2', [principalId, requestId, res.status, res.body, res.contentType]);
  }

  async createUpload(ownerId: string, input: { name?: unknown; contentType?: unknown; size?: unknown }, baseUrl: string): Promise<UploadGrant> {
    const contentType = input.contentType === undefined ? 'application/octet-stream' : input.contentType;
    if (typeof input.name !== 'string' || !input.name || input.name.length > 255 || typeof contentType !== 'string' || contentType.length > 255) throw new ApiFailure('ValidationFailed', 'name and contentType required');
    if (!Number.isSafeInteger(input.size) || (input.size as number) <= 0) throw new ApiFailure('ValidationFailed', 'size must be a positive integer');
    if ((input.size as number) > this.maxUploadBytes) throw new ApiFailure('PayloadTooLarge', `size exceeds ${this.maxUploadBytes} bytes`);
    const id = rid('fil');
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    await this.q('INSERT INTO api_files (id,owner_id,name,content_type,size,upload_token_hash,upload_expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, ownerId, input.name, contentType, input.size, sha256(token), expiresAt]);
    return { fileId: id, uploadUrl: `${baseUrl}/api/v1/uploads/${id}?token=${token}`, method: 'PUT', headers: { 'content-type': contentType }, expiresAt: expiresAt.toISOString() };
  }
  async completeUpload(id: string, token: string, read: () => Promise<Buffer>): Promise<ApiFile> {
    const [row] = await this.q('SELECT size,upload_token_hash,upload_expires_at,uploaded_at FROM api_files WHERE id=$1', [id]);
    const hash = Buffer.from(sha256(token));
    if (!row || !timingSafeEqual(hash, Buffer.from(row.upload_token_hash))) throw new ApiFailure('Forbidden', 'invalid upload URL');
    if (row.uploaded_at) throw new ApiFailure('Conflict', 'file already uploaded');
    if (row.upload_expires_at.getTime() <= Date.now()) throw new ApiFailure('Forbidden', 'upload URL expired');
    const data = await read();
    if (data.length !== Number(row.size)) throw new ApiFailure('ValidationFailed', `expected ${row.size} bytes, got ${data.length}`);
    const [done] = await this.q(`UPDATE api_files SET data=$2, uploaded_at=now() WHERE id=$1 AND uploaded_at IS NULL RETURNING ${fileCols}`, [id, data]);
    if (!done) throw new ApiFailure('Conflict', 'file already uploaded');
    return toFile(done);
  }
  async getFile(ownerId: string, id: string): Promise<ApiFile | null> {
    const [row] = await this.q(`SELECT ${fileCols} FROM api_files WHERE id=$1 AND owner_id=$2`, [id, ownerId]);
    return row ? toFile(row) : null;
  }
  async listFiles(ownerId: string, rawLimit?: string, cursor?: string): Promise<Page<ApiFile>> {
    const limit = pageLimit(rawLimit);
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await this.q(`SELECT ${fileCols}, created_at::text AS at_text FROM api_files WHERE owner_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id) < ($2::timestamptz,$3)) ORDER BY created_at DESC, id DESC LIMIT $4`, [ownerId, after?.at ?? null, after?.id ?? '', limit + 1]);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items: items.map(toFile), cursor: rows.length > limit ? encodeCursor(last.at_text, last.id) : null };
  }
  /** Resolves fileIds for attachment to a message; every file must be the owner's and fully uploaded. */
  async attachFiles(ownerId: string, fileIds: string[]): Promise<FileRef[]> {
    const rows = await this.q(`SELECT ${fileCols} FROM api_files WHERE owner_id=$1 AND id = ANY($2::text[])`, [ownerId, fileIds]);
    return fileIds.map((id) => {
      const row = rows.find((r) => r.id === id);
      if (!row) throw new ApiFailure('NotFound', `file ${id} not found`);
      if (!row.uploaded_at) throw new ApiFailure('ValidationFailed', `file ${id} not uploaded`);
      return { fileId: id, name: row.name, contentType: row.content_type, size: Number(row.size) };
    });
  }

  async deliverWebhook(secret: string, payload: unknown): Promise<string | null> {
    const [hook] = await this.q('SELECT automation_id FROM automation_webhooks WHERE secret_hash=$1', [sha256(secret)]);
    if (!hook) return null;
    const [row] = await this.q('INSERT INTO automation_webhook_deliveries (id,automation_id,payload) VALUES ($1,$2,$3) RETURNING id', [rid('whd'), hook.automation_id, JSON.stringify(payload)]);
    return row.id;
  }
}

const stores = new Map<string, ApiPlatformStore>();
export function apiPlatformStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): ApiPlatformStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new ApiPlatformStore(databaseUrl)));
  return store;
}
