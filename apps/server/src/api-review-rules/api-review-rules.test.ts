import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createApiReviewRulesRoute } from '../routes/api-review-rules.route.js';
import { ReviewPolicyStore } from '../review-policy/index.js';
import { ApiReviewRulesStore } from './index.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono;
async function call(method: string, path: string, body?: unknown) { const r = await app.request(`http://x/api/v1${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) as any }; }
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    try {
      const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end();
      await new Promise((r) => setTimeout(r, 500));
      const c2 = new pg.Client({ connectionString: url }); await c2.connect(); await c2.query('SELECT 1'); await c2.end(); ready = true;
    } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!ready) throw new Error('postgres fixture did not become ready');
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_rr','rr@example.invalid','member'),('usr_rr2','rr2@example.invalid','member')`);
  const store = new ApiReviewRulesStore(pool); app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.use('*', async (c, next) => { c.set('userId' as never, 'usr_rr' as never); await next(); });
  app.route('/api/v1', createApiReviewRulesRoute(() => store).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 3; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });
it('CAPY-622..634: review rules, filter rules and ignore paths public CRUD', async () => {
  const rr = await call('POST', '/review-rules', { repo: 'acme/app', rule: 'never mutate main directly' }); expect(rr.status).toBe(201); expect(rr.json).toMatchObject({ repo: 'acme/app', enabled: true });
  expect((await call('GET', `/review-rules/${rr.json.id}`)).json.rule).toBe('never mutate main directly');
  expect((await call('PATCH', `/review-rules/${rr.json.id}`, { rule: 'never push main', enabled: false })).json).toMatchObject({ rule: 'never push main', enabled: false });
  expect((await call('GET', '/review-rules?repo=acme/app')).json.items).toEqual([expect.objectContaining({ id: rr.json.id })]);
  expect((await call('POST', '/review-rules', { repo: 'acme/app', rule: 'never push main' })).status).toBe(409);
  const other = await call('POST', '/review-rules', { repo: 'acme/other', rule: 'other repo rule' }); expect((await call('GET', '/review-rules')).json.items).toHaveLength(2); expect((await call('GET', '/review-rules?repo=acme/app')).json.items).toHaveLength(1);
  const rf = await call('POST', '/review-filter-rules', { repo: 'acme/app', pathScope: 'src/**', action: 'ignore', pattern: 'src/generated/**' }); expect(rf.status).toBe(201);
  const ipLive = await call('POST', '/review-ignore-paths', { repo: 'acme/app', path: 'dist/**' }); expect(ipLive.status).toBe(201);
  const inc = await call('POST', '/review-filter-rules', { repo: 'acme/app', pathScope: '**', action: 'include', pattern: 'src/**' }); expect(inc.status).toBe(201);
  const filtered = await new ReviewPolicyStore(pool).filter('usr_rr', 'acme/app', [{ path: 'src/generated/x.ts', diff: 'x' }, { path: 'dist/x.js', diff: 'x' }, { path: 'src/a.ts', diff: 'x' }, { path: 'other.ts', diff: 'x' }]);
  expect(filtered.included.map((x) => x.path)).toEqual(['src/a.ts']); expect(filtered.skipped).toEqual(expect.arrayContaining(['src/generated/x.ts', 'dist/x.js', 'other.ts']));
  expect((await call('DELETE', `/review-filter-rules/${inc.json.id}`)).status).toBe(204);
  expect((await call('DELETE', `/review-ignore-paths/${ipLive.json.id}`)).status).toBe(204);
  expect((await call('PATCH', `/review-filter-rules/${rf.json.id}`, { action: 'include', pattern: 'src/generated/public/**', enabled: false })).json).toMatchObject({ action: 'include', pattern: 'src/generated/public/**', enabled: false });
  expect((await call('GET', '/review-filter-rules?repo=acme/app')).json.items).toEqual([expect.objectContaining({ id: rf.json.id })]);
  const ip = await call('POST', '/review-ignore-paths', { repo: 'acme/app', path: 'dist/**' }); expect(ip.status).toBe(201);
  expect((await call('PATCH', `/review-ignore-paths/${ip.json.id}`, { path: 'coverage/**', enabled: false })).json).toMatchObject({ path: 'coverage/**', enabled: false });
  expect((await call('GET', '/review-ignore-paths?repo=acme/app')).json.items).toEqual([expect.objectContaining({ id: ip.json.id, path: 'coverage/**' })]);
  expect((await call('PATCH', `/review-rules/${rr.json.id}`, { enabled: 'yes' })).status).toBe(400);
  expect((await call('PATCH', `/review-rules/${rr.json.id}`, {})).status).toBe(400);
  const malformed = await app.request(`http://x/api/v1/review-rules/${rr.json.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{' }); expect(malformed.status).toBe(400);
  const concurrent = await call('POST', '/review-rules', { repo: 'acme/race', rule: 'initial' });
  await Promise.all([call('PATCH', `/review-rules/${concurrent.json.id}`, { rule: 'different fields survive' }), call('PATCH', `/review-rules/${concurrent.json.id}`, { enabled: false })]);
  expect((await call('GET', `/review-rules/${concurrent.json.id}`)).json).toMatchObject({ rule: 'different fields survive', enabled: false });
  expect((await call('DELETE', `/review-rules/${concurrent.json.id}`)).status).toBe(204);
  expect((await call('POST', '/review-filter-rules', { repo: 'badrepo', pattern: 'x' })).status).toBe(400);
  expect((await call('DELETE', `/review-rules/${rr.json.id}`)).status).toBe(204);
  expect((await call('DELETE', `/review-filter-rules/${rf.json.id}`)).status).toBe(204);
  expect((await call('DELETE', `/review-ignore-paths/${ip.json.id}`)).status).toBe(204);
  expect((await call('GET', `/review-rules/${rr.json.id}`)).status).toBe(404);
  expect((await call('DELETE', `/review-rules/${other.json.id}`)).status).toBe(204);
}, 30_000);
