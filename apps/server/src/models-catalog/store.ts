import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { claudeCodeAdapter } from '@flotilla/adapter-claude-code';
import { codexAdapter } from '@flotilla/adapter-codex';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AgentAdapterManifest } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { ApiFailure } from '../api-platform/types.js';
import { localKms, type Kms } from '../secrets/vault.js';
import type { SecretsStore } from '../secrets/store.js';
import { FREE_CONNECTION, checkAccess, loadCatalog, parseEffort, type Catalog } from './catalog.js';
import type { AccessCheck, Connection, ConnectionPatch, ModelBadge, ModelListItem, ModelPolicy, ModelSelection, PickerItem, Provider, ResolvedSelection, RunOutPolicy } from './types.js';

type Row = Record<string, any>;
export type ConnectionInput = { provider: string; scope?: 'user' | 'org'; adapter?: string; label?: string; apiKey?: string; baseUrl?: string; excludedModels?: unknown; customModels?: unknown };
export type ConnectionPatchInput = ConnectionPatch;

const MODEL_ID = /^[\w.:/@+-]{1,200}$/;
function modelIds(raw: unknown, field: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 500 || raw.some((m) => typeof m !== 'string' || !MODEL_ID.test(m))) throw new ApiFailure('ValidationFailed', `${field} must be an array of model ids`);
  return [...new Set(raw as string[])];
}
const optString = (raw: unknown, field: string): string | null => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string' || !raw || raw.length > 4096) throw new ApiFailure('ValidationFailed', `${field} must be a non-empty string`);
  return raw;
};
const httpUrl = (raw: string | null): string | null => {
  if (raw !== null && !/^https?:\/\/[^\s]+$/.test(raw)) throw new ApiFailure('ValidationFailed', 'baseUrl must be an http(s) URL');
  return raw;
};
const runOuts: RunOutPolicy[] = ['ask', 'ask-before-free', 'keep-going'];
const badgeOf = (kind: Connection['kind']): ModelBadge => kind === 'subscription' ? 'subscription' : kind === 'free' ? 'free' : 'key';
const badgeLabel: Record<ModelBadge, string> = { subscription: 'Subscription', key: 'API key', free: 'Free' };
const aad = (id: string) => `model-connection:${id}`;

