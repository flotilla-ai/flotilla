import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import { localKms, type Kms } from '../secrets/vault.js';

type Row = Record<string, any>;
export interface PluginServerSpec { key: string; url?: string; command?: string[]; scopes?: string[]; keys?: string[] }
export interface PluginManifest { specVersion: '1.0.0' | '1.1.0'; key: string; name: string; version: string; mcpServers: PluginServerSpec[] }
export interface PluginView { id: string; scope: 'organization' | 'user'; projectId: string | null; key: string; name: string; repo: string; path: string; ref: string; version: string; connectionMode: 'shared' | 'each-member'; privateThreadsOnly: boolean; autoUpdate: boolean; updateState: string; keyNames: string[]; serverKeys: string[] }
export interface ResolvedPlugin extends PluginView { requiresConnection: boolean }
const id = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;
const keyRe = /^[a-z][a-z0-9-]{0,63}$/;
const str = (v: unknown, name: string, max = 512) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new ApiFailure('ValidationFailed', `${name} must be 1-${max} characters`); return v.trim() };
const repo = (v: unknown) => { const s = str(v, 'repo'); if (!/^[^\s/]+\/[^\s/]+$/.test(s)) throw new ApiFailure('ValidationFailed', 'repo must be owner/repo'); return s };
const secrets = (v: unknown) => { if (v === undefined) return {}; if (!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some((x) => typeof x !== 'string')) throw new ApiFailure('ValidationFailed', 'keys must be a string map'); return v as Record<string, string> };
export function manifest(v: unknown): PluginManifest {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ApiFailure('ValidationFailed', 'plugin manifest must be an object');
  const x = v as Row; const servers = x.mcpServers;
  if (!['1.0.0', '1.1.0'].includes(String(x.specVersion)) || !keyRe.test(String(x.key ?? '')) || typeof x.name !== 'string' || typeof x.version !== 'string' || !Array.isArray(servers) || !servers.length) throw new ApiFailure('ValidationFailed', 'plugin manifest must be spec 1.0.0/1.1.0 with key, name, version and mcpServers');
  for (const s of servers) { if (!keyRe.test(String(s.key ?? '')) || (s.scopes && !Array.isArray(s.scopes)) || (s.keys && !Array.isArray(s.keys))) throw new ApiFailure('ValidationFailed', 'plugin server keys, scopes and keys are invalid') }
  return { specVersion: x.specVersion, key: x.key, name: x.name, version: x.version, mcpServers: servers.map((s) => ({ key: s.key, ...(s.url ? { url: String(s.url) } : {}), ...(s.command ? { command: s.command.map(String) } : {}), scopes: (s.scopes ?? []).map(String), keys: (s.keys ?? []).map(String) })) };
}
export async function fetchManifest(input: { repo: string; path: string; ref: string }, fetchImpl: typeof fetch = fetch): Promise<PluginManifest> {
  const base = `https://raw.githubusercontent.com/${input.repo}/${input.ref}/${input.path ? `${input.path.replace(/^\/+|\/+$/g, '')}/` : ''}`;
  const one = async (name: string) => { const r = await fetchImpl(`${base}${name}`); if (!r.ok) throw new ApiFailure('ValidationFailed', `could not fetch ${name} from ${input.repo}`); return r.json() as Promise<Row> };
  const plugin = await one('plugin.json'); let servers = plugin.mcpServers;
  if (!servers) servers = (await one('mcp.json')).mcpServers;
  return manifest({ ...plugin, mcpServers: servers });
}
const widen = (a: string[] = [], b: string[] = []) => b.some((x) => !a.includes(x));
export class PluginLifecycleStore {
  private kmsInstance?: Kms;
  constructor(readonly pool: pg.Pool, private readonly fetchImpl: typeof fetch = fetch, private readonly kmsFactory: () => Kms = () => localKms()) {}
  private get kms() { return (this.kmsInstance ??= this.kmsFactory()) }
  private async q(sql: string, args: unknown[] = []) { return (await this.pool.query(sql, args)).rows as Row[] }
  private seal(idv: string, keys: Record<string, string>) { return this.kms.seal(Buffer.from(JSON.stringify(keys)), `mcp-plugin:${idv}`) }
  private async admin(userId: string) { return (await this.q('SELECT role FROM users WHERE id=$1', [userId]))[0]?.role === 'admin' }
  private view(r: Row): PluginView { const spec = r.spec as PluginManifest; return { id: r.id, scope: r.scope, projectId: r.project_id, key: r.key, name: r.name, repo: r.repo, path: r.path, ref: r.ref, version: r.version, connectionMode: r.connection_mode, privateThreadsOnly: r.private_threads_only, autoUpdate: r.auto_update, updateState: r.update_state, keyNames: [...new Set(spec.mcpServers.flatMap((s) => s.keys ?? []))], serverKeys: spec.mcpServers.map((s) => s.key) } }
  private async row(userId: string, idv: string): Promise<Row> { const [r] = await this.q('SELECT * FROM mcp_plugins WHERE id=$1 AND (owner_id=$2 OR scope=$3)', [idv, userId, 'organization']); if (!r) throw new ApiFailure('NotFound', 'plugin not found'); return r }
  private async mutableRow(userId: string, idv: string): Promise<Row> { const r = await this.row(userId, idv); if (r.owner_id !== userId && !(r.scope === 'organization' && await this.admin(userId))) throw new ApiFailure('Forbidden', 'plugin owner or organization admin required'); return r }
  async install(userId: string, input: Row): Promise<PluginView> {
    const scope = input.scope === 'organization' ? 'organization' : 'user';
    if (scope === 'organization' && !(await this.admin(userId))) throw new ApiFailure('Forbidden', 'organization admin required');
    const projectId = input.projectId == null ? null : str(input.projectId, 'projectId', 128);
    if (projectId && !(await this.q('SELECT 1 FROM projects WHERE id=$1', [projectId]))[0]) throw new ApiFailure('NotFound', 'project not found');
    const m = input.manifest ? manifest(input.manifest) : await fetchManifest({ repo: repo(input.repo), path: String(input.path ?? ''), ref: str(input.ref ?? 'main', 'ref', 128) }, this.fetchImpl);
    const pid = id('mpl'); const keys = secrets(input.keys); const cm = input.connectionMode === 'each-member' ? 'each-member' : 'shared';
    const vals = [pid, userId, scope, projectId, m.key, m.name, repo(input.repo), String(input.path ?? ''), str(input.ref ?? 'main', 'ref', 128), m.version, JSON.stringify(m), this.seal(pid, keys), this.kms.keyId, cm, input.privateThreadsOnly === true, input.autoUpdate === true];
    try {
      await this.q(`INSERT INTO mcp_plugins (id,owner_id,scope,project_id,key,name,repo,path,ref,version,spec,sealed,key_id,connection_mode,private_threads_only,auto_update) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, vals);
      await this.q('INSERT INTO mcp_plugin_revisions (id,plugin_id,version,spec,sealed,key_id) VALUES ($1,$2,$3,$4,$5,$6)', [id('mpr'), pid, m.version, JSON.stringify(m), vals[11], this.kms.keyId]);
    } catch (e) { if ((e as { code?: string }).code === '23505') throw new ApiFailure('Conflict', 'plugin key already exists for this owner/project'); throw e }
    return this.view((await this.q('SELECT * FROM mcp_plugins WHERE id=$1', [pid]))[0]);
  }
  async list(userId: string): Promise<{ items: PluginView[] }> { return { items: (await this.q(`SELECT * FROM mcp_plugins WHERE owner_id=$1 OR scope='organization' ORDER BY scope,key`, [userId])).map((r) => this.view(r)) } }
  async sync(userId: string, idv: string): Promise<PluginView> {
    const r = await this.mutableRow(userId, idv); const next = await fetchManifest({ repo: r.repo, path: r.path, ref: r.ref }, this.fetchImpl);
    const old = r.spec as PluginManifest; const widened = next.mcpServers.some((n) => { const o = old.mcpServers.find((x) => x.key === n.key); return !o || widen(o.scopes, n.scopes) || widen(o.keys, n.keys) });
    if (widened) await this.q(`UPDATE mcp_plugins SET pending_spec=$2,update_state='needs-you',updated_at=now() WHERE id=$1`, [r.id, JSON.stringify(next)]);
    else await this.apply(userId, r.id, next, false);
    return this.view((await this.q('SELECT * FROM mcp_plugins WHERE id=$1', [r.id]))[0]);
  }
  private async apply(userId: string, idv: string, m: PluginManifest, pending: boolean) {
    const r = await this.mutableRow(userId, idv); const oldKeys = JSON.parse(this.kms.open(r.sealed, `mcp-plugin:${r.id}`).toString('utf8')) as Record<string, string>;
    const seal = this.seal(r.id, oldKeys);
    await this.q(`UPDATE mcp_plugins SET version=$2,spec=$3,sealed=$4,key_id=$5,pending_spec=NULL,update_state='current',updated_at=now() WHERE id=$1`, [r.id, m.version, JSON.stringify(m), seal, this.kms.keyId]);
    await this.q('INSERT INTO mcp_plugin_revisions (id,plugin_id,version,spec,sealed,key_id) VALUES ($1,$2,$3,$4,$5,$6)', [id('mpr'), r.id, m.version, JSON.stringify(m), seal, this.kms.keyId]);
    if (pending) return;
  }
  async approveUpdate(userId: string, idv: string): Promise<PluginView> { const r = await this.mutableRow(userId, idv); if (!r.pending_spec) throw new ApiFailure('ValidationFailed', 'no pending update'); await this.apply(userId, idv, manifest(r.pending_spec), true); return this.view((await this.q('SELECT * FROM mcp_plugins WHERE id=$1', [idv]))[0]) }
  async rollback(userId: string, idv: string): Promise<PluginView> {
    const r = await this.mutableRow(userId, idv); const revs = await this.q('SELECT * FROM mcp_plugin_revisions WHERE plugin_id=$1 ORDER BY created_at DESC,id DESC', [r.id]);
    const prior = revs.find((x) => x.version !== r.version) ?? revs[1]; if (!prior) throw new ApiFailure('ValidationFailed', 'no earlier revision');
    await this.q(`UPDATE mcp_plugins SET version=$2,spec=$3,sealed=$4,key_id=$5,pending_spec=NULL,update_state='current',updated_at=now() WHERE id=$1`, [r.id, prior.version, JSON.stringify(prior.spec), prior.sealed, prior.key_id]);
    return this.view((await this.q('SELECT * FROM mcp_plugins WHERE id=$1', [r.id]))[0]);
  }
  async connect(userId: string, idv: string, serverKey: string, keysInput: unknown): Promise<{ connected: true }> {
    const r = await this.row(userId, idv); const spec = r.spec as PluginManifest; if (!spec.mcpServers.some((s) => s.key === serverKey)) throw new ApiFailure('ValidationFailed', 'unknown plugin server');
    const keys = secrets(keysInput); const cid = id('mpc');
    await this.q(`INSERT INTO mcp_plugin_connections (id,plugin_id,user_id,server_key,sealed,key_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (plugin_id,user_id,server_key) DO UPDATE SET sealed=$5,key_id=$6`, [cid, r.id, userId, serverKey, this.seal(cid, keys), this.kms.keyId]);
    return { connected: true };
  }
  async autoSyncDue(): Promise<{ checked: number; needsYou: number }> {
    const rows = await this.q(`SELECT id,owner_id FROM mcp_plugins WHERE enabled AND auto_update`);
    let needsYou = 0;
    for (const r of rows) { const out = await this.sync(r.owner_id, r.id); if (out.updateState === 'needs-you') needsYou++ }
    return { checked: rows.length, needsYou };
  }
  async resolve(userId: string, projectId: string | null): Promise<{ items: ResolvedPlugin[] }> {
    const rows = await this.q(`SELECT * FROM mcp_plugins WHERE enabled AND (project_id IS NULL OR project_id=$2) AND (scope='organization' OR owner_id=$1) ORDER BY scope DESC,project_id NULLS LAST`, [userId, projectId]);
    const byKey = new Map<string, Row>();
    for (const r of rows) if (!byKey.has(r.key) || r.scope === 'user' || (r.project_id && !byKey.get(r.key)?.project_id)) byKey.set(r.key, r);
    const out: ResolvedPlugin[] = [];
    for (const r of byKey.values()) {
      const connections = new Set((await this.q('SELECT server_key FROM mcp_plugin_connections WHERE plugin_id=$1 AND user_id=$2', [r.id, userId])).map((x) => x.server_key));
      out.push({ ...this.view(r), requiresConnection: r.connection_mode === 'each-member' && (r.spec as PluginManifest).mcpServers.some((s) => !connections.has(s.key)) });
    }
    return { items: out };
  }
}
