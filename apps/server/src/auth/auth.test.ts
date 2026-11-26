import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { AuthStore, authStore } from './store.js';
import { createAuthRoute } from '../routes/auth.route.js';
import { requireSession } from './requireSession.js';

const exec = promisify(execFile);
let container = ''; let url = ''; let store: AuthStore; let app: Hono;
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) {
    try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  await migrate(url);
  process.env.DATABASE_URL = url;
  store = new AuthStore(url);
  app = new Hono();
  app.route('/api/v1/auth', createAuthRoute(store).app);
  app.get('/secure', requireSession, (c) => c.text('ok'));
  app.post('/secure', requireSession, (c) => c.text('posted'));
}, 30_000);
afterAll(async () => { await store.pool.end(); await authStore(url).pool.end().catch(() => undefined); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });

describe('auth', () => {
  it('sets up once with token, logs in with secure host-only cookie, and rejects wrong password', async () => {
    const token = await store.getSetupToken();
    expect((await app.request('http://local/api/v1/auth/setup', { method: 'POST', body: JSON.stringify({ email: 'a@x', password: 'pw', token: 'bad' }) })).status).toBe(403);
    const created = await app.request('http://local/api/v1/auth/setup', { method: 'POST', body: JSON.stringify({ email: 'a@x', password: 'pw', token }) });
    expect(created.status).toBe(201);
    expect((await app.request('http://local/api/v1/auth/setup', { method: 'POST', body: JSON.stringify({ email: 'b@x', password: 'pw', token }) })).status).toBe(409);
    expect((await app.request('http://local/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@x', password: 'wrong' }) })).status).toBe(401);
    const login = await app.request('https://local/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@x', password: 'pw' }) });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Lax'); expect(cookie).toContain('Secure'); expect(cookie).not.toContain('Domain=');
  });
  it('requires cookie and CSRF for non-GET', async () => {
    const login = await app.request('http://local/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@x', password: 'pw' }) });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const { csrfToken } = await login.json() as { csrfToken: string };
    expect((await app.request('http://local/secure')).status).toBe(401);
    expect((await app.request('http://local/secure', { headers: { cookie } })).status).toBe(200);
    expect((await app.request('http://local/secure', { method: 'POST', headers: { cookie } })).status).toBe(403);
    expect((await app.request('http://local/secure', { method: 'POST', headers: { cookie, 'x-flotilla-csrf': csrfToken } })).status).toBe(200);
  });
});
