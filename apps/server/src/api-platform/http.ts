import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { Context, Next } from 'hono';
import { masterKey } from '../secrets/vault.js';
import { apiPlatformStore } from './store.js';
import { apiError, type ApiPrincipal } from './types.js';

const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v ?? null);
let processKey: Buffer | undefined;
function idempotencyKey(): Buffer {
  if (processKey) return processKey;
  try { return (processKey = masterKey()); } catch { return (processKey = randomBytes(32)); }
}
/** Keyed so a database reader cannot brute-force low-entropy request fields (notably env values) from the fingerprint. */
export function idempotencyFingerprint(principalId: string, body: unknown): string {
  return createHmac('sha256', idempotencyKey()).update(`${principalId}\n${canonical(body)}`).digest('hex');
}
export function legacyIdempotencyFingerprint(body: unknown): string {
  return createHash('sha256').update(canonical(body)).digest('hex');
}

/** Replays a create with the same requestId (body) or Idempotency-Key (header) for the same principal. */
export async function withIdempotency(c: Context, next: Next): Promise<Response | void> {
  // Mint responses carry a raw token; never store or replay them.
  if (c.req.method !== 'POST' || c.req.path === '/api/v1/api-keys') return next();
  const body = (await c.req.json().catch(() => null)) as { requestId?: unknown } | null;
  const requestId = typeof body?.requestId === 'string' && body.requestId ? body.requestId : c.req.header('idempotency-key');
  if (!requestId) return next();
  if (requestId.length > 200) return apiError(c, 'ValidationFailed', 'requestId too long');
  const principal = c.get('principal') as ApiPrincipal;
  const store = apiPlatformStore();
  const fingerprint = idempotencyFingerprint(principal.userId, body);
  const begun = await store.beginRequest(principal.userId, requestId, c.req.method, c.req.path, fingerprint, legacyIdempotencyFingerprint(body));
  if (begun.state === 'conflict') return apiError(c, 'Conflict', 'requestId was already used for a different request');
  if (begun.state === 'pending') return apiError(c, 'RequestInProgress', 'a request with this requestId is still in progress');
  if (begun.state === 'replay') return new Response(begun.body, { status: begun.status, headers: { 'content-type': begun.contentType, 'idempotent-replayed': 'true' } });
  try {
    await next();
  } catch (err) {
    await store.finishRequest(principal.userId, requestId, null);
    throw err;
  }
  const type = c.res.headers.get('content-type') ?? 'application/json';
  const ok = c.res.status >= 200 && c.res.status < 300 && !type.includes('event-stream');
  await store.finishRequest(principal.userId, requestId, ok ? { status: c.res.status, body: await c.res.clone().text(), contentType: type } : null);
}
