import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createReviewCoreRoute } from '../routes/review-core.route.js';
import { ReviewCoreStore, reviewCredits } from './index.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono; let store: ReviewCoreStore;
async function call(method: string, path: string, body?: unknown) {
  const r = await app.request(`http://local/api/v1${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': 'usr_r' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) as any };
}
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url }); store = new ReviewCoreStore(pool);
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_r','r@x','member')`);
  app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.use('*', async (c, next) => { c.set('userId' as never, 'usr_r' as never); await next(); });
  app.route('/api/v1', createReviewCoreRoute(() => store).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

it('CAPY-130..141,498: review rounds, findings, effort, triage, posting policy and incremental state', async () => {
  expect(reviewCredits('low', 1)).toBe(1); expect(reviewCredits('medium', 1)).toBe(5); expect(reviewCredits('high', 1)).toBe(10); expect(reviewCredits('flex', 1)).toBe(5); expect(reviewCredits('flex', 2)).toBe(1);
  const settings = await call('PUT', '/reviews/settings/acme/app', { automaticMode: 'every-push', postingThreshold: 'medium', includeInvestigate: false, includeNotes: false });
  expect(settings.status).toBe(200); expect(settings.json).toMatchObject({ automaticMode: 'every-push', postingThreshold: 'medium', includeInvestigate: false, includeNotes: false });
  expect((await call('PUT', '/reviews/settings/acme/app', { automaticMode: 'sometimes' })).status).toBe(400);

  const run = await call('POST', '/reviews', { repo: 'acme/app', prNumber: 7, headSha: 'aaaaaaa', baseSha: '0000000', source: 'mention', instructions: '@capy review security only', effort: 'flex', adapter: 'fake' });
  expect(run.status).toBe(201); expect(run.json).toMatchObject({ repo: 'acme/app', prNumber: 7, headSha: 'aaaaaaa', round: 1, source: 'mention', instructions: '@capy review security only', credits: 5, adapter: 'fake', readOnly: true, checkoutExactHead: true, status: 'completed' });

  const added = await call('POST', `/reviews/${run.json.id}/findings`, { items: [
    { kind: 'finding', category: 'bug', severity: 'high', confidence: 'confirmed', file: 'src/a.ts', line: 9, body: 'null dereference', fingerprint: 'fp-high' },
    { kind: 'finding', category: 'risk', severity: 'low', confidence: 'investigate', file: 'src/b.ts', line: 2, body: 'possible race', fingerprint: 'fp-risk' },
    { kind: 'note', file: 'src/c.ts', line: 4, body: 'uses fixture boundary', fingerprint: 'fp-note' }
  ] });
  expect(added.status).toBe(201);
  expect(added.json.items).toHaveLength(3);
  expect(added.json.items.find((x: any) => x.fingerprint === 'fp-high')).toMatchObject({ category: 'bug', severity: 'high', confidence: 'confirmed', posted: true, status: 'open' });
  expect(added.json.items.find((x: any) => x.fingerprint === 'fp-risk')).toMatchObject({ posted: false, confidence: 'investigate' });
  expect(added.json.items.find((x: any) => x.fingerprint === 'fp-note')).toMatchObject({ kind: 'note', posted: false });

  const duplicate = await call('POST', `/reviews/${run.json.id}/findings`, { items: [{ kind: 'finding', category: 'bug', severity: 'high', confidence: 'confirmed', file: 'src/a.ts', line: 9, body: 'null dereference', fingerprint: 'fp-high' }] });
  expect(duplicate.json.items).toHaveLength(0);
  const state1 = await call('GET', '/reviews/acme/app/7');
  expect(state1.json.readiness).toMatchObject({ ready: false, override: false }); expect(state1.json.readiness.blockedBy).toHaveLength(1);

  const high = added.json.items.find((x: any) => x.fingerprint === 'fp-high');
  const triaged = await call('PUT', `/review-findings/${high.id}/triage`, { status: 'irrelevant' });
  expect(triaged.json).toMatchObject({ status: 'irrelevant', githubThreadState: 'resolved' });
  expect((await call('GET', '/reviews/acme/app/7')).json.readiness.ready).toBe(true);
  await call('PUT', `/review-findings/${high.id}/triage`, { status: 'open' });
  const override = await call('PUT', `/reviews/${run.json.id}/ready-override`, { enabled: true });
  expect(override.json.readyOverride).toBe(true); expect((await call('GET', '/reviews/acme/app/7')).json.readiness).toMatchObject({ ready: true, override: true });
  await store.triage('usr_r', high.id, 'irrelevant');

  const pushed = await call('POST', '/reviews/push', { repo: 'acme/app', prNumber: 7, headSha: 'bbbbbbb' });
  expect(pushed.status).toBe(201); expect(pushed.json).toMatchObject({ round: 2, headSha: 'bbbbbbb', source: 'push', credits: 1, lastReviewedSha: 'aaaaaaa', readOnly: true, checkoutExactHead: true });
  const oldState = (await pool.query('SELECT count(*)::int n FROM review_findings WHERE run_id=$1 AND superseded=true', [run.json.id])).rows[0].n;
  expect(oldState).toBe(3);
  const irrelevantAgain = await call('POST', `/reviews/${pushed.json.id}/findings`, { items: [{ kind: 'finding', category: 'bug', severity: 'high', confidence: 'confirmed', file: 'src/a.ts', line: 9, body: 'null dereference', fingerprint: 'fp-high' }] });
  expect(irrelevantAgain.json.items).toHaveLength(0);
  await store.triage('usr_r', high.id, 'resolved');
  const failedFix = await call('POST', `/reviews/${pushed.json.id}/findings`, { items: [{ kind: 'finding', category: 'bug', severity: 'high', confidence: 'confirmed', file: 'src/a.ts', line: 9, body: 'null dereference returned', fingerprint: 'fp-high' }] });
  expect(failedFix.json.items).toHaveLength(1); expect(failedFix.json.items[0]).toMatchObject({ round: 2, status: 'open' });

  expect((await call('POST', '/reviews/push', { repo: 'acme/app', prNumber: 7, headSha: 'bbbbbbb' }))).toMatchObject({ status: 200 });
  await call('PUT', '/reviews/settings/acme/app', { automaticMode: 'once' });
  expect((await call('POST', '/reviews/push', { repo: 'acme/app', prNumber: 7, headSha: 'ccccccc' })).status).toBe(200);
  await call('PUT', '/reviews/settings/acme/app', { automaticMode: 'off' });
  expect((await call('POST', '/reviews/push', { repo: 'acme/app', prNumber: 7, headSha: 'ddddddd' })).status).toBe(200);
  expect((await call('POST', '/reviews', { repo: 'acme/app', prNumber: 7, headSha: 'not-a-sha' })).status).toBe(400);
}, 30_000);
