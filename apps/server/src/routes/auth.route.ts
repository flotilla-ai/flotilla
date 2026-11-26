import { Hono } from 'hono';
import { authStore, cookieSession } from '../auth/store.js';

export function sessionCookie(id: string, secure: boolean): string {
  return `flotilla_session=${id}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
export function createAuthRoute(store = authStore()) {
  const app = new Hono();
  const csrf = (c: { req: { header(n: string): string | undefined } }) => store.session(cookieSession(c.req.header('cookie')));
  app.post('/setup', async (c) => {
    if (await store.userCount() > 0) return c.json({ error: 'setup complete' }, 409);
    const body = await c.req.json().catch(() => ({}));
    if (!body.email || !body.password || !body.token) return c.json({ error: 'email, password and token required' }, 400);
    const out = await store.setup(body.email, body.password, body.token);
    if (!out) return c.json({ error: 'invalid setup token' }, 403);
    return c.json(out, 201);
  });
  app.post('/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const session = await store.login(body.email ?? '', body.password ?? '');
    if (!session) return c.json({ error: 'invalid credentials' }, 401);
    const secure = c.req.header('x-forwarded-proto') === 'https' || c.req.url.startsWith('https://');
    c.header('set-cookie', sessionCookie(session.id, secure));
    return c.json({ userId: session.userId, csrfToken: session.csrfToken });
  });
  app.post('/logout', async (c) => {
    const session = await csrf(c);
    if (!session) return c.text('unauthorized', 401);
    if (c.req.header('x-flotilla-csrf') !== session.csrfToken) return c.text('forbidden', 403);
    await store.logout(session.id);
    c.header('set-cookie', 'flotilla_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return c.json({ ok: true });
  });
  app.get('/me', async (c) => {
    const session = await csrf(c);
    if (!session) return c.text('unauthorized', 401);
    return c.json({ userId: session.userId, csrfToken: session.csrfToken });
  });
  return { basePath: '/api/v1/auth', app, public: true };
}
export default createAuthRoute();
