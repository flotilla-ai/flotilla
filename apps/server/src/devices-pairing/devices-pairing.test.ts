import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createDevicesPairingPublicRoute } from '../routes/devices-pairing-public.route.js';
import { createDevicesPairingRoute } from '../routes/devices-pairing.route.js';
import { DevicesPairingStore, scanGitFolders } from './index.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let app: Hono; let store: DevicesPairingStore;
async function call(path: string, init: RequestInit & { json?: unknown; token?: string } = {}) {
  const headers = new Headers(init.headers); headers.set('x-user', 'usr_dev'); if (init.json !== undefined) headers.set('content-type', 'application/json'); if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  const response = await app.request(`http://local${path}`, { ...init, headers, body: init.json === undefined ? undefined : JSON.stringify(init.json) });
  return { status: response.status, body: await response.json().catch(() => null) as any };
}
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_dev','dev@x','admin')`);
  store = new DevicesPairingStore(url); app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.use('/api/v1/devices/*', async (c, next) => { c.set('userId' as never, 'usr_dev' as never); await next(); });
  app.use('/api/v1/devices', async (c, next) => { c.set('userId' as never, 'usr_dev' as never); await next(); });
  app.route('/api/v1/devices', createDevicesPairingRoute(store).app); app.route('/api/v1/device-pairing', createDevicesPairingPublicRoute(store).app);
}, 30_000);
afterAll(async () => { await store?.close(); await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

it('CAPY-228/229/230/231: pairing trust, machine picker metadata, workspace policy and folder scan', async () => {
  const made = await call('/api/v1/devices/pairing-codes', { method: 'POST', json: {} });
  expect(made.status).toBe(201); expect(made.body.code).toBeTruthy(); expect(made.body.code.length).toBeGreaterThan(10);
  expect((await call('/api/v1/device-pairing/pair', { method: 'POST', json: { code: 'wrong', name: 'Mac', platform: 'macos' } })).status).toBe(403);
  const claimed = await call('/api/v1/device-pairing/pair', { method: 'POST', json: { code: made.body.code, name: 'Mac mini', platform: 'macos' } });
  expect(claimed.status).toBe(201); expect(claimed.body.device).toMatchObject({ trust: 'pending', machineMetering: 'none', workspacePolicy: { kind: 'new-worktree' } });
  const secret = (await pool.query('SELECT token_hash FROM paired_devices WHERE id=$1', [claimed.body.device.id])).rows[0].token_hash;
  expect(secret).not.toBe(claimed.body.token);
  expect((await call('/api/v1/device-pairing/pair', { method: 'POST', json: { code: made.body.code, name: 'Again', platform: 'linux' } })).status).toBe(403);
  expect((await call('/api/v1/devices/machine-picker')).body.items).toHaveLength(1);
  expect((await call(`/api/v1/devices/${claimed.body.device.id}/approve`, { method: 'POST', json: {} })).body.trust).toBe('trusted');
  expect((await call('/api/v1/device-pairing/heartbeat', { method: 'POST', token: claimed.body.token, json: { status: 'online' } })).body.status).toBe('online');

  const picker = await call('/api/v1/devices/machine-picker');
  expect(picker.body.items).toEqual(expect.arrayContaining([{ kind: 'cloud', id: 'cloud', label: 'Flotilla cloud' }, expect.objectContaining({ kind: 'device', id: claimed.body.device.id, machineMetering: 'none', workspacePolicy: { kind: 'new-worktree' } })]));
  const patched = await call(`/api/v1/devices/${claimed.body.device.id}`, { method: 'PATCH', json: { workspacePolicy: { kind: 'existing-worktree', path: '/srv/worktree' }, settings: { keepAwakeWhileRunning: true } } });
  expect(patched.status).toBe(200); expect(patched.body.workspacePolicy).toEqual({ kind: 'existing-worktree', path: '/srv/worktree' }); expect(patched.body.settings.keepAwakeWhileRunning).toBe(true);
  const renamed = await call(`/api/v1/devices/${claimed.body.device.id}`, { method: 'PATCH', json: { name: 'Renamed' } });
  expect(renamed.body.settings.keepAwakeWhileRunning).toBe(true); expect(renamed.body.workspacePolicy.kind).toBe('existing-worktree');
  expect((await call(`/api/v1/devices/${claimed.body.device.id}`, { method: 'PATCH', json: { workspacePolicy: { kind: 'current-checkout' } } })).status).toBe(400);

  const root = await mkdtemp(join(tmpdir(), 'flt-scan-'));
  await mkdir(join(root, 'one', '.git'), { recursive: true }); await writeFile(join(root, 'one', '.git', 'config'), '[remote "origin"]\n url = https://github.com/acme/one.git\n');
  await mkdir(join(root, 'nested', 'two', '.git'), { recursive: true }); await writeFile(join(root, 'nested', 'two', '.git', 'config'), '[remote "origin"]\n\turl\t=\tgit@github.com:acme/two.git\n');
  await mkdir(join(root, 'three', '.git'), { recursive: true }); await writeFile(join(root, 'three', '.git', 'config'), '[remote "origin"]\n url = ssh://git@github.com/acme/three.git\n');
  const scanned = await scanGitFolders(root);
  expect(scanned.map((x) => x.remote).sort()).toEqual(['git@github.com:acme/two.git', 'https://github.com/acme/one.git', 'ssh://git@github.com/acme/three.git']);
  const reported = await call('/api/v1/device-pairing/folders', { method: 'POST', token: claimed.body.token, json: { folders: scanned } });
  expect(reported.status).toBe(200); expect(reported.body.projectFolders).toHaveLength(3);
  expect((await call('/api/v1/device-pairing/folders', { method: 'POST', token: claimed.body.token, json: {} })).status).toBe(400);
  expect((await call('/api/v1/devices')).body.items.find((x: any) => x.id === claimed.body.device.id).projectFolders).toHaveLength(3);
  expect((await call(`/api/v1/devices/${claimed.body.device.id}/revoke`, { method: 'POST', json: {} })).body.trust).toBe('revoked');
  expect((await call('/api/v1/device-pairing/heartbeat', { method: 'POST', token: claimed.body.token, json: { status: 'online' } })).status).toBe(403);
  expect(Date.parse(claimed.body.device.waitUntil) - Date.parse(claimed.body.device.createdAt)).toBe(24 * 60 * 60_000);
}, 30_000);
