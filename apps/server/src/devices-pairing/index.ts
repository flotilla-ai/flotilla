import { createHash, randomBytes } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export type DeviceTrust = 'pending' | 'trusted' | 'revoked';
export type DeviceStatus = 'never-connected' | 'online' | 'asleep' | 'offline';
export type WorkspacePolicy = { kind: 'new-worktree' } | { kind: 'existing-worktree'; path: string } | { kind: 'current-checkout'; path: string };
export interface ProjectFolderLink { path: string; remote: string; projectId?: string | null }
export interface DeviceSettings { keepAwakeWhileRunning: boolean; cloudCheckpoints: boolean; moveToCloudWhenOffline: boolean }
export interface PairedDevice {
  id: string; ownerId: string; name: string; platform: string; trust: DeviceTrust; status: DeviceStatus;
  workspacePolicy: WorkspacePolicy; projectFolders: ProjectFolderLink[]; settings: DeviceSettings;
  machineMetering: 'none'; lastSeenAt: string | null; waitUntil: string | null; createdAt: string;
}
export interface DevicePairing { id: string; code: string; expiresAt: string }
type Row = Record<string, any>;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const rid = (p: string) => `${p}_${randomBytes(10).toString('hex')}`;
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : v ? String(v) : null;
const validPath = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 4096 && !v.includes('\0');

function workspacePolicy(raw: unknown): WorkspacePolicy {
  const x = (raw ?? { kind: 'new-worktree' }) as Record<string, unknown>;
  if (x.kind === 'new-worktree') return { kind: 'new-worktree' };
  if ((x.kind === 'existing-worktree' || x.kind === 'current-checkout') && validPath(x.path)) return { kind: x.kind, path: String(x.path) };
  throw new ApiFailure('ValidationFailed', 'workspacePolicy must be new-worktree, existing-worktree or current-checkout');
}
function settings(raw: unknown, base: DeviceSettings = { keepAwakeWhileRunning: false, cloudCheckpoints: true, moveToCloudWhenOffline: false }): DeviceSettings {
  const x = (raw ?? {}) as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => v === undefined ? d : v === true;
  if ((x.keepAwakeWhileRunning !== undefined && typeof x.keepAwakeWhileRunning !== 'boolean') || (x.cloudCheckpoints !== undefined && typeof x.cloudCheckpoints !== 'boolean') || (x.moveToCloudWhenOffline !== undefined && typeof x.moveToCloudWhenOffline !== 'boolean')) throw new ApiFailure('ValidationFailed', 'device settings must be booleans');
  return { keepAwakeWhileRunning: bool(x.keepAwakeWhileRunning, base.keepAwakeWhileRunning), cloudCheckpoints: bool(x.cloudCheckpoints, base.cloudCheckpoints), moveToCloudWhenOffline: bool(x.moveToCloudWhenOffline, base.moveToCloudWhenOffline) };
}
function folderLinks(raw: unknown): ProjectFolderLink[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 100) throw new ApiFailure('ValidationFailed', 'projectFolders must be an array of at most 100 links');
  return raw.map((x) => {
    const f = x as Record<string, unknown>;
    if (!validPath(f.path) || typeof f.remote !== 'string' || !/^(https?|ssh):\/\/[^\s]+$|^[\w.-]+@[\w.-]+:.+/.test(f.remote)) throw new ApiFailure('ValidationFailed', 'each project folder needs a path and git remote');
    return { path: String(f.path), remote: String(f.remote), projectId: f.projectId == null ? null : String(f.projectId) };
  });
}
const toDevice = (r: Row, now = new Date()): PairedDevice => {
  const seen = r.last_seen_at ? new Date(r.last_seen_at) : null;
  const stale = seen && now.getTime() - seen.getTime() > 120_000;
  const status = r.trust === 'revoked' ? 'offline' : stale && r.status === 'online' ? 'offline' : r.status;
  const waitBase = seen ?? new Date(r.created_at);
  return { id: r.id, ownerId: r.owner_id, name: r.name, platform: r.platform, trust: r.trust, status, workspacePolicy: r.workspace_policy, projectFolders: r.project_folders ?? [], settings: r.settings, machineMetering: 'none', lastSeenAt: iso(r.last_seen_at), waitUntil: new Date(waitBase.getTime() + 24 * 60 * 60_000).toISOString(), createdAt: iso(r.created_at)! };
};

