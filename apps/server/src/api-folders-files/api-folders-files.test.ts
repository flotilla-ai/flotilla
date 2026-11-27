import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { apiPlatformStore } from '../api-platform/store.js';
import { threadLifecycle } from '../thread-lifecycle/store.js';
import { createApiFoldersFilesRoute } from '../routes/api-folders-files.route.js';
import { ApiFoldersFilesStore } from './index.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono; let url = '';
async function call(method: string, path: string, body?: unknown) { const r = await app.request(`http://x/api/v1${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) as any, response: r }; }
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_af','af@example.invalid','member'),('usr_af2','af2@example.invalid','admin')`);
  await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_af','FLO-AF','thread','usr_af','api folders','idle','{}','{}','{}')`);
  const files = apiPlatformStore(url); const store = new ApiFoldersFilesStore(pool, threadLifecycle(url), files);
  app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.use('*', async (c, next) => { c.set('userId' as never, 'usr_af' as never); await next(); });
  app.route('/api/v1', createApiFoldersFilesRoute(() => store).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 3; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });
it('CAPY-562..567/605..607/638: public folders, pins, upload/list/download and org users', async () => {
  expect((await call('PUT', '/threads/thr_af/folder', { folder: 'Work' })).json.folder).toBe('Work');
  expect((await call('GET', '/folders')).json.items).toEqual([{ name: 'Work', threadCount: 1 }]);
  expect((await call('GET', '/folders/Work/threads')).json.items.map((x: any) => x.id)).toEqual(['thr_af']);
  expect((await call('POST', '/threads/thr_af/pin')).json.pinned).toBe(true);
  expect((await call('DELETE', '/threads/thr_af/pin')).json.pinned).toBe(false);
  expect((await call('DELETE', '/threads/thr_af/folder')).json.folder).toBeNull();
  expect((await call('GET', '/folders')).json.items).toEqual([]);
  const files = apiPlatformStore(url); const grant = await files.createUpload('usr_af', { name: 'hello.txt', contentType: 'text/plain', size: 5 }, 'http://x');
  const data = Buffer.from('hello'); await files.completeUpload(grant.fileId, new URL(grant.uploadUrl).searchParams.get('token')!, async () => data);
  expect((await files.listFiles('usr_af')).items[0]).toMatchObject({ id: grant.fileId, name: 'hello.txt', status: 'uploaded' });
  const dl = await app.request(`http://x/api/v1/files/${grant.fileId}/download`); expect(dl.status).toBe(200); expect(dl.headers.get('content-type')).toBe('text/plain'); expect(Buffer.from(await dl.arrayBuffer()).toString()).toBe('hello');
  expect((await call('GET', '/users')).json.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'usr_af', email: 'af@example.invalid' }), expect.objectContaining({ id: 'usr_af2', role: 'admin' })]));
}, 30_000);
