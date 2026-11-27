import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import { scrubString } from '@flotilla/core/kernel/scrub';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ApiFailure } from '../api-platform/types.js';
import { localKms, type Kms } from '../secrets/vault.js';
import { FORBIDDEN_CHECKLIST, parseImport, parseServerInput, placeholders, type McpAdapterConfig, type McpAuth, type McpProposal, type McpServer, type McpServerInput, type McpTestResult, type McpTestStep } from './types.js';

type Row = Record<string, any>;
type Bag = { headers?: Record<string, string>; env?: Record<string, string>; clientSecret?: string; accessToken?: string; refreshToken?: string };
const id = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;
export const redirectUri = () => `${(process.env.FLOTILLA_PUBLIC_URL ?? 'http://localhost:8080').replace(/\/$/, '')}/api/v1/mcp/oauth/callback`;
const SELECT = `SELECT s.*, f.id AS flow_id FROM mcp_servers s LEFT JOIN LATERAL (SELECT id FROM mcp_oauth_flows WHERE server_id=s.id AND status='pending' AND created_at > now() - interval '10 minutes' ORDER BY created_at DESC LIMIT 1) f ON true`;
/** Every configured value is a redaction target, named by where it lives. */
const named = (b: Bag): Record<string, string> => ({
  ...Object.fromEntries(Object.entries(b.headers ?? {}).map(([k, v]) => [`header:${k}`, v])), ...Object.fromEntries(Object.entries(b.env ?? {}).map(([k, v]) => [`env:${k}`, v])),
  ...(b.clientSecret ? { clientSecret: b.clientSecret } : {}), ...(b.accessToken ? { accessToken: b.accessToken } : {}), ...(b.refreshToken ? { refreshToken: b.refreshToken } : {})
});