/** Pairing, trust, status, workspace policy and folder metadata for BYO runner devices. */
export class DevicesPairingStore {
  private readonly pool: pg.Pool;
  constructor(readonly databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> { return (await this.pool.query(sql, params)).rows; }
  async createPairing(ownerId: string): Promise<DevicePairing> {
    const code = randomBytes(9).toString('base64url');
    const id = rid('dpc'); const expires = new Date(Date.now() + 10 * 60_000);
    await this.q('INSERT INTO device_pairing_codes (id,owner_id,code_hash,expires_at) VALUES ($1,$2,$3,$4)', [id, ownerId, sha256(code), expires]);
    return { id, code, expiresAt: expires.toISOString() };
  }
  async claimPairing(code: string, input: { name?: unknown; platform?: unknown }): Promise<{ device: PairedDevice; token: string }> {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 || typeof input.platform !== 'string' || !/^[a-z0-9._-]{2,40}$/i.test(input.platform)) throw new ApiFailure('ValidationFailed', 'device name and platform are required');
    const rows = await this.q(`UPDATE device_pairing_codes SET claimed_at=now() WHERE code_hash=$1 AND claimed_at IS NULL AND expires_at>now() RETURNING owner_id`, [sha256(code)]);
    if (!rows[0]) throw new ApiFailure('Forbidden', 'invalid or expired pairing code');
    const token = randomBytes(24).toString('base64url'); const id = rid('dev');
    const [r] = await this.q('INSERT INTO paired_devices (id,owner_id,name,platform,token_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *', [id, rows[0].owner_id, input.name.trim(), input.platform, sha256(token)]);
    return { device: toDevice(r), token };
  }
  async list(ownerId: string): Promise<PairedDevice[]> { return (await this.q('SELECT * FROM paired_devices WHERE owner_id=$1 ORDER BY created_at', [ownerId])).map((r) => toDevice(r)); }
  async owned(ownerId: string, id: string): Promise<Row> {
    const [r] = await this.q('SELECT * FROM paired_devices WHERE id=$1 AND owner_id=$2', [id, ownerId]);
    if (!r) throw new ApiFailure('NotFound', 'device not found');
    return r;
  }
  async update(ownerId: string, id: string, input: Record<string, unknown>): Promise<PairedDevice> {
    await this.owned(ownerId, id);
    const ws = input.workspacePolicy === undefined ? null : JSON.stringify(workspacePolicy(input.workspacePolicy));
    const prefs = input.settings === undefined ? null : JSON.stringify(settings(input.settings, {} as DeviceSettings));
    const folders = input.projectFolders === undefined ? null : JSON.stringify(folderLinks(input.projectFolders));
    if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80)) throw new ApiFailure('ValidationFailed', 'invalid device name');
    const [r] = await this.q(`UPDATE paired_devices SET name=COALESCE($2,name),workspace_policy=COALESCE($3::jsonb,workspace_policy),
      settings=CASE WHEN $4::jsonb IS NULL THEN settings ELSE settings || $4::jsonb END,project_folders=COALESCE($5::jsonb,project_folders),updated_at=now()
      WHERE id=$1 RETURNING *`, [id, input.name == null ? null : String(input.name).trim(), ws, prefs, folders]);
    return toDevice(r);
  }
  async approve(ownerId: string, id: string): Promise<PairedDevice> {
    const [r] = await this.q(`UPDATE paired_devices SET trust='trusted',updated_at=now() WHERE id=$1 AND owner_id=$2 AND trust='pending' RETURNING *`, [id, ownerId]);
    if (!r) throw new ApiFailure('NotFound', 'pending device not found');
    return toDevice(r);
  }
  async revoke(ownerId: string, id: string): Promise<PairedDevice> {
    const [r] = await this.q(`UPDATE paired_devices SET trust='revoked',revoked_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2 AND trust<>'revoked' RETURNING *`, [id, ownerId]);
    if (!r) throw new ApiFailure('NotFound', 'active device not found');
    return toDevice(r);
  }
  async deviceByToken(token: string): Promise<Row> {
    const [r] = await this.q(`SELECT * FROM paired_devices WHERE token_hash=$1 AND trust<>'revoked'`, [sha256(token)]);
    if (!r) throw new ApiFailure('Forbidden', 'invalid device token');
    return r;
  }
  async heartbeat(token: string, status: 'online' | 'asleep' | 'offline'): Promise<PairedDevice> {
    if (!['online','asleep','offline'].includes(status)) throw new ApiFailure('ValidationFailed', 'invalid device status');
    const d = await this.deviceByToken(token);
    const [r] = await this.q(`UPDATE paired_devices SET status=$2,last_seen_at=now(),updated_at=now() WHERE id=$1 AND trust<>'revoked' RETURNING *`, [d.id, status]);
    if (!r) throw new ApiFailure('Forbidden', 'invalid device token');
    return toDevice(r);
  }
  async reportFolders(token: string, folders: unknown): Promise<PairedDevice> {
    if (!Array.isArray(folders)) throw new ApiFailure('ValidationFailed', 'folders must be an array');
    const d = await this.deviceByToken(token); const links = folderLinks(folders);
    const [r] = await this.q(`UPDATE paired_devices SET project_folders=$2,last_seen_at=now(),updated_at=now() WHERE id=$1 AND trust<>'revoked' RETURNING *`, [d.id, JSON.stringify(links)]);
    if (!r) throw new ApiFailure('Forbidden', 'invalid device token');
    return toDevice(r);
  }
  machinePicker(ownerId: string): Promise<{ items: unknown[] }> {
    return this.list(ownerId).then((devices) => ({ items: [{ kind: 'cloud', id: 'cloud', label: 'Flotilla cloud' }, ...devices.filter((d) => d.trust === 'trusted').map((d) => ({ kind: 'device', id: d.id, label: d.name, platform: d.platform, status: d.status, machineMetering: d.machineMetering, workspacePolicy: d.workspacePolicy }))] }));
  }
  async close(): Promise<void> { await this.pool.end(); }
}

/** Recursively scan a local folder fixture for git clones and extract their origin remotes. Device runners use the same shape in scan reports. */
export async function scanGitFolders(root: string, maxDepth = 4): Promise<ProjectFolderLink[]> {
  const out: ProjectFolderLink[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.name === '.git')) {
      try {
        const config = await readFile(join(dir, '.git', 'config'), 'utf8').catch(async () => await stat(join(dir, '.git')).then(() => ''));
        const match = config.match(/\[remote "origin"\]\s*\n\s*url\s*=\s*([^\n]+)/);
        if (match) out.push({ path: dir, remote: match[1].trim(), projectId: null });
      } catch { /* unreadable clone metadata is omitted */ }
      return;
    }
    await Promise.all(entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map((e) => walk(join(dir, e.name), depth + 1)));
  }
  await walk(root, 0);
  return out;
}

const stores = new Map<string, DevicesPairingStore>();
export function devicesPairingStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): DevicesPairingStore {
  let s = stores.get(databaseUrl); if (!s) stores.set(databaseUrl, (s = new DevicesPairingStore(databaseUrl)));
  return s;
}
