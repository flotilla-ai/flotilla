import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createPluginLifecycleRoute } from '../routes/plugin-lifecycle.route.js';
import { McpStore } from '../mcp/store.js';
import { PluginLifecycleStore } from './index.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono; let url = ''; let manifestVersion = '1.0.0';
async function call(method: string, path: string, body?: unknown) { const r = await app.request(`http://x/api/v1${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) as any }; }
const plugin = (version: string, keys = ['API_KEY'], scopes = ['read']) => ({ specVersion: '1.1.0', key: 'github-tools', name: 'GitHub tools', version, mcpServers: [{ key: 'github', command: ['node','github-mcp.js'], keys, scopes }] });
beforeAll(async () => {
  process.env.FLOTILLA_MASTER_KEY ||= Buffer.from('test-master-key-for-plugins').toString('base64');
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  let ready = false; for (let i = 0; i < 80 && !ready; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); await new Promise((r) => setTimeout(r, 300)); const c2 = new pg.Client({ connectionString: url }); await c2.connect(); await c2.query('SELECT 1'); await c2.end(); ready = true } catch { await new Promise((r) => setTimeout(r, 250)) } }
  if (!ready) throw new Error('postgres fixture did not become ready');
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_pl','pl@example.invalid','admin'),('usr_pm','pm@example.invalid','member')`);
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_hidden','usr_pm','Hidden project','{"fullName":"acme/hidden","baseBranch":"main"}','trusted','{}'),('prj_pl','usr_pl','Plugin project','{"fullName":"acme/plugins","baseBranch":"main"}','trusted','{}')`);
  await pool.query(`INSERT INTO threads (id,code,role,project_id,owner_id,title,status,engine,budget,spent,visibility) VALUES ('thr_plugin','THRPL','thread','prj_pl','usr_pl','Plugin thread','idle','{}','{}','{}','private')`);
  const fetcher = (async (url: string) => ({ ok: true, json: async () => url.endsWith('plugin.json') ? { ...plugin(manifestVersion), mcpServers: undefined } : { mcpServers: plugin(manifestVersion, manifestVersion === '2.0.0' ? ['API_KEY','ORG_KEY'] : ['API_KEY'], manifestVersion === '2.0.0' ? ['read','write'] : ['read']).mcpServers } })) as any;
  const store = new PluginLifecycleStore(pool, fetcher); app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.use('*', async (c, next) => { c.set('userId' as never, 'usr_pl' as never); await next(); });
  app.route('/api/v1', createPluginLifecycleRoute(() => store).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 3; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });
it('CAPY-304/306/313..316: plugin install, scoping, per-member connect, sync approval and rollback', async () => {
  expect((await call('POST', '/mcp/plugins', { repo: 'acme/plugin', projectId: 'prj_hidden' })).status).toBe(404);
  const org = await call('POST', '/mcp/plugins', { scope: 'organization', repo: 'acme/plugin', path: 'servers/github', ref: 'main', connectionMode: 'each-member', privateThreadsOnly: true, keys: { API_KEY: 'secret-value' }, autoUpdate: true });
  expect(org.status).toBe(201); expect(org.json).toMatchObject({ scope: 'organization', key: 'github-tools', connectionMode: 'each-member', privateThreadsOnly: true, keyNames: ['API_KEY'] }); expect(JSON.stringify(org.json)).not.toContain('secret-value');
  const personal = await call('POST', '/mcp/plugins', { scope: 'user', repo: 'acme/plugin', path: 'servers/github', projectId: 'prj_pl', connectionMode: 'each-member' });
  expect(personal.status).toBe(201); expect(personal.json.projectId).toBe('prj_pl');
  let resolved = (await call('GET', '/mcp/plugins/resolve/prj_pl')).json; expect(resolved.items).toHaveLength(1); expect(resolved.items[0]).toMatchObject({ scope: 'user', requiresConnection: true });
  expect((await call('POST', `/mcp/plugins/${resolved.items[0].id}/servers/github/connect`, { keys: { API_KEY: 'member-secret' } })).json).toEqual({ connected: true });
  resolved = (await call('GET', '/mcp/plugins/resolve/prj_pl')).json; expect(resolved.items[0].requiresConnection).toBe(false); expect(JSON.stringify(resolved)).not.toContain('member-secret');
  const prepared = await new McpStore(url).prepare('thr_plugin', {}); expect(prepared?.config.mcpServers['github-tools-github']).toMatchObject({ type: 'stdio', command: 'node', env: { API_KEY: 'member-secret' } });
  expect((await call('POST', `/mcp/plugins/${personal.json.id}/servers/github/connect`, { keys: { API_KEY: 'replacement-secret' } })).status).toBe(200);
  const reprepared = await new McpStore(url).prepare('thr_plugin', {}); expect(reprepared?.config.mcpServers['github-tools-github']).toMatchObject({ env: { API_KEY: 'replacement-secret' } });
  manifestVersion = '2.0.0';
  const synced = await call('POST', `/mcp/plugins/${personal.json.id}/sync`); expect(synced.json).toMatchObject({ updateState: 'needs-you', version: '1.0.0' });
  expect((await call('POST', `/mcp/plugins/${personal.json.id}/approve-update`)).json).toMatchObject({ updateState: 'current', version: '2.0.0' });
  expect((await call('POST', `/mcp/plugins/${personal.json.id}/rollback`)).json.version).toBe('1.0.0');
  expect((await call('POST', `/mcp/plugins/${personal.json.id}/rollback`)).status).toBe(400);
}, 30_000);
