import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export type CommitIdentity = 'you-capy-coauthor' | 'you' | 'capy-you' | 'capy';
export interface GitHubAccount { id: string; userId: string; login: string; kind: 'personal' | 'organization'; tokenRef: string | null; commitIdentity: CommitIdentity; commitEmail: string | null; revokedAt: string | null }
export interface GitHubInstallation { id: string; accountId: string; installationId: string; subject: string; repositories: string[]; permissions: Record<string, string>; dependencyReader: boolean; revokedAt: string | null }
export interface PermissionSet { contents: string; pullRequests: string; checks: string; issues: string; metadata: string }
export const REQUIRED_PERMISSIONS: PermissionSet = { contents: 'write', pullRequests: 'write', checks: 'read', issues: 'write', metadata: 'read' };
const IDENTITIES: CommitIdentity[] = ['you-capy-coauthor', 'you', 'capy-you', 'capy'];
const id = (p: string) => `${p}_${randomBytes(6).toString('hex')}`;
const camel = (r: Record<string, any>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, x) => x.toUpperCase()), v]));
function externalTokenRef(value: unknown): string | null {
  if (value == null) return null;
  const ref = String(value).trim();
  if (!/^(vault|secret):[A-Za-z0-9][A-Za-z0-9._/-]{2,127}$/.test(ref)) throw new ApiFailure('ValidationFailed', 'tokenRef must be an external vault reference such as vault:github/token; token values are never stored');
  return ref;
}

export function permissionsSufficient(actual: Record<string, string>, required: PermissionSet = REQUIRED_PERMISSIONS): string[] {
  const rank: Record<string, number> = { none: 0, read: 1, write: 2, admin: 3 };
  return Object.entries(required).filter(([k, need]) => (rank[actual[k] ?? 'none'] ?? 0) < rank[need]).map(([k]) => k);
}

