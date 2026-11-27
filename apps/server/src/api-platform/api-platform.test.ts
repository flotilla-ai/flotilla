import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';

const exec = promisify(execFile);
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v ?? null);
let container = ''; let url = ''; let pool: pg.Pool; let app: Hono;
let cookie = ''; let csrf = ''; let humanId = '';
let platform: typeof import('./store.js');

async function call(path: string, init: RequestInit & { json?: unknown; bearer?: string; session?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.bearer) headers.set('authorization', `Bearer ${init.bearer}`);
  if (init.session) { headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf); }
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  return app.request(`http://local${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
}
async function mint(body: Record<string, unknown> = { name: 'ci' }): Promise<{ key: { id: string; userId: string }; token: string }> {
  const res = await call('/api/v1/api-keys', { method: 'POST', session: true, json: body });
  expect(res.status).toBe(201);
  return res.json() as never;
}

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) {
    try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  await migrate(url);
  process.env.DATABASE_URL = url;
  pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js');
  const auth = authStore(url);
  humanId = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const session = (await auth.login('owner@x', 'pw'))!;
  cookie = `flotilla_session=${session.id}`; csrf = session.csrfToken;
  platform = await import('./store.js');
  app = await (await import('../loader.js')).createApp();
}, 60_000);
// Route modules hold their own idle pools; remove the database only after this worker exits.
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

describe('api platform', () => {
  it('automation create idempotency replays a redacted response instead of duplicating or storing the token', async () => {
    const { token } = await mint({ name: 'automation-idempotency' });
    await pool.query('INSERT INTO projects (id,owner_id,name,repo,trust,budget,code) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING', ['prj_idem_auto', humanId, 'Auto', '{}', 'untrusted', '{}', 'AIA']);
    const body = { requestId: 'create-automation-once', name: 'Keyed', prompt: 'x', triggers: [{ type: 'webhook' }], conditions: { webhookUrl: 'user-condition-value' } };
    const first = await call('/api/v1/projects/prj_idem_auto/automations', { method: 'POST', bearer: token, json: body });
    expect(first.status).toBe(201);
    const firstBody = await first.json() as any;
    expect(firstBody.webhookToken).toBeTruthy();
    const replay = await call('/api/v1/projects/prj_idem_auto/automations', { method: 'POST', bearer: token, json: body });
    expect(replay.status).toBe(201); expect(replay.headers.get('idempotent-replayed')).toBe('true');
    const replayBody = await replay.json() as any;
    expect(replayBody.id).toBe(firstBody.id);
    expect(replayBody.webhookToken).toBe('<redacted>'); expect(replayBody.webhookUrl).toBe('<redacted>'); expect(replayBody.conditions.webhookUrl).toBe('user-condition-value');
    expect((await pool.query('SELECT count(*)::int n FROM automations WHERE project_id=$1', ['prj_idem_auto'])).rows[0].n).toBe(1);
    expect((await pool.query('SELECT body FROM api_idempotency WHERE request_id=$1', ['create-automation-once'])).rows[0].body).not.toContain(firstBody.webhookToken);
  });
  it('CAPY-453: mints flt_ bearer keys only from an app session, honours expiry and revoke, has no rotate verb', async () => {
    const { key, token } = await mint({ name: 'ci', expiresAt: new Date(Date.now() + 86400_000).toISOString() });
    expect(token).toMatch(/^flt_[A-Za-z0-9_-]{40,}$/);
    expect((await call('/api/v1/principal', { bearer: token })).status).toBe(200);
    const byKey = await call('/api/v1/api-keys', { method: 'POST', bearer: token, json: { name: 'nested' } });
    expect(byKey.status).toBe(403);
    expect(await byKey.json()).toMatchObject({ code: 'flotilla/Forbidden' });
    expect((await call(`/api/v1/api-keys/${key.id}/rotate`, { method: 'POST', session: true, json: {} })).status).toBe(404);
    const listed = JSON.stringify(await (await call('/api/v1/api-keys', { session: true })).json());
    expect(listed).not.toContain(token);
    expect(listed).not.toContain('Hash');
    const expired = await mint({ name: 'old' });
    await pool.query(`UPDATE api_keys SET expires_at=now() - interval '1 second' WHERE id=$1`, [expired.key.id]);
    expect((await call('/api/v1/principal', { bearer: expired.token })).status).toBe(401);
    expect((await call(`/api/v1/api-keys/${key.id}`, { method: 'DELETE', session: true })).status).toBe(200);
    expect((await call('/api/v1/principal', { bearer: token })).status).toBe(401);
    await mint({ name: 'idem-mint', requestId: 'mint-1' });
    expect((await pool.query(`SELECT count(*)::int n FROM api_idempotency WHERE body LIKE '%flt_%'`)).rows[0].n).toBe(0);
    expect((await call('/api/v1/api-keys', { method: 'POST', session: true, json: { name: 'past', expiresAt: '2000-01-01T00:00:00Z' } })).status).toBe(400);
  });

  it('CAPY-454: keys act as a human or service principal with authorId attribution', async () => {
    const human = await mint({ name: 'me' });
    expect(await (await call('/api/v1/principal', { bearer: human.token })).json()).toMatchObject({ kind: 'user', userId: humanId, authorId: humanId, via: 'api-key', keyId: human.key.id });
    const svc = await mint({ name: 'bot', serviceUser: { name: 'deploy-bot' } });
    expect(svc.key.userId).not.toBe(humanId);
    expect(await (await call('/api/v1/principal', { bearer: svc.token })).json()).toMatchObject({ kind: 'service', userId: svc.key.userId, authorId: humanId, via: 'api-key' });
    const project = await call('/api/v1/projects', { method: 'POST', bearer: svc.token, json: { name: 'svc-proj', repo: { owner: 'o', name: 'r' } } });
    expect(project.status).toBe(201);
    expect(await project.json()).toMatchObject({ ownerId: svc.key.userId });
    const replacement = await mint({ name: 'bot-2', serviceUser: { id: svc.key.userId } });
    expect(replacement.key.userId).toBe(svc.key.userId);
    expect((await call('/api/v1/api-keys', { method: 'POST', session: true, json: { name: 'x', serviceUser: { id: humanId } } })).status).toBe(404);
  });

  it('CAPY-455: replays a create with the same requestId instead of creating twice', async () => {
    const { token } = await mint();
    const body = { name: 'idem', repo: { owner: 'o', name: 'r' }, requestId: 'req-idem-1' };
    const first = await call('/api/v1/projects', { method: 'POST', bearer: token, json: body });
    const second = await call('/api/v1/projects', { method: 'POST', bearer: token, json: body });
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    expect(second.headers.get('idempotent-replayed')).toBe('true');
    expect((await second.json() as { id: string }).id).toBe((await first.json() as { id: string }).id);
    expect((await pool.query(`SELECT count(*)::int n FROM projects WHERE name='idem'`)).rows[0].n).toBe(1);
    const stored = (await pool.query(`SELECT fingerprint FROM api_idempotency WHERE request_id='req-idem-1'`)).rows[0];
    expect(stored.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.fingerprint).not.toBe(createHash('sha256').update(canonical(body)).digest('hex'));
    const { idempotencyFingerprint } = await import('./http.js');
    expect(idempotencyFingerprint(humanId, body)).toBe(stored.fingerprint);
    expect(idempotencyFingerprint('usr_other', body)).not.toBe(stored.fingerprint);
    const reordered = await call('/api/v1/projects', { method: 'POST', bearer: token, json: { requestId: body.requestId, repo: { name: 'r', owner: 'o' }, name: body.name } });
    expect(reordered.headers.get('idempotent-replayed')).toBe('true');
    const changed = await call('/api/v1/projects', { method: 'POST', bearer: token, json: { ...body, name: 'idem-other' } });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ code: 'flotilla/Conflict' });
    const reused = await call('/api/v1/files', { method: 'POST', bearer: token, json: { name: 'a', contentType: 'text/plain', size: 1, requestId: 'req-idem-1' } });
    expect(reused.status).toBe(409);
    expect(await reused.json()).toMatchObject({ code: 'flotilla/Conflict' });
    const legacyBody = { name: 'legacy', repo: { owner: 'o', name: 'r' }, requestId: 'legacy-replay' };
    await pool.query('INSERT INTO api_idempotency (principal_id,request_id,method,path,fingerprint,status,body,content_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [humanId, 'legacy-replay', 'POST', '/api/v1/projects', createHash('sha256').update(canonical(legacyBody)).digest('hex'), 201, '{"id":"legacy"}', 'application/json']);
    const legacy = await call('/api/v1/projects', { method: 'POST', bearer: token, json: legacyBody });
    expect(legacy.status).toBe(201);
    expect(legacy.headers.get('idempotent-replayed')).toBe('true');
    expect(await legacy.json()).toEqual({ id: 'legacy' });
  });

  it('CAPY-456: cursor-paginates unbounded lists as {items, cursor}; bounded lists return {items}', async () => {
    const { token } = await mint({ name: 'pager', serviceUser: { name: 'pager' } });
    for (const name of ['f1', 'f2', 'f3']) await call('/api/v1/files', { method: 'POST', bearer: token, json: { name, contentType: 'text/plain', size: 1 } });
    const p1 = await (await call('/api/v1/files?limit=2', { bearer: token })).json() as { items: { name: string }[]; cursor: string | null };
    expect(p1.items.map((f) => f.name)).toEqual(['f3', 'f2']);
    expect(p1.cursor).toEqual(expect.any(String));
    const p2 = await (await call(`/api/v1/files?limit=2&cursor=${p1.cursor}`, { bearer: token })).json() as typeof p1;
    expect(p2).toEqual({ items: [expect.objectContaining({ name: 'f1' })], cursor: null });
    expect((await call('/api/v1/files?cursor=garbage', { bearer: token })).status).toBe(400);
    const keys = await (await call('/api/v1/api-keys', { session: true })).json() as Record<string, unknown>;
    expect(Object.keys(keys)).toEqual(['items']);
  });

  it('CAPY-457: SSE public frames carry type, resume id and retry 2000', async () => {
    const threadId = 'thr_sse1';
    await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ($1,'FLO-SSE1','thread',$2,'t','idle','{}','{}','{}')`, [threadId, humanId]);
    const { EventStore } = await import('../events/store.js');
    const store = new EventStore(url);
    const kinds = ['thread.status', 'run.started', 'user.message', 'agent.tool_call', 'agent.message', 'cost.entry'] as const;
    for (const kind of kinds) await store.appendEvents(threadId as never, [{ threadId: threadId as never, runId: null, kind, source: 'kernel', trust: 'trusted', payload: { kind } }]);
    const { token } = await mint();
    const res = await call(`/api/v1/threads/${threadId}/stream?frames=public`, { bearer: token, headers: { 'last-event-id': '1' } });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader(); let text = '';
    while ((text.match(/\n\n/g) ?? []).length < 5) text += new TextDecoder().decode((await reader.read()).value);
    await reader.cancel(); await store.close();
    expect(text.startsWith('retry: 2000\n')).toBe(true);
    expect([...text.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]))).toEqual([2, 3, 4, 5, 6]);
    expect([...text.matchAll(/^event: (\w+)$/gm)].map((m) => m[1])).toEqual(['run', 'turn', 'tool_call', 'assistant', 'transcript']);
    expect(text).toContain('"type":"tool_call"');
    platform.apiPlatformStore(url).keyRecheckMs = 50;
    try {
      const live = await mint({ name: 'stream' });
      const open = await call(`/api/v1/threads/${threadId}/stream`, { bearer: live.token });
      await call(`/api/v1/api-keys/${live.key.id}`, { method: 'DELETE', session: true });
      const r = open.body!.getReader();
      let ended = false;
      for (let i = 0; i < 20 && !ended; i++) ended = (await r.read().catch(() => ({ done: true }))).done;
      expect(ended).toBe(true);
    } finally { platform.apiPlatformStore(url).keyRecheckMs = 30_000; }
  });

  it('CAPY-458: errors are typed flotilla/* codes', async () => {
    const { apiErrorStatus } = await import('./types.js');
    expect(apiErrorStatus).toMatchObject({ Unauthorized: 401, Forbidden: 403, RateLimited: 429, PaidFeatureUnavailable: 402, CrewRefused: 409, BillingAuthorityUnavailable: 503 });
    const anon = await call('/api/v1/projects');
    expect(anon.status).toBe(401); expect(await anon.json()).toMatchObject({ code: 'flotilla/Unauthorized' });
    const noCsrf = await call('/api/v1/projects', { method: 'POST', headers: { cookie }, json: {} });
    expect(noCsrf.status).toBe(403); expect(await noCsrf.json()).toMatchObject({ code: 'flotilla/Forbidden' });
    expect(await (await call('/api/v1/principal', { bearer: 'flt_nope' })).json()).toMatchObject({ code: 'flotilla/Unauthorized' });
    const missing = await call('/api/v1/files/fil_missing', { session: true });
    expect(missing.status).toBe(404); expect(await missing.json()).toMatchObject({ code: 'flotilla/NotFound' });
    const { token } = await mint();
    platform.apiPlatformStore(url).rateLimitPerMin = 2;
    try {
      await call('/api/v1/principal', { bearer: token }); await call('/api/v1/principal', { bearer: token });
      const limited = await call('/api/v1/principal', { bearer: token });
      expect(limited.status).toBe(429); expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
      expect(await limited.json()).toMatchObject({ code: 'flotilla/RateLimited' });
    } finally { platform.apiPlatformStore(url).rateLimitPerMin = 600; }
  });

  it('CAPY-459/460: legacy /tasks is still served and every documented flow route exists', async () => {
    const legacy = await call('/api/v1/tasks/thr_x/messages?after=2');
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get('location')).toBe('/api/v1/threads/thr_x/messages?after=2');
    expect(legacy.headers.get('deprecation')).toBe('true');
    const doc = await readFile(new URL('./API.md', import.meta.url), 'utf8');
    expect(doc).toContain('## Migrating from /tasks');
    const documented = [...doc.matchAll(/^(GET|POST|PUT|PATCH|DELETE) (\/\S+)$/gm)].map((m) => [m[1], m[2]] as const);
    expect(documented.length).toBeGreaterThanOrEqual(10);
    const routes = app.routes.map((r) => [r.method, r.path] as const);
    for (const [method, path] of documented) expect(routes.some(([m, p]) => m === method && p === path), `${method} ${path}`).toBe(true);
  });

  it('CAPY-461: POST /webhooks/automations/{secret} records a delivery for the matching automation', async () => {
    const secret = 'whsec_fixture_secret_value_123';
    await pool.query('INSERT INTO automation_webhooks (secret_hash, automation_id, owner_id) VALUES ($1,$2,$3)', [createHash('sha256').update(secret).digest('hex'), 'aut_fixture', humanId]);
    const res = await call(`/api/v1/webhooks/automations/${secret}`, { method: 'POST', json: { hello: 'world' } });
    expect(res.status).toBe(202);
    const { deliveryId } = await res.json() as { deliveryId: string };
    expect((await pool.query('SELECT automation_id, payload FROM automation_webhook_deliveries WHERE id=$1', [deliveryId])).rows[0]).toEqual({ automation_id: 'aut_fixture', payload: { hello: 'world' } });
    expect((await call('/api/v1/webhooks/automations/wrong', { method: 'POST', json: {} })).status).toBe(404);
    expect((await call(`/api/v1/webhooks/automations/${secret}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '\uFEFF{"bom":true}' })).status).toBe(202);
    const chunked = new ReadableStream({ start(ctl) { for (let i = 0; i < 5; i++) ctl.enqueue(new Uint8Array(64 * 1024)); ctl.close(); } });
    expect((await app.request(`/api/v1/webhooks/automations/${secret}`, { method: 'POST', body: chunked, duplex: 'half' } as RequestInit)).status).toBe(413);
  });

  it('CAPY-462: uploads via a presigned URL, then attaches by fileId', async () => {
    const { token } = await mint();
    const grantRes = await call('/api/v1/files', { method: 'POST', bearer: token, json: { name: 'note.txt', contentType: 'text/plain', size: 5 } });
    expect(grantRes.status).toBe(201);
    const grant = await grantRes.json() as { fileId: string; uploadUrl: string; method: string; expiresAt: string };
    expect(grant.method).toBe('PUT');
    const upload = new URL(grant.uploadUrl);
    expect((await app.request(`${upload.pathname}?token=bad`, { method: 'PUT', body: 'hello' })).status).toBe(403);
    expect((await app.request(upload.pathname + upload.search, { method: 'PUT', body: 'toolong' })).status).toBe(400);
    expect(await platform.apiPlatformStore(url).attachFiles(humanId, [grant.fileId]).catch((e: Error) => e.message)).toMatch(/not uploaded/);
    expect((await app.request(upload.pathname + upload.search, { method: 'PUT', body: 'hello' })).status).toBe(200);
    expect((await app.request(upload.pathname + upload.search, { method: 'PUT', body: 'hello' })).status).toBe(409);
    expect(await (await call(`/api/v1/files/${grant.fileId}`, { bearer: token })).json()).toMatchObject({ id: grant.fileId, status: 'uploaded', size: 5 });
    const ownerId = (await pool.query('SELECT owner_id FROM api_files WHERE id=$1', [grant.fileId])).rows[0].owner_id;
    expect(await platform.apiPlatformStore(url).attachFiles(ownerId, [grant.fileId])).toEqual([{ fileId: grant.fileId, name: 'note.txt', contentType: 'text/plain', size: 5 }]);
    await expect(platform.apiPlatformStore(url).attachFiles('usr_other', [grant.fileId])).rejects.toThrow(/not found/);
  });
});