export class ModelsCatalogStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  private kmsInstance?: Kms;
  private catalogInstance?: Catalog;
  constructor(private readonly databaseUrl: string, private readonly manifests: AgentAdapterManifest[], private readonly fetchImpl: typeof fetch = fetch) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private get kms(): Kms { return (this.kmsInstance ??= localKms()); }
  get catalog(): Catalog { return (this.catalogInstance ??= loadCatalog(this.manifests)); }
  async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }

  providers(q = ''): Provider[] {
    const needle = q.trim().toLowerCase();
    return this.catalog.providers.filter((p) => !needle || `${p.id} ${p.name} ${p.kind}`.toLowerCase().includes(needle));
  }
  private provider(id: string): Provider {
    const p = this.catalog.providers.find((x) => x.id === id);
    if (!p) throw new ApiFailure('NotFound', 'provider not found');
    return p;
  }
  /** Adapter + env var for a provider; a custom endpoint borrows the chosen adapter's API-key env var. */
  private target(p: Provider, adapter?: string): { adapter: string; envVar: string | null } {
    const id = p.adapter ?? adapter;
    const m = this.manifests.find((x) => x.id === id);
    if (!m) throw new ApiFailure('ValidationFailed', 'adapter must name an installed adapter');
    const key = m.auth.find((a) => a.kind === 'api-key');
    if (p.kind !== 'subscription' && !key) throw new ApiFailure('ValidationFailed', `${m.displayName} cannot use an API key`);
    return { adapter: m.id, envVar: p.kind === 'subscription' ? null : key && key.kind === 'api-key' ? key.envVar : null };
  }
  /** Discovery fetches a caller-chosen URL from the server, so only admins may point it at an endpoint. */
  private async mayDiscover(userId: string, p: Provider): Promise<void> {
    if (p.discovery === 'openai-models' && !(await this.isAdmin(userId))) throw new ApiFailure('Forbidden', 'only an admin can connect a custom endpoint');
  }
  async check(userId: string, input: ConnectionInput): Promise<AccessCheck> {
    const p = this.provider(input.provider); this.target(p, input.adapter); await this.mayDiscover(userId, p);
    return checkAccess(p, { apiKey: optString(input.apiKey, 'apiKey'), baseUrl: optString(input.baseUrl, 'baseUrl') }, this.catalog, this.fetchImpl);
  }

  private toConnection(r: Row): Connection {
    const available = r.available_models as string[]; const excluded = r.excluded_models as string[]; const customs = r.custom_models as string[];
    const p = this.catalog.providers.find((x) => x.id === r.provider);
    return {
      id: r.id, scope: r.scope, provider: r.provider, kind: r.kind, adapter: r.adapter, label: r.label, position: r.position, enabled: r.enabled, status: r.status,
      baseUrl: r.base_url, hasKey: !!r.sealed_key, loginCommand: p?.auth.kind === 'vendor-login' ? p.auth.command : null,
      models: [...new Set([...available, ...customs])].filter((m) => !excluded.includes(m)), availableModels: available, excludedModels: excluded, customModels: customs,
      checkedAt: r.checked_at?.toISOString() ?? null
    };
  }
  private free(): Connection {
    const models = this.catalog.models.filter((m) => m.free && m.adapter === FREE_CONNECTION.adapter).map((m) => m.model);
    return { id: FREE_CONNECTION.id, scope: 'free', provider: 'flotilla-free', kind: 'free', adapter: FREE_CONNECTION.adapter, label: FREE_CONNECTION.label, position: 0, enabled: true, status: 'connected', baseUrl: null, hasKey: false, loginCommand: null, models, availableModels: models, excludedModels: [], customModels: [], checkedAt: null };
  }
  private async isAdmin(userId: string): Promise<boolean> {
    return (await this.q('SELECT role FROM users WHERE id=$1', [userId]))[0]?.role === 'admin';
  }
  /** Owner's connections in their order, then org connections, then the free models. */
  async list(userId: string): Promise<Connection[]> {
    const rows = await this.q(`SELECT * FROM model_connections WHERE owner_id=$1 OR scope='org' ORDER BY (scope='org'), position, created_at`, [userId]);
    return [...rows.map((r) => this.toConnection(r)), this.free()];
  }
  private async owned(userId: string, id: string): Promise<Row> {
    const [r] = await this.q(`SELECT * FROM model_connections WHERE id=$1 AND (owner_id=$2 OR scope='org')`, [id, userId]);
    if (!r) throw new ApiFailure('NotFound', 'connection not found');
    if (r.scope === 'org' && !(await this.isAdmin(userId))) throw new ApiFailure('Forbidden', 'only an admin can change org connections');
    return r;
  }

  async create(userId: string, input: ConnectionInput): Promise<Connection> {
    const scope = input.scope ?? 'user';
    if (scope !== 'user' && scope !== 'org') throw new ApiFailure('ValidationFailed', 'scope must be user or org');
    if (scope === 'org' && !(await this.isAdmin(userId))) throw new ApiFailure('Forbidden', 'only an admin can add org connections');
    const p = this.provider(input.provider); const { adapter, envVar } = this.target(p, input.adapter); await this.mayDiscover(userId, p);
    const excluded = modelIds(input.excludedModels, 'excludedModels'); const customs = modelIds(input.customModels, 'customModels');
    const label = optString(input.label, 'label') ?? p.name; const baseUrl = httpUrl(optString(input.baseUrl, 'baseUrl')) ?? p.baseUrl; const apiKey = optString(input.apiKey, 'apiKey');
    const access = await checkAccess(p, { apiKey, baseUrl }, this.catalog, this.fetchImpl);
    const id = `mcn_${randomBytes(8).toString('hex')}`; const owner = scope === 'org' ? null : userId;
    const [r] = await this.q(`INSERT INTO model_connections (id,scope,owner_id,provider,kind,adapter,label,position,status,base_url,env_var,sealed_key,key_id,available_models,excluded_models,custom_models,checked_at,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(position)+1,0) FROM model_connections WHERE scope=$2 AND owner_id IS NOT DISTINCT FROM $3),$8,$9,$10,$11,$12,$13,$14,$15,now(),$16) RETURNING *`,
    [id, scope, owner, p.id, p.kind, adapter, label, access.status, baseUrl, envVar, apiKey ? this.kms.seal(Buffer.from(apiKey), aad(id)) : null, apiKey ? this.kms.keyId : null, JSON.stringify(access.models), JSON.stringify(excluded), JSON.stringify(customs), userId]);
    return this.toConnection(r);
  }
  /** Edit, disable, exclude/add models; a new key or base URL reconnects (re-checks access). */
  async patch(userId: string, id: string, input: ConnectionPatchInput): Promise<Connection> {
    const r = await this.owned(userId, id);
    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') throw new ApiFailure('ValidationFailed', 'enabled must be a boolean');
    const label = optString(input.label, 'label') ?? r.label;
    const apiKey = optString(input.apiKey, 'apiKey'); const baseUrl = httpUrl(optString(input.baseUrl, 'baseUrl'));
    const excluded = input.excludedModels === undefined ? r.excluded_models : modelIds(input.excludedModels, 'excludedModels');
    const customs = input.customModels === undefined ? r.custom_models : modelIds(input.customModels, 'customModels');
    let access: AccessCheck | null = null;
    if (apiKey || baseUrl) {
      const p = this.provider(r.provider); if (baseUrl) await this.mayDiscover(userId, p);
      access = await checkAccess(p, { apiKey: apiKey ?? (r.sealed_key ? this.kms.open(r.sealed_key, aad(id)).toString('utf8') : null), baseUrl: baseUrl ?? r.base_url }, this.catalog, this.fetchImpl);
    }
    const [row] = await this.q(`UPDATE model_connections SET label=$2, enabled=COALESCE($3,enabled), excluded_models=$4, custom_models=$5, base_url=COALESCE($6,base_url),
      sealed_key=COALESCE($7,sealed_key), key_id=COALESCE($8,key_id), status=COALESCE($9,status), available_models=COALESCE($10,available_models),
      checked_at=CASE WHEN $9::text IS NULL THEN checked_at ELSE now() END WHERE id=$1 RETURNING *`,
    [id, label, input.enabled ?? null, JSON.stringify(excluded), JSON.stringify(customs), baseUrl, apiKey ? this.kms.seal(Buffer.from(apiKey), aad(id)) : null, apiKey ? this.kms.keyId : null,
      access?.status ?? null, access ? JSON.stringify(access.models) : null]);
    return this.toConnection(row);
  }
  async test(userId: string, id: string): Promise<Connection> {
    const r = await this.owned(userId, id);
    const apiKey = r.sealed_key ? this.kms.open(r.sealed_key, aad(id)).toString('utf8') : null;
    const access = await checkAccess(this.provider(r.provider), { apiKey, baseUrl: r.base_url }, this.catalog, this.fetchImpl);
    const [row] = await this.q('UPDATE model_connections SET status=$2, available_models=$3, checked_at=now() WHERE id=$1 RETURNING *', [id, access.status, JSON.stringify(access.models)]);
    return this.toConnection(row);
  }
  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.q('DELETE FROM model_connections WHERE id=$1', [id]);
  }
  /** `ids` must list every connection in that scope exactly once. */
  async reorder(userId: string, scope: unknown, ids: unknown): Promise<Connection[]> {
    if (scope !== undefined && scope !== 'user' && scope !== 'org') throw new ApiFailure('ValidationFailed', 'scope must be user or org');
    if (scope === 'org' && !(await this.isAdmin(userId))) throw new ApiFailure('Forbidden', 'only an admin can reorder org connections');
    const current = (await this.q(`SELECT id FROM model_connections WHERE ${scope === 'org' ? `scope='org'` : 'owner_id=$1'}`, scope === 'org' ? [] : [userId])).map((r) => r.id as string);
    if (!Array.isArray(ids) || ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !current.includes(id))) throw new ApiFailure('ValidationFailed', 'ids must list every connection in the scope once');
    for (const [i, id] of ids.entries()) await this.q('UPDATE model_connections SET position=$2 WHERE id=$1', [id, i]);
    return this.list(userId);
  }
  async findModels(userId: string, id: string, q = ''): Promise<string[]> {
    const c = (await this.list(userId)).find((x) => x.id === id);
    if (!c) throw new ApiFailure('NotFound', 'connection not found');
    return c.models.filter((m) => m.toLowerCase().includes(q.toLowerCase()));
  }

  /** CAPY-331: a pinned connection never falls back; unpinned picks the first enabled connection in order offering the model. Unsupported effort fails. */
  async resolve(userId: string, raw: unknown): Promise<ResolvedSelection> {
    const s = (typeof raw === 'string' ? { adapter: raw } : raw ?? {}) as Partial<Record<keyof ModelSelection, unknown>>;
    if (typeof s.adapter !== 'string' || !s.adapter) throw new ApiFailure('ValidationFailed', 'engine.adapter is required');
    if (s.model !== undefined && s.model !== null && (typeof s.model !== 'string' || !MODEL_ID.test(s.model))) throw new ApiFailure('ValidationFailed', 'engine.model must be a model id');
    if (s.connectionId !== undefined && s.connectionId !== null && typeof s.connectionId !== 'string') throw new ApiFailure('ValidationFailed', 'engine.connectionId must be a string');
    const sel: ModelSelection = { adapter: s.adapter as ModelSelection['adapter'], model: (s.model as string | null | undefined) ?? null, effort: parseEffort(s.effort), connectionId: (s.connectionId as string | null | undefined) ?? null };
    const offers = (c: Connection) => c.adapter === sel.adapter && (!sel.model || c.models.includes(sel.model));
    const policy = await this.policy(userId);
    if (policy.excludedAdapters.includes(sel.adapter)) throw new ApiFailure('ValidationFailed', `${sel.adapter} models are excluded by your model policy`);
    let conn: Connection | undefined;
    if (sel.connectionId) {
      conn = (await this.list(userId)).find((c) => c.id === sel.connectionId);
      if (conn?.kind === 'free' && policy.neverFree) throw new ApiFailure('ValidationFailed', 'your model policy never uses the free models');
      if (!conn) throw new ApiFailure('NotFound', 'connection not found');
      if (!conn.enabled || conn.status === 'failed') throw new ApiFailure('ValidationFailed', `${conn.label} is ${conn.enabled ? 'failing its access check' : 'disabled'}; no fallback`);
      if (!offers(conn)) throw new ApiFailure('ValidationFailed', `${sel.model ?? sel.adapter} is not available on ${conn.label}; no fallback`);
    } else {
      conn = (await this.candidates(userId, policy)).find(offers);
      if (!conn) throw new ApiFailure('ValidationFailed', `no enabled connection offers ${sel.adapter}${sel.model ? `:${sel.model}` : ''}`);
    }
    const entry = sel.model ? this.catalog.models.find((m) => m.adapter === sel.adapter && m.model === sel.model) : undefined;
    if (sel.effort) {
      if (!entry?.efforts.includes(sel.effort)) throw new ApiFailure('ValidationFailed', `${sel.model ?? `${sel.adapter} default model`} does not support effort ${sel.effort}; no fallback`);
    }
    return { ...sel, connectionId: conn.id, badge: badgeOf(conn.kind), connectionLabel: conn.label, ...(entry?.contextWindow ? { contextWindow: entry.contextWindow } : {}) };
  }

  async policy(userId: string): Promise<ModelPolicy> {
    const [r] = await this.q('SELECT * FROM model_policies WHERE user_id=$1', [userId]);
    return { runOut: r?.run_out ?? 'ask', neverFree: r?.never_free ?? false, excludedAdapters: r?.excluded_adapters ?? [], background: r?.background ?? null };
  }
  async setPolicy(userId: string, raw: Partial<Record<keyof ModelPolicy, unknown>>): Promise<ModelPolicy> {
    const p = { ...(await this.policy(userId)), ...raw } as Record<keyof ModelPolicy, unknown>;
    if (!runOuts.includes(p.runOut as RunOutPolicy)) throw new ApiFailure('ValidationFailed', `runOut must be one of ${runOuts.join(', ')}`);
    if (typeof p.neverFree !== 'boolean') throw new ApiFailure('ValidationFailed', 'neverFree must be a boolean');
    if (!Array.isArray(p.excludedAdapters) || p.excludedAdapters.some((a) => !this.manifests.some((m) => m.id === a))) throw new ApiFailure('ValidationFailed', 'excludedAdapters must list installed adapters');
    if (p.background !== null && (typeof p.background !== 'object' || typeof (p.background as ModelSelection).adapter !== 'string')) throw new ApiFailure('ValidationFailed', 'background must be a model selection or null');
    await this.q(`INSERT INTO model_policies (user_id,run_out,never_free,excluded_adapters,background) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (user_id) DO UPDATE SET run_out=EXCLUDED.run_out, never_free=EXCLUDED.never_free, excluded_adapters=EXCLUDED.excluded_adapters, background=EXCLUDED.background`,
    [userId, p.runOut, p.neverFree, JSON.stringify([...new Set(p.excludedAdapters as string[])]), p.background === null ? null : JSON.stringify(p.background)]);
    return this.policy(userId);
  }
  /** Usable connections in run order: enabled, not failing, allowed by policy; subscriptions run first (CAPY-484), otherwise owner → org → free. */
  async candidates(userId: string, policy?: ModelPolicy): Promise<Connection[]> {
    const p = policy ?? await this.policy(userId);
    const ok = (await this.list(userId)).filter((c) => c.enabled && c.status !== 'failed' && !p.excludedAdapters.includes(c.adapter) && !(p.neverFree && c.kind === 'free'));
    return [...ok.filter((c) => c.kind === 'subscription'), ...ok.filter((c) => c.kind !== 'subscription')];
  }

  async picker(userId: string): Promise<PickerItem[]> {
    const favorites = ((await this.q('SELECT models FROM model_favorites WHERE user_id=$1', [userId]))[0]?.models ?? []) as string[];
    const seen = new Map<string, PickerItem>();
    for (const c of await this.candidates(userId)) for (const model of c.models) {
      const key = `${c.adapter}:${model}`;
      if (seen.has(key)) continue;
      const entry = this.catalog.models.find((m) => m.adapter === c.adapter && m.model === model);
      const badge = badgeOf(c.kind); const fav = favorites.indexOf(key);
      seen.set(key, { key, adapter: c.adapter, model, displayName: entry?.displayName ?? model, efforts: entry?.efforts ?? [], badge, connectionId: c.id, tooltip: `${badgeLabel[badge]} via ${c.label}`, favorite: fav < 0 ? null : fav + 1, shortcut: fav < 0 ? null : `Alt+${fav + 1}` });
    }
    return [...seen.values()];
  }
  /** Up to nine `adapter:model` keys; position n is bound to Alt+n (⌥n on macOS). */
  async setFavorites(userId: string, models: unknown): Promise<PickerItem[]> {
    const available = new Set((await this.picker(userId)).map((i) => i.key));
    if (!Array.isArray(models) || models.length > 9 || new Set(models).size !== models.length || models.some((m) => typeof m !== 'string' || !available.has(m))) throw new ApiFailure('ValidationFailed', 'models must list up to 9 distinct picker keys (adapter:model)');
    await this.q('INSERT INTO model_favorites (user_id,models) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET models=EXCLUDED.models', [userId, JSON.stringify(models)]);
    return (await this.picker(userId)).filter((i) => i.favorite).sort((a, b) => a.favorite! - b.favorite!);
  }

  /** The pinned connection's key for the thread's machine; every run re-resolves the pin, so a disabled, deleted, failing or excluded pin fails the run (no fallback). */
  async connectionEnv(threadId: string): Promise<Record<string, string>> {
    const [t] = await this.q('SELECT owner_id, engine FROM threads WHERE id=$1', [threadId]);
    if (!t?.engine?.connectionId) return {};
    const sel = await this.resolve(t.owner_id, t.engine);
    const [r] = await this.q('SELECT id, adapter, env_var, sealed_key, base_url FROM model_connections WHERE id=$1', [sel.connectionId]);
    if (!r) return {};
    const auth = this.manifests.find((m) => m.id === r.adapter)?.auth.find((a) => a.kind === 'api-key');
    const baseUrlVar = auth?.kind === 'api-key' ? auth.baseUrlEnvVar : undefined;
    return { ...(r.sealed_key && r.env_var ? { [r.env_var]: this.kms.open(r.sealed_key, aad(r.id)).toString('utf8') } : {}), ...(r.base_url && baseUrlVar ? { [baseUrlVar]: r.base_url } : {}) };
  }
}