export class McpStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  private kmsInstance?: Kms;
  private events?: EventStore;
  constructor(private readonly databaseUrl: string, private readonly kmsFactory: () => Kms = () => localKms()) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private get kms(): Kms { return (this.kmsInstance ??= this.kmsFactory()); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }
  private seal(serverId: string, bag: Bag): Buffer { return this.kms.seal(Buffer.from(JSON.stringify(bag)), `mcp:${serverId}`); }
  private bag(r: Row): Bag { return JSON.parse(this.kms.open(r.sealed, `mcp:${r.id}`).toString('utf8')); }
  private async saveBag(r: Row, bag: Bag, expiresAt?: Date | null): Promise<void> {
    await this.q(`UPDATE mcp_servers SET sealed=$2,key_id=$3,token_expires_at=COALESCE($4,token_expires_at),updated_at=now() WHERE id=$1`, [r.id, this.seal(r.id, bag), this.kms.keyId, expiresAt ?? null]);
  }

  view(r: Row): McpServer {
    const c = r.config as Row; const test = r.last_test as McpTestResult | null; const pending = !!r.flow_id;
    const auth: McpAuth = c.auth === 'headers' ? { kind: 'headers', headers: c.headers.map((h: Row) => ({ name: h.name, configured: true, variables: h.variables })) }
      : c.auth === 'oauth' ? { kind: 'oauth', authorizeUrl: c.oauth.authorizeUrl, tokenUrl: c.oauth.tokenUrl, clientId: c.oauth.clientId, clientSecretConfigured: c.oauth.hasSecret, scopes: c.oauth.scopes, redirectUri: redirectUri(), connection: pending ? 'pending' : c.oauth.connected ? 'connected' : 'none', flowId: r.flow_id ?? null, expiresAt: r.token_expires_at?.toISOString() ?? null }
      : { kind: 'none' };
    const needsAuth = (auth.kind === 'oauth' && !c.oauth.connected) || test?.failingStep === 'auth';
    const status = !r.enabled ? 'disabled' : pending ? 'pending-browser' : needsAuth ? 'needs-auth' : !test ? 'untested' : test.ok ? 'ok' : test.steps.some((s) => s.ok === false) ? 'failing' : 'untested';
    return { id: r.id, key: r.key, name: r.name, transport: r.transport, url: r.url, command: r.command, env: (c.env ?? []).map((name: string) => ({ name, configured: true })), projectId: r.project_id, enabled: r.enabled, status, auth, lastTest: test, toolPrefix: `mcp__${r.key}__` };
  }
  private async row(userId: string, serverId: string): Promise<Row> {
    const [r] = await this.q(`${SELECT} WHERE s.id=$1 AND s.owner_id=$2`, [serverId, userId]);
    if (!r) throw new ApiFailure('NotFound', 'MCP server not found');
    return r;
  }
  private async ownedProject(userId: string, projectId: string | null | undefined): Promise<void> {
    if (projectId && !(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId]))[0]) throw new ApiFailure('NotFound', 'project not found');
  }
  async list(userId: string): Promise<McpServer[]> { return (await this.q(`${SELECT} WHERE s.owner_id=$1 ORDER BY s.key`, [userId])).map((r) => this.view(r)); }
  async get(userId: string, serverId: string): Promise<McpServer> { return this.view(await this.row(userId, serverId)); }

  async create(userId: string, input: McpServerInput): Promise<McpServer> {
    await this.ownedProject(userId, input.projectId);
    const sid = id('mcp'); const a = input.auth ?? { kind: 'none' };
    const bag: Bag = { headers: a.kind === 'headers' ? Object.fromEntries(a.headers.map((h) => [h.name, h.value])) : {}, env: input.env ?? {}, ...(a.kind === 'oauth' && a.clientSecret ? { clientSecret: a.clientSecret } : {}) };
    const config = { auth: a.kind, env: Object.keys(input.env ?? {}), ...(a.kind === 'headers' ? { headers: a.headers.map((h) => ({ name: h.name, variables: placeholders(h.value) })) } : {}),
      ...(a.kind === 'oauth' ? { oauth: { authorizeUrl: a.authorizeUrl, tokenUrl: a.tokenUrl, clientId: a.clientId, scopes: a.scopes ?? [], hasSecret: !!a.clientSecret, connected: false } } : {}) };
    try {
      await this.q(`INSERT INTO mcp_servers (id,owner_id,project_id,key,name,transport,url,command,config,sealed,key_id,enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [sid, userId, input.projectId ?? null, input.key, input.name ?? input.key, input.transport, input.url ?? null, input.command ? JSON.stringify(input.command) : null, JSON.stringify(config), this.seal(sid, bag), this.kms.keyId, input.enabled !== false]);
    } catch (err) { if ((err as { code?: string }).code === '23505') throw new ApiFailure('Conflict', `an MCP server with key ${input.key} already exists`); throw err; }
    return this.get(userId, sid);
  }
  async update(userId: string, serverId: string, patch: { key?: unknown; name?: unknown; enabled?: unknown; projectId?: unknown }): Promise<McpServer> {
    const r = await this.row(userId, serverId);
    const key = patch.key === undefined ? r.key : parseServerInput({ key: patch.key, transport: 'stdio', command: ['x'] }).key;
    const projectId = patch.projectId === undefined ? r.project_id : (patch.projectId as string | null);
    await this.ownedProject(userId, projectId);
    try { await this.q(`UPDATE mcp_servers SET key=$2,name=$3,enabled=$4,project_id=$5,updated_at=now() WHERE id=$1`, [r.id, key, typeof patch.name === 'string' ? patch.name : r.name, typeof patch.enabled === 'boolean' ? patch.enabled : r.enabled, projectId]); }
    catch (err) { if ((err as { code?: string }).code === '23505') throw new ApiFailure('Conflict', `an MCP server with key ${key} already exists`); throw err; }
    return this.get(userId, serverId);
  }
  async remove(userId: string, serverId: string): Promise<void> { await this.q('DELETE FROM mcp_servers WHERE id=$1 AND owner_id=$2', [(await this.row(userId, serverId)).id, userId]); }
  async importText(userId: string, text: string, projectId: string | null) {
    const parsed = parseImport(text); const servers: McpServer[] = [];
    for (const s of parsed.servers) servers.push(await this.create(userId, { ...s, projectId }));
    return { source: parsed.source, servers, warnings: parsed.warnings };
  }

  async startOAuth(userId: string, serverId: string) {
    const r = await this.row(userId, serverId); const o = (r.config as Row).oauth;
    if (!o) throw new ApiFailure('ValidationFailed', 'this server does not use OAuth');
    const state = randomBytes(24).toString('base64url'); const verifier = randomBytes(32).toString('base64url'); const flowId = id('mfl');
    await this.q(`UPDATE mcp_oauth_flows SET status='cancelled' WHERE server_id=$1 AND status='pending'`, [r.id]);
    await this.q(`INSERT INTO mcp_oauth_flows (id,server_id,user_id,state,verifier,status) VALUES ($1,$2,$3,$4,$5,'pending')`, [flowId, r.id, userId, state, verifier]);
    const u = new URL(o.authorizeUrl);
    for (const [k, v] of Object.entries({ response_type: 'code', client_id: o.clientId, redirect_uri: redirectUri(), state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', ...(o.scopes.length ? { scope: o.scopes.join(' ') } : {}) })) u.searchParams.set(k, v as string);
    return { flowId, authorizeUrl: u.toString(), redirectUri: redirectUri(), message: 'Finish in your browser' };
  }
  async cancelOAuth(userId: string, flowId: string): Promise<McpServer> {
    const [f] = await this.q(`UPDATE mcp_oauth_flows SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING server_id`, [flowId, userId]);
    if (!f) throw new ApiFailure('NotFound', 'sign-in not found or already finished');
    return this.get(userId, f.server_id);
  }
  private async token(r: Row, bag: Bag, form: Record<string, string>): Promise<void> {
    const o = (r.config as Row).oauth;
    const res = await fetch(o.tokenUrl, { method: 'POST', signal: AbortSignal.timeout(10_000), headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams({ client_id: o.clientId, ...(bag.clientSecret ? { client_secret: bag.clientSecret } : {}), ...form }) });
    const j = (await res.json().catch(() => ({}))) as Row;
    if (!res.ok || typeof j.access_token !== 'string') throw new ApiFailure('Unauthorized', scrubString(`token endpoint returned ${res.status}: ${JSON.stringify(j)}`, named(bag)).slice(0, 300));
    const next = { ...bag, accessToken: j.access_token, refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token : bag.refreshToken };
    await this.saveBag(r, next, new Date(Date.now() + (Number(j.expires_in) || 3600) * 1000));
    Object.assign(bag, next);
  }
  async finishOAuth(userId: string, state: string, code: string): Promise<McpServer> {
    const [f] = await this.q(`UPDATE mcp_oauth_flows SET status='done' WHERE state=$1 AND user_id=$2 AND status='pending' AND created_at > now() - interval '10 minutes' RETURNING *`, [state, userId]);
    if (!f) throw new ApiFailure('NotFound', 'sign-in not found, cancelled or expired');
    const r = await this.row(userId, f.server_id);
    await this.token(r, this.bag(r), { grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: f.verifier });
    await this.q(`UPDATE mcp_servers SET config=jsonb_set(config,'{oauth,connected}','true') WHERE id=$1`, [r.id]);
    return this.get(userId, r.id);
  }
  /** Decrypted bag with a fresh access token (refreshed 60 s before expiry). */
  private async live(r: Row): Promise<Bag> {
    const bag = this.bag(r);
    if (bag.refreshToken && r.token_expires_at && r.token_expires_at.getTime() < Date.now() + 60_000) await this.token(r, bag, { grant_type: 'refresh_token', refresh_token: bag.refreshToken });
    return bag;
  }
  private headers(bag: Bag, env: Record<string, string>): Record<string, string> {
    const out = Object.fromEntries(Object.entries(bag.headers ?? {}).map(([k, v]) => [k, v.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, n) => env[n] ?? '')]));
    return bag.accessToken ? { ...out, Authorization: `Bearer ${bag.accessToken}` } : out;
  }

  async test(userId: string, serverId: string): Promise<McpTestResult> {
    const r = await this.row(userId, serverId); const steps: McpTestStep[] = [{ name: 'config', ok: true, detail: r.transport === 'http' ? r.url : (r.command as string[]).join(' ') }];
    let bag: Bag = {}; let httpStatus: number | null = null; let tools: string[] = [];
    const step = (name: McpTestStep['name'], ok: boolean | null, detail: string) => { steps.push({ name, ok, detail: scrubString(detail, named(bag)) }); return ok !== false; };
    const done = async () => {
      const failing = steps.find((s) => s.ok === false)?.name ?? null;
      const result: McpTestResult = { ok: steps.every((s) => s.ok === true), at: new Date().toISOString(), steps, failingStep: failing, httpStatus, checklist: httpStatus === 403 ? FORBIDDEN_CHECKLIST : [], tools };
      await this.q('UPDATE mcp_servers SET last_test=$2 WHERE id=$1', [r.id, JSON.stringify(result)]);
      return result;
    };
    try { bag = await this.live(r); } catch (err) { step('auth', false, (err as Error).message); return done(); }
    const c = r.config as Row;
    if (c.auth === 'oauth' && !bag.accessToken) { step('auth', false, 'not signed in: press Connect'); return done(); }
    const vars = (c.headers ?? []).flatMap((h: Row) => h.variables);
    step('auth', true, c.auth === 'none' ? 'no auth' : vars.length ? `\${${vars.join('}, ${')}} resolve from thread env vars at run time` : c.auth);
    if (r.transport === 'stdio') { step('connect', null, 'STDIO servers start on the thread machine; checked on the next run'); return done(); }
    let session: string | null = null; let n = 0;
    const send = async (method: string, params: unknown, notify = false) => {
      const res = await fetch(r.url, { method: 'POST', signal: AbortSignal.timeout(10_000), headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(session ? { 'mcp-session-id': session } : {}), ...this.headers(bag, {}) }, body: JSON.stringify({ jsonrpc: '2.0', method, params, ...(notify ? {} : { id: ++n }) }) });
      session = res.headers.get('mcp-session-id') ?? session; httpStatus = res.status;
      const text = await res.text();
      if (!res.ok) return { status: res.status, error: scrubString(text, named(bag)).slice(0, 500) };
      const data = res.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).find((l) => l.includes('"id"')) : text;
      return { status: res.status, json: data ? JSON.parse(data) as Row : null };
    };
    let init;
    try { init = await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flotilla', version: '0' } }); }
    catch (err) { step('connect', false, `could not reach ${r.url}: ${(err as Error).message}`); return done(); }
    step('connect', true, `HTTP ${init.status}`);
    if (init.status === 401) { step('auth', false, `401: ${init.error}`); steps.splice(1, 1); return done(); }
    if (!init.json?.result) { step('initialize', false, `HTTP ${init.status}: ${init.error ?? JSON.stringify(init.json?.error ?? init.json)}`); return done(); }
    step('initialize', true, `protocol ${init.json.result.protocolVersion}`);
    try {
      await send('notifications/initialized', {}, true);
      const list = await send('tools/list', {});
      tools = ((list.json?.result?.tools ?? []) as Row[]).map((t) => t.name);
      step('tools', !!list.json?.result, list.json?.result ? `${tools.length} tools` : `HTTP ${list.status}: ${list.error ?? ''}`);
    } catch (err) { step('tools', false, (err as Error).message); }
    return done();
  }

  /** The agent's in-thread ask: a Review card the owner approves with one click. */
  async propose(userId: string, threadId: string, raw: Row): Promise<Row> {
    const [t] = await this.q('SELECT id,project_id FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]);
    if (!t) throw new ApiFailure('NotFound', 'thread not found');
    let p: McpProposal; let question: string;
    if (raw.action === 'add') {
      const server = parseServerInput({ ...raw.server, projectId: t.project_id, enabled: true });
      const literal = server.auth?.kind === 'headers' && server.auth.headers.some((h) => { const rest = h.value.replace(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g, '').trim(); return !placeholders(h.value).length || (rest !== '' && !/^(Bearer|Basic|Token)$/i.test(rest)); });
      if (literal || Object.keys(server.env ?? {}).length || (server.auth?.kind === 'oauth' && server.auth.clientSecret)) throw new ApiFailure('ValidationFailed', 'proposals cannot carry secret values; use ${VAR} placeholders and set the value yourself');
      p = { action: 'add', server }; question = `Add MCP server ${server.key} (${server.url ?? server.command!.join(' ')})?`;
    } else {
      const s = await this.get(userId, String(raw.serverId));
      if (raw.action === 'rename') { p = { action: 'rename', serverId: s.id, key: parseServerInput({ key: raw.key, transport: 'stdio', command: ['x'] }).key }; question = `Rename MCP server ${s.key} to ${p.key}?`; }
      else if (raw.action === 'enable') { p = { action: 'enable', serverId: s.id }; question = `Enable MCP server ${s.key}?`; }
      else if (raw.action === 'widen') { p = { action: 'widen', serverId: s.id }; question = `Use MCP server ${s.key} in all your projects (now ${s.projectId ?? 'all'})?`; }
      else throw new ApiFailure('ValidationFailed', 'action must be add, rename, enable or widen');
    }
    const [a] = await this.q(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail) VALUES ($1,$2,'mcp',$3,$4,false,'open',$5) RETURNING *`,
      [id('apr'), threadId, question, JSON.stringify([{ id: 'approve', label: 'Approve' }, { id: 'decline', label: 'Decline' }]), JSON.stringify({ mcp: p })]);
    await (this.events ??= new EventStore(this.databaseUrl)).appendEvents(threadId as never, [{ runId: null, kind: 'approval.requested', source: 'kernel', trust: 'trusted', payload: { approvalId: a.id, kind: 'mcp', question } }] as never);
    return a;
  }
  /** Called by `ThreadRunner.answerApproval` for `kind='mcp'` cards. */
  async answer(approval: Row, optionId: string, userId: string): Promise<void> {
    const p = approval.detail?.mcp as McpProposal | undefined;
    if (optionId !== 'approve' || !p) return;
    if (p.action === 'add') await this.create(userId, p.server);
    else await this.update(userId, p.serverId, p.action === 'rename' ? { key: p.key } : p.action === 'enable' ? { enabled: true } : { projectId: null });
  }

  /** The runner's MCP config for a thread: enabled servers for its project (or all projects), values decrypted. */
  async prepare(threadId: string, env: Record<string, string>): Promise<{ config: McpAdapterConfig; secrets: Record<string, string> } | null> {
    const [t] = await this.q('SELECT owner_id,project_id FROM threads WHERE id=$1', [threadId]);
    if (!t) return null;
    const rows = await this.q(`${SELECT} WHERE s.owner_id=$1 AND s.enabled AND (s.project_id IS NULL OR s.project_id=$2) ORDER BY s.key`, [t.owner_id, t.project_id ?? '']);
    if (!rows.length) return null;
    const config: McpAdapterConfig = { mcpServers: {} }; const secrets: Record<string, string> = {};
    for (const r of rows) {
      const bag = await this.live(r).catch(() => this.bag(r));
      for (const [k, v] of Object.entries(named(bag))) secrets[`mcp:${r.key}:${k}`] = v;
      const headers = this.headers(bag, env);
      for (const [k, v] of Object.entries(headers)) if (v !== bag.headers?.[k]) secrets[`mcp:${r.key}:header:${k}`] = v;
      config.mcpServers[r.key] = r.transport === 'http' ? { type: 'http', url: r.url, headers } : { type: 'stdio', command: r.command[0], args: r.command.slice(1), env: bag.env ?? {} };
    }
    return { config, secrets };
  }
}

const stores = new Map<string, McpStore>();
export function mcpStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): McpStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new McpStore(databaseUrl)));
  return store;
}
