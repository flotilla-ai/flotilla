import type { MiddlewareHandler } from 'hono';
import { authStore, cookieSession } from './store.js';
import { withIdempotency } from '../api-platform/http.js';
import { apiPlatformStore } from '../api-platform/store.js';
import { apiError, type ApiPrincipal } from '../api-platform/types.js';

export const requireSession: MiddlewareHandler = async (c, next) => {
  if (c.get('principal')) return next();
  const bearer = c.req.header('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  let principal: ApiPrincipal;
  if (bearer) {
    const keys = apiPlatformStore();
    const found = await keys.principalForToken(bearer);
    if (!found) return apiError(c, 'Unauthorized', 'invalid, expired or revoked API key');
    const wait = keys.allow(found.keyId!);
    if (wait) return apiError(c, 'RateLimited', 'rate limit exceeded', { 'retry-after': String(wait) });
    principal = found;
  } else {
    const session = await authStore().session(cookieSession(c.req.header('cookie')));
    if (!session) return apiError(c, 'Unauthorized', 'unauthorized');
    if (c.req.method !== 'GET' && c.req.header('x-flotilla-csrf') !== session.csrfToken) return apiError(c, 'Forbidden', 'forbidden');
    c.set('session', session);
    principal = { kind: 'user', userId: session.userId, authorId: session.userId, via: 'session', keyId: null };
  }
  c.set('principal', principal);
  c.set('userId', principal.userId);
  return withIdempotency(c, next);
};
