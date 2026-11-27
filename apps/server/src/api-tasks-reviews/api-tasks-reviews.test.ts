import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { EventStore } from '../events/store.js';
import { createApiTasksReviewsRoute } from '../routes/api-tasks-reviews.route.js';
import { ApiTasksReviewsStore } from './index.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono; let store: ApiTasksReviewsStore;
async function call(method: string, path: string, body?: unknown) { const r = await app.request(`http://x/api/v1${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) as any }; }
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url }); store = new ApiTasksReviewsStore(pool, url);
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_tr','tr@example.invalid','member')`);
  await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent,visibility) VALUES ('thr_tr','FLO-TR','thread','usr_tr','Legacy task','idle','{}','{}','{}','private')`);
  await new EventStore(url, pool).appendEvents('thr_tr' as never, [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: { text: 'hello task' } }, { runId: null, kind: 'agent.message', source: 'adapter', trust: 'trusted', payload: { text: 'task reply' } }] as never);
  await pool.query(`INSERT INTO github_accounts (id,user_id,login,kind,token_ref) VALUES ('gha_tr','usr_tr','alice','personal','vault:github/token')`);
  await pool.query(`INSERT INTO github_installations (id,account_id,installation_id,subject,repositories,permissions,verified_at) VALUES ('ghi_tr','gha_tr','1','acme','["acme/app"]','{}',now())`);
  app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.use('*', async (c, next) => { c.set('userId' as never, 'usr_tr' as never); await next(); });
  app.route('/api/v1', createApiTasksReviewsRoute(() => store).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 3; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });
it('CAPY-596..598,611,612,618..621: legacy task aliases and public review API', async () => {
  expect((await call('GET', '/tasks')).json.items).toEqual([expect.objectContaining({ id: 'thr_tr', title: 'Legacy task', updatedFromThread: true })]);
  expect((await call('GET', '/tasks/thr_tr')).json).toMatchObject({ id: 'thr_tr', code: 'FLO-TR' });
  const messages = (await call('GET', '/tasks/thr_tr/messages')).json.items; expect(messages.map((x: any) => x.kind)).toEqual(['user.message', 'agent.message']);
  expect((await call('GET', '/tasks/missing')).status).toBe(404);
  const configured = await call('PUT', '/review-settings/acme/app', { automaticMode: 'every-push', postingThreshold: 'low', includeInvestigate: true, includeNotes: true }); expect(configured.status).toBe(200);
  expect((await call('GET', '/review-settings/acme/app')).json).toMatchObject({ automaticMode: 'every-push', postingThreshold: 'low', includeInvestigate: true, includeNotes: true });
  const run = await call('POST', '/review-runs', { repo: 'acme/app', prNumber: 12, headSha: 'abcde01', effort: 'low', adapter: 'fake' }); expect(run.status).toBe(201); expect(run.json).toMatchObject({ round: 1, source: 'api', credits: 1, readOnly: true });
  const findings = await store.reviews.addFindings('usr_tr', run.json.id, [{ kind: 'finding', category: 'bug', severity: 'high', confidence: 'confirmed', file: 'a.ts', line: 3, body: 'bad null', fingerprint: 'fp-tr' }]);
  const round = await call('GET', `/review-runs/${run.json.id}/round`); expect(round.status).toBe(200); expect(round.json.run).toMatchObject({ id: run.json.id, round: 1, headSha: 'abcde01' }); expect(round.json.findings).toEqual([expect.objectContaining({ id: findings[0].id, fingerprint: 'fp-tr' })]);
  const pull = await call('GET', '/review-pulls/acme/app/12'); expect(pull.json).toMatchObject({ repo: 'acme/app', prNumber: 12 }); expect(pull.json.run.id).toBe(run.json.id); expect(pull.json.readiness.ready).toBe(false);
  const updated = await call('PATCH', '/review-findings/statuses', { items: [{ id: findings[0].id, status: 'resolved' }] }); expect(updated.status).toBe(200); expect(updated.json.items[0]).toMatchObject({ status: 'resolved', githubThreadState: 'resolved' });
  expect((await call('GET', '/review-pulls/acme/app/12')).json.readiness.ready).toBe(true);
  expect((await call('PATCH', '/review-findings/statuses', { items: [{ id: findings[0].id, status: 'bad' }] })).status).toBe(400);
}, 30_000);
