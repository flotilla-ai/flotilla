import type { Context } from 'hono';

export const apiErrorStatus = {
  ValidationFailed: 400, Unauthorized: 401, PaidFeatureUnavailable: 402, Forbidden: 403, NotFound: 404,
  Conflict: 409, RequestInProgress: 409, CrewRefused: 409, PayloadTooLarge: 413, RateLimited: 429,
  Internal: 500, BillingAuthorityUnavailable: 503
} as const;
export type ApiErrorName = keyof typeof apiErrorStatus;
export type ApiError = { error: string; code: `flotilla/${ApiErrorName}` };

export class ApiFailure extends Error {
  constructor(readonly kind: ApiErrorName, message: string) { super(message); }
}

export function apiError(c: Context, kind: ApiErrorName, message: string, headers?: Record<string, string>): Response {
  return c.json({ error: message, code: `flotilla/${kind}` } satisfies ApiError, apiErrorStatus[kind], headers);
}

export type ApiPrincipal = { kind: 'user' | 'service'; userId: string; authorId: string; via: 'session' | 'api-key'; keyId: string | null };
export type ApiKey = { id: string; name: string; prefix: string; userId: string; createdBy: string; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
export type Page<T> = { items: T[]; cursor: string | null };
export type List<T> = { items: T[] };
export type UploadGrant = { fileId: string; uploadUrl: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string };
export type ApiFile = { id: string; name: string; contentType: string; size: number; status: 'pending' | 'uploaded'; createdAt: string };
export type FileRef = { fileId: string; name: string; contentType: string; size: number };

export function encodeCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify([at, id])).toString('base64url');
}
export function decodeCursor(cursor: string): { at: string; id: string } {
  try {
    const [at, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as unknown[];
    if (typeof at === 'string' && typeof id === 'string' && !Number.isNaN(Date.parse(at))) return { at, id };
  } catch { /* fall through to the typed error */ }
  throw new ApiFailure('ValidationFailed', 'invalid cursor');
}
export function pageLimit(raw: string | undefined, fallback = 50, max = 200): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
}

export const SSE_RETRY_MS = 2000;
export type StreamFrameType = 'status' | 'run' | 'turn' | 'tool_call' | 'assistant' | 'transcript';
export function frameType(kind: string): StreamFrameType {
  if (kind === 'thread.created' || kind === 'thread.status' || kind === 'crew.status') return 'status';
  if (kind.startsWith('run.')) return 'run';
  if (kind === 'user.message' || kind.startsWith('control.')) return 'turn';
  if (kind === 'agent.tool_call' || kind === 'agent.tool_result') return 'tool_call';
  if (kind === 'agent.message' || kind === 'agent.delta') return 'assistant';
  return 'transcript';
}
