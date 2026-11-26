import type { MiddlewareHandler } from 'hono';

export const requireSession: MiddlewareHandler = async (c) => {
  return c.text('unauthorized', 401);
};
