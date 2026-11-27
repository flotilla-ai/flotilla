import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { GitHubIntegrationStore, permissionsSufficient, REQUIRED_PERMISSIONS } from './index.js';
import { createGitHubIntegrationRoute } from '../routes/github-integration.route.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono;
const call = async (method: string, path: string, body?: unknown, user = 'usr_g') => { const r = await app.request(`http://local/api/v1${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) as any }; };
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_g','g@x','member'),('usr_admin','a@x','admin'),('usr_other','o@x','member')`);
  const store = new GitHubIntegrationStore(pool); app = new Hono();
  app.use('*', async (c, next) => { c.set('userId' as never, c.req.header('x-user') as never); await next(); });
  app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.route('/api/v1', createGitHubIntegrationRoute(() => store).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });

it('CAPY-399/400/401/402/405/518: multiple accounts, managed installations, commit identity options, permission floor and admin unlink', async () => {
  expect(permissionsSufficient({ contents: 'read', pullRequests: 'write', checks: 'read', issues: 'write', metadata: 'read' })).toEqual(['contents']);
  expect(REQUIRED_PERMISSIONS).toEqual({ contents: 'write', pullRequests: 'write', checks: 'read', issues: 'write', metadata: 'read' });
  const personal = await call('POST', '/github/accounts', { login: 'user-login', kind: 'personal', tokenRef: 'vault:personal', commitEmail: 'user@example.com' });
  expect(personal.status).toBe(201); expect(personal.json).toMatchObject({ login: 'user-login', kind: 'personal', commitIdentity: 'you-capy-coauthor', commitEmail: 'user@example.com' });
  const org = await call('POST', '/github/accounts', { login: 'acme', kind: 'organization', tokenRef: 'vault:acme' });
  expect(org.status).toBe(201);
  expect((await call('GET', '/github/accounts')).json.items.map((x: any) => x.login)).toEqual(['acme', 'user-login']);

  const missing = await call('POST', `/github/accounts/${org.json.id}/installations`, { installationId: 'inst-missing', subject: 'acme', permissions: { ...REQUIRED_PERMISSIONS, contents: 'read' } });
  expect(missing.status).toBe(400); expect(missing.json.error).toContain('contents');
  const installation = await call('POST', `/github/accounts/${org.json.id}/installations`, { installationId: 'inst-1', subject: 'acme', repositories: ['acme/app', 'acme/private-deps'], permissions: { ...REQUIRED_PERMISSIONS, metadata: 'admin' }, dependencyReader: true });
  expect(installation.status).toBe(201); expect(installation.json).toMatchObject({ installationId: 'inst-1', dependencyReader: true, repositories: ['acme/app', 'acme/private-deps'] });
  expect((await call('GET', `/github/accounts/${org.json.id}/installations`)).json.items).toHaveLength(1);

  for (const identity of ['you', 'capy-you', 'capy', 'you-capy-coauthor'] as const) {
    const r = await call('PUT', `/github/accounts/${personal.json.id}/commit-identity`, { identity }); expect(r.status).toBe(200); expect(r.json.commitIdentity).toBe(identity);
  }
  expect((await call('PUT', `/github/accounts/${personal.json.id}/commit-identity`, { identity: 'robot' })).status).toBe(400);
  expect((await call('PUT', '/github/pulls/acme/app/12/commit-identity', { identity: 'you' })).json).toEqual({ repo: 'acme/app', number: 12, identity: 'you' });
  expect((await call('PUT', '/github/pulls/acme/app/12/commit-identity', { identity: 'bad' })).status).toBe(400);

  expect((await call('DELETE', `/github/accounts/${org.json.id}`, undefined, 'usr_other')).status).toBe(404);
  expect((await call('DELETE', `/github/accounts/${org.json.id}`, undefined, 'usr_admin')).status).toBe(204);
  expect((await call('GET', '/github/accounts')).json.items.map((x: any) => x.login)).toEqual(['user-login']);
});