/** Adds the thread's pinned connection key to the secrets the runner prepares (and scrubs). */
export function withConnectionKeys(vault: Pick<SecretsStore, 'mutate' | 'prepare'>, store = modelsCatalogStore()): Pick<SecretsStore, 'mutate' | 'prepare'> {
  return {
    mutate: (...args) => vault.mutate(...args),
    prepare: async (threadId) => { const p = await vault.prepare(threadId); return { ...p, env: { ...p.env, ...(await store.connectionEnv(threadId)) } }; }
  };
}

const stores = new Map<string, ModelsCatalogStore>();
export function modelsCatalogStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): ModelsCatalogStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new ModelsCatalogStore(databaseUrl, [fakeAdapter.manifest, claudeCodeAdapter.manifest, codexAdapter.manifest])));
  return store;
}

type PolicyRow = Record<string, any>;
export type RunOutOutcome = { switchedTo: string } | { approvalId: string };
const badge = (k: Connection['kind']): ModelBadge => (k === 'subscription' ? 'subscription' : k === 'free' ? 'free' : 'key');

/** Model list, background-model resolution and the run-out policy (pause and ask by default). */
export class ModelPolicyApi {
  constructor(readonly store: ModelsCatalogStore = modelsCatalogStore()) {}

  /** CAPY-336/484: one row per adapter:model across the user's usable connections, connections listed in run order. */
  async models(userId: string): Promise<ModelListItem[]> {
    const rows = new Map<string, ModelListItem>();
    for (const c of await this.store.candidates(userId)) for (const model of c.models) {
      const id = `${c.adapter}:${model}`;
      const e = this.store.catalog.models.find((m) => m.adapter === c.adapter && m.model === model);
      const row = rows.get(id) ?? { id, adapter: c.adapter, model, displayName: e?.displayName ?? model, contextWindow: e?.contextWindow ?? null, efforts: e?.efforts ?? [], free: e?.free ?? false, zdr: e?.zdr ?? false, connections: [] };
      row.connections.push({ id: c.id, label: c.label, badge: badge(c.kind) });
      rows.set(id, row);
    }
    return [...rows.values()];
  }

