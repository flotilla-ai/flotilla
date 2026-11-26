import type { MiddlewareHandler } from 'hono';
import { authStore, cookieSession } from './store.js';

export const requireSession: MiddlewareHandler = async (c, next) => {
  const session = await authStore().session(cookieSession(c.req.header('cookie')));
  if (!session) return c.text('unauthorized', 401);
  if (c.req.method !== 'GET' && c.req.header('x-flotilla-csrf') !== session.csrfToken) return c.text('forbidden', 403);
  c.set('session', session);
  c.set('userId', session.userId);
  await next();
};