export class GitHubIntegrationStore {
  constructor(readonly pool: pg.Pool) {}
  async connect(userId: string, input: { login?: unknown; kind?: unknown; tokenRef?: unknown; commitIdentity?: unknown; commitEmail?: unknown }): Promise<GitHubAccount> {
    const login = String(input.login ?? '').trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38})$/.test(login)) throw new ApiFailure('ValidationFailed', 'login must be a GitHub login');
    const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
    const kind = has('kind') ? input.kind : 'personal'; if (kind !== 'personal' && kind !== 'organization') throw new ApiFailure('ValidationFailed', 'kind must be personal or organization');
    const identity = has('commitIdentity') ? input.commitIdentity : 'you-capy-coauthor'; if (!IDENTITIES.includes(identity as CommitIdentity)) throw new ApiFailure('ValidationFailed', 'invalid commit identity');
    const email = !has('commitEmail') || input.commitEmail == null ? null : String(input.commitEmail); if (email && !/^[^@\s]+@[^@\s]+$/.test(email)) throw new ApiFailure('ValidationFailed', 'invalid commit email');
    const tokenRef = !has('tokenRef') ? null : externalTokenRef(input.tokenRef);
    const existing = (await this.pool.query('SELECT * FROM github_accounts WHERE user_id=$1 AND login=$2', [userId, login])).rows[0];
    if (existing) {
      const sets = ['revoked_at=NULL']; const values: unknown[] = [existing.id];
      const set = (column: string, value: unknown) => { values.push(value); sets.push(`${column}=$${values.length}`); };
      if (has('kind')) set('kind', kind);
      if (has('tokenRef')) set('token_ref', tokenRef);
      if (has('commitIdentity')) set('commit_identity', identity);
      if (has('commitEmail')) set('commit_email', email);
      await this.pool.query(`UPDATE github_accounts SET ${sets.join(',')} WHERE id=$1`, values);
    } else {
      await this.pool.query('INSERT INTO github_accounts (id,user_id,login,kind,token_ref,commit_identity,commit_email) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id('gha'), userId, login, kind, tokenRef, identity, email]);
    }
    return (await this.pool.query('SELECT * FROM github_accounts WHERE user_id=$1 AND login=$2', [userId, login])).rows.map(camel)[0] as GitHubAccount;
  }
  async accounts(userId: string): Promise<GitHubAccount[]> { return (await this.pool.query('SELECT * FROM github_accounts WHERE user_id=$1 AND revoked_at IS NULL ORDER BY login', [userId])).rows.map(camel) as GitHubAccount[]; }
  async account(id: string, userId: string): Promise<Record<string, any>> { const r = (await this.pool.query('SELECT * FROM github_accounts WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [id, userId])).rows[0]; if (!r) throw new ApiFailure('NotFound', 'GitHub account not found'); return r; }
  async install(userId: string, accountId: string, input: Record<string, unknown>): Promise<GitHubInstallation> {
    await this.account(accountId, userId);
    const installationId = String(input.installationId ?? '').trim(); const subject = String(input.subject ?? '').trim();
    if (!installationId || !subject) throw new ApiFailure('ValidationFailed', 'installationId and subject are required');
    const permissions = (input.permissions ?? {}) as Record<string, string>;
    const missing = permissionsSufficient(permissions); if (missing.length) throw new ApiFailure('ValidationFailed', `installation is missing required permissions: ${missing.join(', ')}`);
    const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
    const repositories = Array.isArray(input.repositories) ? input.repositories.map(String) : [];
    const dependencyReader = input.dependencyReader === true;
    const iid = id('ghi');
    await this.pool.query(`INSERT INTO github_installations (id,account_id,installation_id,subject,repositories,permissions,dependency_reader) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (account_id,installation_id) DO UPDATE SET revoked_at=NULL,subject=EXCLUDED.subject,permissions=EXCLUDED.permissions${has('repositories') ? ',repositories=EXCLUDED.repositories' : ''}${has('dependencyReader') ? ',dependency_reader=EXCLUDED.dependency_reader' : ''}`, [iid, accountId, installationId, subject, JSON.stringify(repositories), JSON.stringify(permissions), dependencyReader]);
    return camel((await this.pool.query('SELECT * FROM github_installations WHERE account_id=$1 AND installation_id=$2', [accountId, installationId])).rows[0]) as GitHubInstallation;
  }
  async installations(userId: string, accountId: string): Promise<GitHubInstallation[]> { await this.account(accountId, userId); return (await this.pool.query('SELECT * FROM github_installations WHERE account_id=$1 AND revoked_at IS NULL ORDER BY subject', [accountId])).rows.map(camel) as GitHubInstallation[]; }
  async setIdentity(userId: string, accountId: string, identity: unknown, email?: unknown): Promise<GitHubAccount> {
    if (!IDENTITIES.includes(identity as CommitIdentity)) throw new ApiFailure('ValidationFailed', 'invalid commit identity');
    await this.account(accountId, userId);
    await this.pool.query('UPDATE github_accounts SET commit_identity=$3,commit_email=COALESCE($4,commit_email) WHERE id=$1 AND user_id=$2', [accountId, userId, identity, email == null ? null : String(email)]);
    return camel((await this.pool.query('SELECT * FROM github_accounts WHERE id=$1', [accountId])).rows[0]) as GitHubAccount;
  }
  async setPrIdentity(userId: string, repo: string, number: number, identity: unknown): Promise<{ repo: string; number: number; identity: CommitIdentity }> {
    if (!/^\S+\/\S+$/.test(repo) || !Number.isInteger(number) || number < 1) throw new ApiFailure('ValidationFailed', 'invalid pull request');
    if (!IDENTITIES.includes(identity as CommitIdentity)) throw new ApiFailure('ValidationFailed', 'invalid commit identity');
    const installations = (await this.pool.query(`SELECT i.repositories FROM github_installations i JOIN github_accounts a ON a.id=i.account_id WHERE a.user_id=$1 AND a.revoked_at IS NULL AND i.revoked_at IS NULL AND i.verified_at IS NOT NULL`, [userId])).rows;
    const wanted = repo.toLowerCase();
    const allowed = installations.some((r) => Array.isArray(r.repositories) && r.repositories.some((x: unknown) => String(x).toLowerCase() === wanted));
    if (!allowed) throw new ApiFailure('NotFound', 'pull request repository not found in an active installation');
    await this.pool.query('INSERT INTO github_pr_identities (repo,number,user_id,identity,updated_by) VALUES ($1,$2,$4,$3,$4) ON CONFLICT (repo,number,user_id) DO UPDATE SET identity=$3,updated_by=$4,updated_at=now()', [repo, number, identity, userId]);
    return { repo, number, identity: identity as CommitIdentity };
  }
  async unlink(userId: string, accountId: string, admin: boolean): Promise<void> {
    const q = admin ? 'UPDATE github_accounts SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL' : 'UPDATE github_accounts SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL';
    const r = await this.pool.query(q, admin ? [accountId] : [accountId, userId]);
    if (!r.rowCount) throw new ApiFailure('NotFound', 'GitHub account not found');
    await this.pool.query('UPDATE github_installations SET revoked_at=now() WHERE account_id=$1', [accountId]);
  }
}