  /** CAPY-338: background requests (titles, summaries) use the user's background model, else the thread's own; never a hosted account. */
  async background(userId: string, threadEngine: unknown): Promise<ResolvedSelection> {
    const sel = (await this.store.policy(userId)).background ?? threadEngine;
    if (!sel) throw new ApiFailure('ValidationFailed', 'no background model: set one in your model policy or pass the thread engine');
    return this.store.resolve(userId, sel);
  }

  /** The next connection after the thread's current one in run order offering the same model, else the free models; never wraps around. */
  private async next(ownerId: string, engine: ModelSelection): Promise<{ connection: Connection; engine: ModelSelection } | null> {
    const order = await this.store.candidates(ownerId);
    const after = order.slice(order.findIndex((c) => c.id === engine.connectionId) + 1);
    const same = after.find((c) => c.adapter === engine.adapter && (!engine.model || c.models.includes(engine.model)));
    if (same) return { connection: same, engine: { ...engine, connectionId: same.id } };
    const free = after.find((c) => c.kind === 'free');
    return free ? { connection: free, engine: { adapter: free.adapter, model: null, effort: null, connectionId: free.id } } : null;
  }

  /** CAPY-333: called when a run ends with `run_out`. Switches per policy, otherwise opens a Wait/Use card. */
  async onRunOut(threadId: string): Promise<RunOutOutcome> {
    const [t] = await this.store.q('SELECT owner_id, engine FROM threads WHERE id=$1', [threadId]);
    const policy = await this.store.policy(t.owner_id);
    const found = await this.next(t.owner_id, t.engine);
    // CAPY-481: moving onto the free models always asks (never a silent downgrade); an admin can forbid it entirely.
    const [org] = await this.store.q(`SELECT run_out_free FROM usage_settings WHERE id='org'`).catch(() => []);
    const next = found?.connection.kind === 'free' && org?.run_out_free === 'never' ? null : found;
    if (next && next.connection.kind !== 'free' && (policy.runOut === 'keep-going' || policy.runOut === 'ask-before-free')) {
      await this.store.q('UPDATE threads SET engine=$2 WHERE id=$1', [threadId, JSON.stringify(next.engine)]);
      return { switchedTo: next.connection.id };
    }
    const approvalId = `apr_${randomBytes(10).toString('base64url')}`;
    const options = [{ id: 'wait', label: 'Wait' }, ...(next ? [{ id: 'use', label: `Use ${next.connection.label}`, engine: next.engine }] : [])];
    await this.store.q(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,'run-out',$3,$4,true,'open')`,
      [approvalId, threadId, `${t.engine.adapter}${t.engine.model ? `:${t.engine.model}` : ''} ran out on its connection; wait for it to reset${next ? ` or use ${next.connection.label}` : ''}`, JSON.stringify(options)]);
    await this.store.q(`UPDATE threads SET needs_you=needs_you || $2::jsonb WHERE id=$1`, [threadId, JSON.stringify([approvalId])]);
    return { approvalId };
  }

  /** Answering `use` re-pins the thread to the offered connection (re-resolved, so a since-disabled connection fails). */
  async answer(approval: PolicyRow, optionId: string): Promise<void> {
    await this.store.q(`UPDATE threads SET needs_you=needs_you - $2::text WHERE id=$1`, [approval.thread_id, approval.id]);
    if (optionId !== 'use') return;
    const opt = (approval.options as PolicyRow[]).find((o) => o.id === 'use');
    if (!opt) throw new ApiFailure('ValidationFailed', 'no connection to continue on');
    if (opt.engine?.connectionId === 'free' && (await this.store.q(`SELECT run_out_free FROM usage_settings WHERE id='org'`).catch(() => []))[0]?.run_out_free === 'never') return;
    const [t] = await this.store.q('SELECT owner_id FROM threads WHERE id=$1', [approval.thread_id]);
    const r = await this.store.resolve(t.owner_id, opt.engine);
    await this.store.q('UPDATE threads SET engine=$2 WHERE id=$1', [approval.thread_id, JSON.stringify({ adapter: r.adapter, model: r.model, effort: r.effort, connectionId: r.connectionId, ...(r.contextWindow ? { contextWindow: r.contextWindow } : {}) })]);
  }

  /** `/wait` and `/continue` typed into the thread answer its open run-out card. */
  async slash(threadId: string, userId: string, text: string): Promise<{ approvalId: string; optionId: 'wait' | 'use' } | null> {
    const cmd = text.trim();
    if (cmd !== '/wait' && cmd !== '/continue') return null;
    const [a] = await this.store.q(`SELECT a.id, a.options FROM approvals a JOIN threads t ON t.id=a.thread_id WHERE a.thread_id=$1 AND t.owner_id=$2 AND a.kind='run-out' AND a.state='open' ORDER BY a.id DESC LIMIT 1`, [threadId, userId]);
    if (!a) throw new ApiFailure('NotFound', 'no open run-out card on this thread');
    if (cmd === '/continue' && !(a.options as PolicyRow[]).some((o) => o.id === 'use')) throw new ApiFailure('ValidationFailed', 'no connection to continue on');
    return { approvalId: a.id, optionId: cmd === '/wait' ? 'wait' : 'use' };
  }
}

let api: ModelPolicyApi | null = null;
export const modelPolicyApi = () => (api ??= new ModelPolicyApi());
