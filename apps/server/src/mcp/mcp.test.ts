import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { promisify } from 'node:util';
import pg from 'pg';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdapterEvent, AgentAdapter, StartInput } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import { parseImport, toolName } from './types.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let app: Hono; let cookie = ''; let csrf = ''; let owner = ''; let url = ''; let fixture: Server; let base = '';
const grants: string[] = [];
const rpc = (id: unknown, result: unknown) => JSON.stringify({ jsonrpc: '2.0', id, result });
beforeAll(async () => {
  fixture = createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      if (req.url === '/token') {
        const f = new URLSearchParams(body); grants.push(`${f.get('grant_type')}:${f.get('client_id')}:${f.get('client_secret')}:${f.get('code_verifier') ? 'pkce' : ''}`);
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify(f.get('grant_type') === 'authorization_code' ? { access_token: 'access-token-aaaa', refresh_token: 'refresh-token-bbbb', expires_in: 1 } : { access_token: 'access-token-cccc', expires_in: 3600 }));
      }
      if (req.url === '/forbidden') { res.writeHead(403); return res.end(`key ${req.headers['x-api-key']} and ${req.headers['x-short']} lack workspace access`); }
      if (req.url === '/oauth-mcp' && req.headers.authorization !== 'Bearer access-token-cccc') { res.writeHead(401); return res.end('expired token'); }
      const msg = JSON.parse(body || '{}');
      if (msg.method === 'initialize') { res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'sess-1' }); return res.end(rpc(msg.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } })); }
      if (!msg.id) { res.writeHead(202); return res.end(); }
      if (req.headers['mcp-session-id'] !== 'sess-1') { res.writeHead(400); return res.end('no session'); }
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(`event: message\ndata: ${rpc(msg.id, { tools: [{ name: 'search' }, { name: 'fetch' }] })}\n\n`);
    });
  });
  await new Promise<void>((r) => fixture.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const p = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  url = `postgres://postgres@127.0.0.1:${p}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); process.env.DATABASE_URL = url; process.env.FLOTILLA_PUBLIC_URL = 'https://flotilla.example'; process.env.FLOTILLA_MASTER_KEY ??= randomBytes(32).toString('base64url');
  pool = new pg.Pool({ connectionString: url });
  const { authStore } = await import('../auth/store.js'); const auth = authStore(url);
  owner = (await auth.setup('owner@x', 'pw', await auth.getSetupToken()))!.userId;
  const session = (await auth.login('owner@x', 'pw'))!; cookie = `flotilla_session=${session.id}`; csrf = session.csrfToken;
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_m',$1,'m','{}','untrusted','{}')`, [owner]);
  app = await (await import('../loader.js')).createApp();
}, 60_000);
afterAll(async () => { await pool?.end(); fixture?.close(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

async function call(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers); headers.set('cookie', cookie); headers.set('x-flotilla-csrf', csrf);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  const r = await app.request(`http://local/api/v1${path}`, { ...init, headers, body: init.json === undefined ? init.body : JSON.stringify(init.json) });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}
const post = (path: string, json: unknown = {}) => call(path, { method: 'POST', json });
async function thread(projectId: string | null = 'prj_m', adapter = 'capture'): Promise<string> {
  const id = `thr_${Math.random().toString(16).slice(2, 10)}`;
  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$1,$2,'thread',$3,'t','idle',$4,'{"maxUsd":null}','{"usd":0}')`, [id, projectId, owner, JSON.stringify({ adapter })]);
  return id;
}

describe('MCP registry', () => {
  it('CAPY-302/303: remote and STDIO servers reach the adapter as native MCP config keyed by tool prefix; capability-gated', async () => {
    expect((await post('/mcp/servers', { key: 'docs', transport: 'http', url: `${base}/mcp` })).status).toBe(201);
    expect((await post('/mcp/servers', { key: 'files', transport: 'stdio', command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/workspace'], env: { ROOT_TOKEN: 'stdio-secret-123' }, projectId: 'prj_m' })).status).toBe(201);
    expect((await post('/mcp/servers', { key: 'docs', transport: 'http', url: `${base}/other` })).status).toBe(409);
    expect((await post('/mcp/servers', { key: 'Bad_Key', transport: 'http', url: base })).status).toBe(400);
    const listed = (await call('/mcp/servers')).json.items;
    expect(listed.map((s: any) => [s.key, s.toolPrefix])).toEqual([['docs', 'mcp__docs__'], ['files', 'mcp__files__']]);
    expect(JSON.stringify(listed)).not.toContain('stdio-secret-123');
    expect(toolName('docs', 'search')).not.toBe(toolName('files', 'search'));
    const seen: StartInput[] = []; const copied: { dir: string; tar: Buffer }[] = [];
    const adapter = (mcp: boolean): AgentAdapter => ({ manifest: { id: 'capture', capabilities: { mcp } } as never, probe: async () => ({ installed: true, version: '1', authed: 'yes' }), async *start(input: StartInput): AsyncIterable<AdapterEvent> { seen.push(input); yield { t: 'done', stopReason: 'end_turn' }; }, resume: (i) => adapter(mcp).start(i), cancel: async () => undefined });
    const driver = { startThreadContainer: async () => ({ containerId: 'c1' }), transport: () => ({}), copyIn: async (_: string, dir: string, tar: Buffer) => { copied.push({ dir, tar }); }, stop: async () => undefined };
    const runner = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters: new Map([['capture', adapter(true)], ['plain', adapter(false)]]), mcp: (await import('./store.js')).mcpStore(url) });
    const t1 = await thread(); await runner.message(t1, 'go', 'queue', owner); await runner.drain();
    expect(seen[0].mcpConfigPath).toBe('/run/flotilla/mcp.json');
    const tar = copied.find((c) => c.tar.subarray(0, 100).toString().startsWith('flotilla/mcp.json'))!.tar;
    expect(tar.subarray(100, 107).toString()).toBe('0000600');
    const cfg = JSON.parse(tar.subarray(512, 512 + parseInt(tar.subarray(124, 135).toString(), 8)).toString());
    expect(cfg.mcpServers.docs).toEqual({ type: 'http', url: `${base}/mcp`, headers: {} });
    expect(cfg.mcpServers.files).toEqual({ type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'], env: { ROOT_TOKEN: 'stdio-secret-123' } });
    const t2 = await thread(null); await runner.message(t2, 'go', 'queue', owner); await runner.drain();
    expect(Object.keys(JSON.parse(copied.at(-1)!.tar.subarray(512).toString().replace(/\0+$/s, '').replace(/\0[\s\S]*$/, '')).mcpServers)).toEqual(['docs']);
    const t3 = await thread('prj_m', 'plain'); await runner.message(t3, 'go', 'queue', owner); await runner.drain();
    expect(seen.at(-1)!.mcpConfigPath).toBeNull();
  });

  it('CAPY-305: API-key headers are encrypted, never returned, and ${VAR} headers resolve from thread env vars', async () => {
    const r = await post('/mcp/servers', { key: 'linear', transport: 'http', url: `${base}/mcp`, auth: { kind: 'headers', headers: [{ name: 'X-Api-Key', value: 'lin-key-abcdef123' }, { name: 'Authorization', value: 'Bearer ${LINEAR_TOKEN}' }] } });
    expect(r.json.auth).toEqual({ kind: 'headers', headers: [{ name: 'X-Api-Key', configured: true, variables: [] }, { name: 'Authorization', configured: true, variables: ['LINEAR_TOKEN'] }] });
    const raw = (await pool.query(`SELECT * FROM mcp_servers WHERE key='linear'`)).rows[0];
    expect(JSON.stringify(raw) + raw.sealed.toString('latin1')).not.toContain('lin-key-abcdef123');
    const t = await thread();
    const prepared = await (await import('./store.js')).mcpStore(url).prepare(t, { LINEAR_TOKEN: 'thread-token-xyz1' });
    expect(prepared!.config.mcpServers.linear).toMatchObject({ headers: { 'X-Api-Key': 'lin-key-abcdef123', Authorization: 'Bearer thread-token-xyz1' } });
    expect(Object.values(prepared!.secrets)).toContain('lin-key-abcdef123');
    expect((await post('/mcp/servers', { key: 'odd', transport: 'stdio', command: ['x'], auth: { kind: 'oauth', authorizeUrl: base, tokenUrl: base, clientId: 'c' } })).status).toBe(400);
  });

  it('CAPY-307/305: bring-your-own OAuth client with documented redirect URI, PKCE, sealed tokens and auto refresh', async () => {
    const s = (await post('/mcp/servers', { key: 'oauthy', transport: 'http', url: `${base}/oauth-mcp`, auth: { kind: 'oauth', authorizeUrl: `${base}/authorize`, tokenUrl: `${base}/token`, clientId: 'my-client', clientSecret: 'client-secret-999', scopes: ['read'] } })).json;
    expect(s.auth).toMatchObject({ redirectUri: 'https://flotilla.example/api/v1/mcp/oauth/callback', clientSecretConfigured: true, connection: 'none' });
    expect(s.status).toBe('needs-auth');
    const flow = (await post(`/mcp/servers/${s.id}/oauth/start`)).json;
    const auth = new URL(flow.authorizeUrl);
    expect(Object.fromEntries(auth.searchParams)).toMatchObject({ client_id: 'my-client', redirect_uri: 'https://flotilla.example/api/v1/mcp/oauth/callback', response_type: 'code', code_challenge_method: 'S256', scope: 'read' });
    expect((await call(`/mcp/oauth/callback?state=${auth.searchParams.get('state')}&code=code-1`)).status).toBe(200);
    expect(grants.at(-1)).toBe('authorization_code:my-client:client-secret-999:pkce');
    const raw = (await pool.query(`SELECT * FROM mcp_servers WHERE id=$1`, [s.id])).rows[0];
    expect(JSON.stringify(raw) + raw.sealed.toString('latin1')).not.toContain('refresh-token-bbbb');
    await new Promise((r) => setTimeout(r, 1100));
    const test = (await post(`/mcp/servers/${s.id}/test`)).json;
    expect(grants.at(-1)).toBe('refresh_token:my-client:client-secret-999:');
    expect(test).toMatchObject({ ok: true, failingStep: null, tools: ['search', 'fetch'] });
    expect((await call(`/mcp/servers/${s.id}`)).json).toMatchObject({ status: 'ok', auth: { connection: 'connected' } });
  });

  it('CAPY-520: a sign-in shows Finish in your browser with Cancel; cancelled flows cannot complete', async () => {
    const s = (await post('/mcp/servers', { key: 'cancelme', transport: 'http', url: `${base}/oauth-mcp`, auth: { kind: 'oauth', authorizeUrl: `${base}/authorize`, tokenUrl: `${base}/token`, clientId: 'c2' } })).json;
    const flow = (await post(`/mcp/servers/${s.id}/oauth/start`)).json;
    expect(flow.message).toBe('Finish in your browser');
    expect((await call(`/mcp/servers/${s.id}`)).json).toMatchObject({ status: 'pending-browser', auth: { connection: 'pending', flowId: flow.flowId } });
    expect((await post(`/mcp/oauth/flows/${flow.flowId}/cancel`)).status).toBe(200);
    expect((await call(`/mcp/servers/${s.id}`)).json).toMatchObject({ status: 'needs-auth', auth: { connection: 'none', flowId: null } });
    expect((await call(`/mcp/oauth/callback?state=${new URL(flow.authorizeUrl).searchParams.get('state')}&code=code-1`)).status).toBe(404);
  });

  it('CAPY-309: imports Claude Code JSON, Codex TOML, a URL and a command line', async () => {
    const claude = parseImport(JSON.stringify({ mcpServers: { Sentry: { type: 'http', url: 'https://mcp.sentry.dev/mcp', headers: { Authorization: 'Bearer ${SENTRY}' } }, fs: { command: 'npx', args: ['-y', 'srv'], env: { A: 'b' } } } }));
    expect(claude.servers.map((s) => [s.key, s.transport, s.url ?? s.command])).toEqual([['sentry', 'http', 'https://mcp.sentry.dev/mcp'], ['fs', 'stdio', ['npx', '-y', 'srv']]]);
    const codex = parseImport(`[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp"]\n\n[mcp_servers.context7.env]\nAPI_KEY = "k"\n\n[mcp_servers.off]\ncommand = "x"\nenabled = false\n\n[mcp_servers.figma]\nurl = 'https://mcp.figma.com/mcp'\nbearer_token_env_var = "FIGMA_TOKEN"\n`);
    expect(codex.servers).toMatchObject([{ key: 'context7', transport: 'stdio', command: ['npx', '-y', '@upstash/context7-mcp'], env: { API_KEY: 'k' } }, { key: 'off', enabled: false }, { key: 'figma', transport: 'http', auth: { kind: 'headers', headers: [{ name: 'Authorization', value: 'Bearer ${FIGMA_TOKEN}' }] } }]);
    expect(parseImport('https://mcp.linear.app/mcp').servers[0]).toMatchObject({ key: 'linear', transport: 'http' });
    expect(parseImport(`GITHUB_DIR=/w npx -y @modelcontextprotocol/server-filesystem "/my dir"`).servers[0]).toMatchObject({ key: 'server-filesystem', command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/my dir'], env: { GITHUB_DIR: '/w' } });
    const saved = await post('/mcp/import', { text: 'https://mcp.notion.com/mcp', projectId: 'prj_m' });
    expect(saved.status).toBe(201); expect(saved.json).toMatchObject({ source: 'url', servers: [{ key: 'notion', projectId: 'prj_m', status: 'untested' }] });
  });

  it('CAPY-310/311: Test shows statuses and the failing step, a 403 checklist, and redacts configured secrets (>=8 chars, exact)', async () => {
    const ok = (await post('/mcp/servers', { key: 'okay', transport: 'http', url: `${base}/mcp` })).json;
    expect((await post(`/mcp/servers/${ok.id}/test`)).json).toMatchObject({ ok: true, tools: ['search', 'fetch'], steps: [{ name: 'config', ok: true }, { name: 'auth', ok: true }, { name: 'connect', ok: true }, { name: 'initialize', ok: true }, { name: 'tools', ok: true }] });
    const down = (await post('/mcp/servers', { key: 'down', transport: 'http', url: 'http://127.0.0.1:1/mcp' })).json;
    expect((await post(`/mcp/servers/${down.id}/test`)).json).toMatchObject({ ok: false, failingStep: 'connect' });
    const no = (await post('/mcp/servers', { key: 'forbid', transport: 'http', url: `${base}/forbidden`, auth: { kind: 'headers', headers: [{ name: 'X-Api-Key', value: 'sk-live-abcdefgh' }, { name: 'X-Short', value: 'abc1234' }] } })).json;
    const r = (await post(`/mcp/servers/${no.id}/test`)).json;
    expect(r).toMatchObject({ ok: false, failingStep: 'initialize', httpStatus: 403 });
    expect(r.checklist.length).toBeGreaterThan(2);
    const detail = r.steps.find((s: any) => s.name === 'initialize').detail;
    expect(detail).not.toContain('sk-live-abcdefgh'); expect(detail).toContain('[REDACTED:header:X-Api-Key]'); expect(detail).toContain('abc1234');
    expect((await call(`/mcp/servers/${no.id}`)).json.status).toBe('failing');
    const stdio = (await post('/mcp/servers', { key: 'local', transport: 'stdio', command: ['srv'] })).json;
    expect((await post(`/mcp/servers/${stdio.id}/test`)).json.steps.find((s: any) => s.name === 'connect')).toMatchObject({ ok: null });
    await call(`/mcp/servers/${ok.id}`, { method: 'PATCH', json: { enabled: false } });
    expect((await call(`/mcp/servers/${ok.id}`)).json.status).toBe('disabled');
  });

  it('CAPY-308/317/519: the agent proposes a missing server or a rename/enable/widen; one-click approval applies it', async () => {
    const t = await thread();
    expect((await post(`/threads/${t}/mcp/proposals`, { action: 'add', server: { key: 'gh', transport: 'http', url: `${base}/mcp`, auth: { kind: 'headers', headers: [{ name: 'X-Key', value: 'literal-secret-1' }] } } })).status).toBe(400);
    expect((await post(`/threads/${t}/mcp/proposals`, { action: 'add', server: { key: 'mix', transport: 'http', url: base, auth: { kind: 'headers', headers: [{ name: 'Authorization', value: 'Bearer sk-literal-1 ${X}' }] } } })).status).toBe(400);
    const add = (await post(`/threads/${t}/mcp/proposals`, { action: 'add', server: { key: 'sentry', transport: 'http', url: `${base}/mcp`, auth: { kind: 'headers', headers: [{ name: 'Authorization', value: 'Bearer ${SENTRY_TOKEN}' }] } } })).json;
    expect(add).toMatchObject({ kind: 'mcp', state: 'open', blocking: false, options: [{ id: 'approve', label: 'Approve' }, { id: 'decline', label: 'Decline' }], detail: { mcp: { action: 'add' } } });
    expect(add.question).toContain('sentry');
    expect((await pool.query(`SELECT kind FROM events WHERE thread_id=$1 AND kind='approval.requested'`, [t])).rows.length).toBe(1);
    expect((await post(`/approvals/${add.id}/answer`, { optionId: 'approve' })).status).toBe(200);
    const sentry = (await call('/mcp/servers')).json.items.find((s: any) => s.key === 'sentry');
    expect(sentry).toMatchObject({ projectId: 'prj_m', enabled: true });
    await call(`/mcp/servers/${sentry.id}`, { method: 'PATCH', json: { enabled: false } });
    for (const [p, expected] of [[{ action: 'rename', serverId: sentry.id, key: 'sentry-io' }, { key: 'sentry-io' }], [{ action: 'enable', serverId: sentry.id }, { enabled: true }], [{ action: 'widen', serverId: sentry.id }, { projectId: null }]] as const) {
      const card = (await post(`/threads/${t}/mcp/proposals`, p)).json; expect(card.kind).toBe('mcp');
      await post(`/approvals/${card.id}/answer`, { optionId: 'approve' });
      expect((await call(`/mcp/servers/${sentry.id}`)).json).toMatchObject(expected);
    }
    const declined = (await post(`/threads/${t}/mcp/proposals`, { action: 'rename', serverId: sentry.id, key: 'nope' })).json;
    await post(`/approvals/${declined.id}/answer`, { optionId: 'decline' });
    expect((await call(`/mcp/servers/${sentry.id}`)).json.key).toBe('sentry-io');
  });
});
