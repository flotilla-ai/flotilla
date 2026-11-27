import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../db/migrate.js';
import { ApiFailure } from '../api-platform/types.js';
import { localKms, type Kms } from './vault.js';
import { ENV_NAME, MAX_VALUE_BYTES, isGitHubCredential, isReservedName, scopePrecedence, type EnvVarMutation, type PreparedSecrets, type SecretGrant, type SecretRef, type SecretScope } from './types.js';

type Row = Record<string, any>;
const aad = (scope: SecretScope, scopeId: string, name: string) => `${scope}:${scopeId}:${name}`;
const toRef = (r: Row): SecretRef => ({ name: r.name, scope: r.scope, configured: true, updatedAt: r.updated_at.toISOString(), updatedBy: r.updated_by });

/** Parses `[{ name, value }]` (set) or `names` (delete) from an API body; values are never echoed in errors. */
export function parseVariables(raw: unknown): EnvVarMutation[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 200) throw new ApiFailure('ValidationFailed', 'variables must be an array of { name, value } (max 200)');
  return raw.map((v: { name?: unknown; value?: unknown }) => {
    if (typeof v?.name !== 'string' || !ENV_NAME.test(v.name)) throw new ApiFailure('ValidationFailed', 'each variable needs a name matching [A-Za-z_][A-Za-z0-9_]*');
    if (typeof v.value !== 'string' || Buffer.byteLength(v.value) > MAX_VALUE_BYTES) throw new ApiFailure('ValidationFailed', `${v.name}: value must be a string up to 32 KiB`);
    if (isReservedName(v.name)) throw new ApiFailure('ValidationFailed', `${v.name}: name is reserved by Flotilla`);
    if (isGitHubCredential(v.name, v.value)) throw new ApiFailure('ValidationFailed', `${v.name}: GitHub tokens stay on the server and cannot be stored as env vars`);
    return { op: 'set', name: v.name, value: v.value };
  });
}
export function parseNames(raw: unknown): EnvVarMutation[] {
  const names = typeof raw === 'string' ? raw.split(',').filter(Boolean) : raw;
  if (!Array.isArray(names) || !names.length || names.some((n) => typeof n !== 'string' || !ENV_NAME.test(n))) throw new ApiFailure('ValidationFailed', 'names must list env var names');
  return names.map((name: string) => ({ op: 'delete', name }));
}

export class SecretsStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  private kmsInstance?: Kms;
  constructor(private readonly databaseUrl: string, private readonly kmsFactory: () => Kms = () => localKms()) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private get kms(): Kms { return (this.kmsInstance ??= this.kmsFactory()); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }
  private open(r: Row): string { return this.kms.open(r.sealed, aad(r.scope, r.scope_id, r.name)).toString('utf8'); }

  async ownedProject(userId: string, projectId: string): Promise<string> {
    if (!(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId]))[0]) throw new ApiFailure('NotFound', 'project not found');
    return projectId;
  }
  async ownedThread(userId: string, threadId: string): Promise<Row> {
    const [t] = await this.q('SELECT * FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]);
    if (!t) throw new ApiFailure('NotFound', 'thread not found');
    return t;
  }
  async list(scope: SecretScope, scopeId: string): Promise<SecretRef[]> {
    return (await this.q('SELECT name,scope,updated_at,updated_by FROM secrets WHERE scope=$1 AND scope_id=$2 ORDER BY name', [scope, scopeId])).map(toRef);
  }
  async mutate(scope: SecretScope, scopeId: string, mutations: EnvVarMutation[], actor: string): Promise<SecretRef[]> {
    for (const m of mutations) {
      if (m.op === 'delete') { await this.q('DELETE FROM secrets WHERE scope=$1 AND scope_id=$2 AND name=$3', [scope, scopeId, m.name]); continue; }
      const sealed = this.kms.seal(Buffer.from(m.value, 'utf8'), aad(scope, scopeId, m.name));
      await this.q(`INSERT INTO secrets (id,scope,scope_id,name,sealed,key_id,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (scope,scope_id,name) DO UPDATE SET sealed=EXCLUDED.sealed, key_id=EXCLUDED.key_id, updated_by=EXCLUDED.updated_by, updated_at=now()`,
      [`sec_${randomBytes(8).toString('hex')}`, scope, scopeId, m.name, sealed, this.kms.keyId, actor]);
    }
    return this.list(scope, scopeId);
  }

  /** The thread's effective rows: one per name, thread > personal (the thread owner's) > shared (project). */
  private async effective(threadId: string, columns: string): Promise<Row[]> {
    const [t] = await this.q('SELECT owner_id,project_id FROM threads WHERE id=$1', [threadId]);
    if (!t) return [];
    const rows = await this.q(`SELECT ${columns} FROM secrets WHERE (scope='thread' AND scope_id=$1) OR (scope='personal' AND scope_id=$2) OR (scope='project' AND scope_id=$3)`, [threadId, t.owner_id, t.project_id ?? '']);
    const best = new Map<string, Row>();
    for (const r of rows.sort((a, b) => scopePrecedence.indexOf(a.scope) - scopePrecedence.indexOf(b.scope))) if (!best.has(r.name)) best.set(r.name, r);
    return [...best.values()].filter((r) => !isGitHubCredential(r.name, '') && !isReservedName(r.name)).sort((a, b) => a.name.localeCompare(b.name));
  }
  /** Names and configured-state only; never decrypts. */
  async grants(threadId: string): Promise<SecretGrant[]> {
    return (await this.effective(threadId, 'name,scope')).map((r) => ({ threadId, name: r.name, scope: r.scope, configured: true }));
  }
  /** The only decrypt path: called by the runner while preparing a thread's machine. */
  async prepare(threadId: string): Promise<PreparedSecrets> {
    const rows = await this.effective(threadId, 'name,scope,scope_id,sealed');
    const env: Record<string, string> = {}; const grants: SecretGrant[] = [];
    for (const r of rows) {
      const value = this.open(r);
      if (isGitHubCredential(r.name, value)) continue;
      env[r.name] = value; grants.push({ threadId, name: r.name, scope: r.scope, configured: true });
    }
    return { env, grants };
  }
}

const stores = new Map<string, SecretsStore>();
export function secretsStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): SecretsStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new SecretsStore(databaseUrl)));
  return store;
}

export function tarFile(name: string, body: Buffer, mode: string): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100); h.write(`${mode}\0`, 100); h.write('0001750\0', 108); h.write('0001750\0', 116);
  h.write(body.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136); h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([h, body, Buffer.alloc((512 - (body.length % 512)) % 512)]);
}
/** `/run/flotilla/secrets.env` for `putArchive` at `/run`: outside the repo, owned by the thread user (uid 1000), mode 0600. */
export function secretsTar(env: Record<string, string>): Buffer {
  const body = Object.entries(env).map(([k, v]) => `export ${k}='${v.replace(/'/g, `'\\''`)}'\n`).join('');
  return Buffer.concat([tarFile('flotilla/secrets.env', Buffer.from(body), '0000600'), Buffer.alloc(1024)]);
}
