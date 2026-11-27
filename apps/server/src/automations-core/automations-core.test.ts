import { createHmac } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createAutomationsCoreRoute } from '../routes/automations-core.route.js';
import { createAutomationWebhooksRoute } from '../routes/automation-webhooks.route.js';
import { AutomationStore, cronMatches } from './index.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let url = ''; let app: Hono; let store: AutomationStore; let gateAnswer = true;
const gateCalls: string[] = []; const starts: string[] = [];
async function request(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers); headers.set('x-user', 'usr_a'); if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
async function createAutomation(input: Record<string, unknown>) { const r = await request('/projects/prj_auto/automations', { method: 'POST', json: input }); return { status: r.status, body: await r.json() as any }; }
const manual = { type: 'manual' };
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); process.env.DATABASE_URL = url; pool = new pg.Pool({ connectionString: url });
  await pool.query("INSERT INTO users (id,email,role) VALUES ('usr_a','a@x','admin')");
  await pool.query("INSERT INTO projects (id,owner_id,name,repo,trust,budget,code) VALUES ('prj_auto','usr_a','Auto','{}','untrusted','{}','AUT')");
  store = new AutomationStore(url, { gate: async (x) => { gateCalls.push(`${x.runWhen}:${x.model.model}`); return gateAnswer; }, resolveModel: async (name, pinned) => pinned && name === 'missing' ? null : name ?? 'free-default', startRun: async (x) => { starts.push(`${x.threadId}:${x.prompt}`); } });
  app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : c.json({ error: String(err) }, 500));
  app.use(async (c, next) => { c.set('userId' as never, 'usr_a' as never); await next(); });
  app.route('/api/v1', createAutomationsCoreRoute(() => store).app); app.route('/api/v1', createAutomationWebhooksRoute(() => store).app);
}, 30_000);
afterAll(async () => { await store?.close(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

it('CAPY-152/154/155/159/160/161/162/163/164/165/166/500: automation triggers, conditions, gates, models, batches and thread modes', async () => {
  expect((await createAutomation({ name: 'bad', prompt: 'x', triggers: [] })).status).toBe(400);
  expect((await createAutomation({ name: 'bad', prompt: 'x', triggers: Array(21).fill(manual) })).status).toBe(400);
  expect((await createAutomation({ name: 'bad', prompt: 'x', triggers: [{ type: 'schedule', cron: '* * * * *', timezone: 'UTC' }] })).status).toBe(400);
  expect((await createAutomation({ name: 'bad', prompt: 'x', triggers: [{ type: 'schedule', cron: '*/5 * * * *', timezone: 'Mars/Olympus' }] })).status).toBe(400);
  expect((await createAutomation({ name: 'annual-ok', prompt: 'x', triggers: [{ type: 'schedule', cron: '0 0 1 1 *', timezone: 'UTC' }] })).status).toBe(201);
  expect(cronMatches('30 1 * * *', 'America/New_York', new Date('2026-03-08T06:30:00Z'))).toBe(true);
  expect(cronMatches('30 1 * * *', 'America/New_York', new Date('2026-03-08T07:30:00Z'))).toBe(false);

  const made = await createAutomation({ name: 'Triage', prompt: 'triage the event', triggers: [manual, { type: 'webhook', hmac: true }, { type: 'github', event: 'pr-opened' }, { type: 'schedule', cron: '*/5 * * * *', timezone: 'UTC' }, { type: 'schedule', cron: '10 9 * * 1', timezone: 'America/New_York' }], conditions: { repo: 'acme/api', branch: { regex: '^main' }, labels: 'critical', text: { contains: 'urgent' }, author: ['alice', 'bob'] }, runWhen: 'critical production urgency', gateModel: { adapter: 'fake', model: 'free-fast' }, model: { name: 'missing', pinned: true } });
  expect(made.status).toBe(409); expect(made.body.error).toContain('pinned model');

  const created = await createAutomation({ name: 'Triage', prompt: 'triage the event', triggers: [manual, { type: 'webhook', hmac: true }, { type: 'github', event: 'pr-opened' }, { type: 'schedule', cron: '*/5 * * * *', timezone: 'UTC' }, { type: 'schedule', cron: '10 9 * * 1', timezone: 'America/New_York' }], conditions: { repo: 'acme/api', branch: { regex: '^main' }, labels: 'critical', text: { contains: 'urgent' }, author: ['alice', 'bob'] }, runWhen: 'critical production urgency', gateModel: { adapter: 'fake', model: 'free-fast' }, model: { pinned: false } });
  expect(created.status).toBe(201); const a = created.body;
  expect(a.triggers).toHaveLength(5); expect(a.model).toEqual({ adapter: 'fake', name: 'free-default', pinned: false }); expect(a.webhookToken).toBeTruthy();
  const secretRows = await pool.query('SELECT webhook_hash FROM automations WHERE id=$1', [a.id]);
  expect(secretRows.rows[0].webhook_hash).not.toBe(a.webhookToken);

  gateAnswer = false;
  const mismatch = await store.triggerGithub('usr_a', a.id, 'pr-opened', { repo: 'acme/api', branch: 'dev', labels: ['critical'], text: 'urgent', author: 'alice' });
  expect(mismatch).toMatchObject({ status: 'skipped', skipReason: 'conditions did not match', threadId: null });
  const gated = await store.triggerGithub('usr_a', a.id, 'pr-opened', { repo: 'acme/api', branch: 'main', labels: ['critical'], text: 'urgent', author: 'alice' });
  expect(gated).toMatchObject({ status: 'skipped', skipReason: 'run_when gate rejected' }); expect(gateCalls.at(-1)).toBe('critical production urgency:free-fast');
  gateAnswer = true;
  const good = await store.triggerGithub('usr_a', a.id, 'pr-opened', { repo: 'acme/api', branch: 'main', labels: ['critical'], text: 'urgent production breakage', author: 'alice' });
  expect(good.status).toBe('queued'); expect(good.threadId).toMatch(/^thr_/);
  const thread = (await pool.query('SELECT project_id,role,code,visibility FROM threads WHERE id=$1', [good.threadId])).rows[0];
  expect([thread.project_id, thread.role, thread.code, thread.visibility]).toEqual(['prj_auto', 'thread', 'AUT-1', 'private']);
  expect(starts.at(-1)).toBe(`${good.threadId}:triage the event`);
  const wrongEvent = await store.triggerGithub('usr_a', a.id, 'branch-push', { repo: 'acme/api', branch: 'main', labels: ['critical'], text: 'urgent', author: 'alice' });
  expect(wrongEvent.skipReason).toBe('no matching trigger');
  const hooked = await store.githubEvent('pull_request', { action: 'opened', delivery_id: 'delivery-1', repository: { full_name: 'acme/api' }, pull_request: { merged: false, title: 'urgent production fix', base: { ref: 'main' }, labels: [{ name: 'critical' }] }, sender: { login: 'alice' } });
  expect(hooked.map((x) => [x.automationId, x.status])).toContainEqual([a.id, 'queued']);
  expect((await store.githubEvent('pull_request', { action: 'opened', delivery_id: 'delivery-1', repository: { full_name: 'acme/api' }, pull_request: { merged: false, title: 'urgent production fix', base: { ref: 'main' }, labels: [{ name: 'critical' }] }, sender: { login: 'alice' } }))[0].status).toBe('duplicate');

  const manualRun = await (await request(`/automations/${a.id}/trigger`, { method: 'POST', json: { idempotencyKey: 'manual-1' } })).json() as any;
  expect(manualRun.status).toBe('queued'); expect(manualRun.threadId).not.toBe(good.threadId);
  const manualDuplicate = await (await request(`/automations/${a.id}/trigger`, { method: 'POST', json: { idempotencyKey: 'manual-1' } })).json() as any;
  expect(manualDuplicate.status).toBe('duplicate'); expect(manualDuplicate.id).toBe(manualRun.id);

  const payload = { repo: 'acme/api', branch: 'main', labels: ['critical'], text: 'urgent production breakage', author: 'bob' };
  const raw = JSON.stringify(payload); const sig = createHmac('sha256', a.webhookToken).update(raw).digest('hex');
  expect((await request(`/automation-webhooks/${a.webhookToken}`, { method: 'POST', body: raw, headers: { 'content-type': 'application/json' } })).status).toBe(403);
  const first = await (await request(`/automation-webhooks/${a.webhookToken}`, { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'idempotency-key': 'wh-1', 'x-flotilla-signature': sig } })).json() as any;
  expect(first.result).toBe('accepted'); expect(first.run.status).toBe('queued');
  const duplicate = await (await request(`/automation-webhooks/${a.webhookToken}`, { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'idempotency-key': 'wh-1', 'x-flotilla-signature': sig } })).json() as any;
  expect(duplicate.result).toBe('duplicate');
  expect((await (await request('/automation-webhooks/not-the-token', { method: 'POST', body: raw, headers: { 'content-type': 'application/json' } })).json() as any).result).toBe('no-match');
  expect((await request(`/automation-webhooks/${a.webhookToken}`, { method: 'POST', body: '{"x":"' + 'x'.repeat(300_000) + '"}', headers: { 'content-type': 'application/json' } })).status).toBe(413);

  const pinned = await store.create('usr_a', 'prj_auto', { name: 'Pinned', prompt: 'x', triggers: [manual], model: { name: 'fake-large', pinned: true } });
  expect((pinned.model as any).adapter).toBe('fake');
  const pinnedRun = await store.trigger('usr_a', pinned.id, {});
  expect((await pool.query('SELECT engine FROM threads WHERE id=$1', [pinnedRun.threadId])).rows[0].engine).toMatchObject({ adapter: 'fake', model: 'fake-large' });

  const batchedAutomation = await store.create('usr_a', 'prj_auto', { name: 'Batch', prompt: 'summarize batch', triggers: [{ type: 'webhook', batch: true }], model: { pinned: false } });
  const btoken = batchedAutomation.webhookToken!;
  expect((await store.webhook(btoken, { n: 1 }, null)).result).toBe('batched'); expect((await store.webhook(btoken, { n: 2 }, null)).result).toBe('batched');
  const batchList = await store.batches('usr_a', batchedAutomation.id); expect(batchList).toHaveLength(1); expect(batchList[0].events).toEqual([{ n: 1 }, { n: 2 }]);
  const flushed = await store.flushBatch('usr_a', batchedAutomation.id, batchList[0].id);
  expect(flushed.status).toBe('queued'); expect(flushed.payload.events).toHaveLength(2);
  await store.webhook(btoken, { n: 3 }, null); const secondBatch = (await store.batches('usr_a', batchedAutomation.id)).find((x) => x.state === 'open')!;
  expect((await store.cancelBatch('usr_a', batchedAutomation.id, secondBatch.id)).state).toBe('cancelled');
  expect((await pool.query('SELECT count(*)::int AS n FROM automation_runs WHERE automation_id=$1', [batchedAutomation.id])).rows[0].n).toBe(1);

  const standing = await store.create('usr_a', 'prj_auto', { name: 'Standing', prompt: 'x', triggers: [manual], threadMode: 'standing', model: { pinned: false } });
  const s1 = await store.trigger('usr_a', standing.id, {}); const s2 = await store.trigger('usr_a', standing.id, {});
  expect(s1.threadId).toBe(s2.threadId);
  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_existing','AUT-90','prj_auto','thread','usr_a','existing','idle','{}','{}','{}')`);
  const existing = await store.create('usr_a', 'prj_auto', { name: 'Existing', prompt: 'x', triggers: [manual], threadMode: 'existing', existingThreadId: 'thr_existing', model: { pinned: false } });
  expect((await store.trigger('usr_a', existing.id, {})).threadId).toBe('thr_existing');
  expect((await store.create('usr_a', 'prj_auto', { name: 'Private', prompt: 'x', triggers: [manual], threadMode: 'private', model: { pinned: false } })).threadMode).toBe('private');

  const scheduled = await store.create('usr_a', 'prj_auto', { name: 'Schedules', prompt: 'run schedule', triggers: [{ type: 'schedule', cron: '*/5 * * * *', timezone: 'UTC' }, { type: 'schedule', cron: '10 9 * * 1', timezone: 'America/New_York' }], model: { pinned: false } });
  const minute = new Date(Math.ceil(Date.now() / 300_000) * 300_000);
  const due = await store.dueSchedules(minute);
  const dueRows = due.filter((x) => x.automationId === scheduled.id);
  expect(dueRows).toHaveLength(1); expect(dueRows[0].status).toBe('queued');
  const again = (await store.dueSchedules(minute)).filter((x) => x.automationId === scheduled.id);
  expect(again[0].status).toBe('duplicate'); expect(again[0].id).toBe(dueRows[0].id);
}, 30_000);
