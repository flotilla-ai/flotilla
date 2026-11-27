import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { migrate } from '../db/migrate.js';
import { ApiFailure } from '../api-platform/types.js';
import { CARDS, DEFAULT_LIMITS, DriveFailure, MOUNT_MAX_BYTES, MOUNT_ROOT, parsePath, scopeDir, scopeId, skillName, tar, untar, type DriveFailureCard, type DriveItem, type DriveLimits, type DriveMount, type DriveScope, type DriveSource, type DriveUsage, type DriveVersion } from './types.js';

type Row = Record<string, any>;
type MountDriver = { copyIn?(id: string, dir: string, tar: Buffer): Promise<void>; copyOut?(id: string, path: string, maxBytes?: number): Promise<Buffer> };
export type DriveRunCtx = { thread: Row; containerId: string; driver: unknown };
export interface DriveThreadView { mounts: DriveMount[]; instructions: { scope: DriveScope; path: string; sha256: string }[]; skills: { scope: DriveScope; name: string; path: string }[] }

const toScope = (kind: string, id: string): DriveScope => kind === 'org' ? { kind } : kind === 'project-user' ? { kind, id: id.split(':')[0], userId: id.split(':')[1] } : { kind: kind as 'user', id };
const toItem = (r: Row): DriveItem => ({ id: r.id, parentId: r.parent_id, scope: toScope(r.scope_kind, r.scope_id), path: r.path, name: r.name, type: r.type, blobSha256: r.blob_sha256, size: Number(r.size), version: r.version, mountIntoThreads: r.mount_into_threads, updatedAt: r.updated_at.toISOString() });
const toVersion = (r: Row): DriveVersion => ({ version: r.version, sha256: r.sha256, size: Number(r.size), at: r.at.toISOString(), by: r.by, source: r.source });
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const gib = (n: number) => `${(n / 1024 ** 3).toFixed(2)} GiB`;
const rel = (dir: string) => dir.slice('/run/'.length);

export class DriveStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  /** What each container was given, so write-back only saves the thread's own edits. */
  private readonly mounted = new Map<string, DriveMount[]>();
  constructor(private readonly databaseUrl: string, readonly dir = process.env.FLOTILLA_DRIVE_DIR ?? '/data/drive', readonly limits: DriveLimits = DEFAULT_LIMITS) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = [], client: pg.Pool | pg.PoolClient = this.pool): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await client.query(sql, params)).rows;
  }
  private blob(sha: string) { return join(this.dir, sha.slice(0, 2), sha); }

  /** Org: everyone reads, admins write. Personal: that user. Project, Project+personal, Captain: their owner. Automation: admins (automations have no owner yet). */
  async access(userId: string, scope: DriveScope, write = false): Promise<void> {
    const admin = (await this.q('SELECT role FROM users WHERE id=$1', [userId]))[0]?.role === 'admin';
    if (scope.kind === 'org') { if (write && !admin) throw new ApiFailure('Forbidden', 'only admins can change the organization Drive'); return; }
    const ok = scope.kind === 'user' ? scope.id === userId
      : scope.kind === 'automation' ? admin
      : scope.kind === 'captain' ? !!(await this.q(`SELECT 1 FROM threads WHERE id=$1 AND owner_id=$2 AND role='captain'`, [scope.id, userId]))[0]
      : (scope.kind === 'project' || scope.userId === userId) && !!(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [scope.id, userId]))[0];
    if (!ok) throw new ApiFailure('NotFound', 'drive not found');
  }
  async scopes(userId: string): Promise<DriveUsage[]> {
    const admin = (await this.q('SELECT role FROM users WHERE id=$1', [userId]))[0]?.role === 'admin';
    const scopes: DriveScope[] = [{ kind: 'org' }, { kind: 'user', id: userId }];
    for (const p of await this.q('SELECT id FROM projects WHERE owner_id=$1 ORDER BY id', [userId])) scopes.push({ kind: 'project', id: p.id }, { kind: 'project-user', id: p.id, userId });
    for (const c of await this.q(`SELECT id FROM threads WHERE owner_id=$1 AND role='captain' ORDER BY id`, [userId])) scopes.push({ kind: 'captain', id: c.id });
    if (admin) for (const a of await this.q(`SELECT DISTINCT scope_id FROM drive_items WHERE scope_kind='automation' ORDER BY scope_id`)) scopes.push({ kind: 'automation', id: a.scope_id });
    return Promise.all(scopes.map((s) => this.usage(s)));
  }
  async usage(scope: DriveScope, client?: pg.PoolClient): Promise<DriveUsage> {
    const [r] = await this.q(`SELECT COALESCE(sum(v.size),0)::text AS used FROM drive_versions v JOIN drive_items i ON i.id=v.item_id WHERE i.scope_kind=$1 AND i.scope_id=$2`, [scope.kind, scopeId(scope)], client);
    const usedBytes = Number(r.used);
    return { scope, usedBytes, limitBytes: this.limits.quotaBytes, full: usedBytes >= this.limits.quotaBytes };
  }
  async list(scope: DriveScope, parent?: string): Promise<DriveItem[]> {
    const parentId = parent ? (await this.q(`SELECT id FROM drive_items WHERE scope_kind=$1 AND scope_id=$2 AND path=$3 AND type='folder'`, [scope.kind, scopeId(scope), parent]))[0]?.id : null;
    if (parent && !parentId) return [];
    return (await this.q(`SELECT * FROM drive_items WHERE scope_kind=$1 AND scope_id=$2 AND parent_id IS NOT DISTINCT FROM $3 ORDER BY type DESC, name`, [scope.kind, scopeId(scope), parentId])).map(toItem);
  }
  async item(userId: string, id: string, write = false): Promise<DriveItem> {
    const [r] = await this.q('SELECT * FROM drive_items WHERE id=$1', [id]);
    if (!r) throw new ApiFailure('NotFound', 'drive item not found');
    const item = toItem(r); await this.access(userId, item.scope, write);
    return item;
  }
  async content(item: DriveItem): Promise<Buffer> {
    if (!item.blobSha256) throw new ApiFailure('NotFound', 'folders have no content');
    return readFile(this.blob(item.blobSha256));
  }

  /** Content-addressed blob in the files volume plus a Postgres version row; no git. */
  async save(scope: DriveScope, path: string, data: Buffer, opts: { by: string; source: DriveSource; baseVersion?: number; upload?: boolean }): Promise<DriveItem> {
    if (opts.upload && data.length > this.limits.uploadBytes) throw new DriveFailure(CARDS.upload_too_large(path));
    if (data.length > this.limits.fileBytes) throw new DriveFailure(CARDS.file_too_large(path));
    await this.q('SELECT 1');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`drive:${scope.kind}:${scopeId(scope)}`]);
      const [prior] = (await client.query(`SELECT * FROM drive_items WHERE scope_kind=$1 AND scope_id=$2 AND path=$3`, [scope.kind, scopeId(scope), path])).rows;
      if (prior?.type === 'folder') throw new ApiFailure('Conflict', `${path} is a folder`);
      if (opts.baseVersion !== undefined && (prior?.version ?? 0) !== opts.baseVersion) throw new ApiFailure('Conflict', `${path} changed since version ${opts.baseVersion}`);
      const { usedBytes } = await this.usage(scope, client);
      if (usedBytes + data.length > this.limits.quotaBytes) throw new DriveFailure(CARDS.drive_full(`${gib(usedBytes)} of ${gib(this.limits.quotaBytes)} used`));
      let parentId: string | null = null; const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const [f]: Row[] = (await client.query(`INSERT INTO drive_items (id,scope_kind,scope_id,parent_id,path,name,type) VALUES ($1,$2,$3,$4,$5,$6,'folder')
          ON CONFLICT (scope_kind,scope_id,path) DO UPDATE SET path=EXCLUDED.path RETURNING id,type`, [`drv_${randomBytes(10).toString('base64url')}`, scope.kind, scopeId(scope), parentId, parts.slice(0, i).join('/'), parts[i - 1]])).rows;
        if (f.type !== 'folder') throw new ApiFailure('Conflict', `${parts.slice(0, i).join('/')} is a file`);
        parentId = f.id;
      }
      const sha = sha256(data); const file = this.blob(sha);
      await mkdir(dirname(file), { recursive: true }); const tmp = `${file}.${randomBytes(4).toString('hex')}`; await writeFile(tmp, data); await rename(tmp, file);
      const [row] = (prior
        ? await client.query(`UPDATE drive_items SET blob_sha256=$2,size=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`, [prior.id, sha, data.length])
        : await client.query(`INSERT INTO drive_items (id,scope_kind,scope_id,parent_id,path,name,type,blob_sha256,size,version) VALUES ($1,$2,$3,$4,$5,$6,'file',$7,$8,1) RETURNING *`, [`drv_${randomBytes(10).toString('base64url')}`, scope.kind, scopeId(scope), parentId, path, parts.at(-1), sha, data.length])).rows;
      await client.query('INSERT INTO drive_versions (item_id,version,sha256,size,by,source) VALUES ($1,$2,$3,$4,$5,$6)', [row.id, row.version, sha, data.length, opts.by, opts.source]);
      await client.query('COMMIT');
      return toItem(row);
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }
  async remove(item: DriveItem): Promise<void> { await this.q('DELETE FROM drive_items WHERE id=$1', [item.id]); }
  async versions(item: DriveItem): Promise<DriveVersion[]> { return (await this.q('SELECT * FROM drive_versions WHERE item_id=$1 ORDER BY version DESC', [item.id])).map(toVersion); }
  async restore(item: DriveItem, version: number, by: string): Promise<DriveItem> {
    const [v] = await this.q('SELECT sha256 FROM drive_versions WHERE item_id=$1 AND version=$2', [item.id, version]);
    if (!v) throw new ApiFailure('NotFound', 'version not found');
    return this.save(item.scope, item.path, await readFile(this.blob(v.sha256)), { by, source: 'restore' });
  }

  async ownedThread(userId: string, threadId: string): Promise<Row> {
    const [t] = await this.q('SELECT * FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]);
    if (!t) throw new ApiFailure('NotFound', 'thread not found');
    return t;
  }
  /** Org, the owner's personal Drive, the project's and the owner's project+personal Drive, and a Captain's own Drive. */
  async view(thread: Row): Promise<DriveThreadView> {
    const owner = thread.owner_id as string;
    const admin = (await this.q('SELECT role FROM users WHERE id=$1', [owner]))[0]?.role === 'admin';
    const scopes: [DriveScope, boolean][] = [[{ kind: 'org' }, admin], [{ kind: 'user', id: owner }, true]];
    if (thread.project_id) {
      const own = !!(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [thread.project_id, owner]))[0];
      scopes.push([{ kind: 'project', id: thread.project_id }, own], [{ kind: 'project-user', id: thread.project_id, userId: owner }, own]);
    }
    if (thread.role === 'captain') scopes.push([{ kind: 'captain', id: thread.id }, true]);
    const out: DriveThreadView = { mounts: [], instructions: [], skills: [] };
    for (const [scope, writable] of scopes) {
      const dir = scopeDir(scope);
      const files = (await this.q(`SELECT path,blob_sha256,version FROM drive_items WHERE scope_kind=$1 AND scope_id=$2 AND type='file' AND mount_into_threads ORDER BY path`, [scope.kind, scopeId(scope)])).map((r) => ({ path: r.path as string, sha256: r.blob_sha256 as string, version: r.version as number }));
      out.mounts.push({ scope, dir, writable, files });
      for (const f of files) {
        if (f.path === 'AGENTS.md') out.instructions.push({ scope, path: `${dir}/AGENTS.md`, sha256: f.sha256 });
        const name = skillName(f.path); if (name) out.skills.push({ scope, name, path: `${dir}/${f.path}` });
      }
    }
    return out;
  }
  /** One tar per Drive; folders (and writable Drive roots, even empty) are explicit `node`-owned entries so the agent can add files. */
  private async archive(mounts: DriveMount[], name: (m: DriveMount, path: string) => string): Promise<{ tars: Buffer[]; skipped: number }> {
    let total = 0; let skipped = 0; const tars: Buffer[] = [];
    for (const m of mounts) {
      const files: { name: string; data: Buffer }[] = [];
      for (const f of m.files) { const data = await readFile(this.blob(f.sha256)); if (total + data.length > MOUNT_MAX_BYTES) { skipped++; continue; } total += data.length; files.push({ name: name(m, f.path), data }); }
      if (!files.length && !m.writable) continue;
      const dirs = new Set<string>();
      for (const n of [`${name(m, '')}x`, ...files.map((f) => f.name)]) { const parts = n.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join('/')}/`); }
      tars.push(tar([...[...dirs].sort().map((d) => ({ name: d, data: Buffer.alloc(0) })), ...files]));
    }
    return { tars, skipped };
  }
  /** Copies the thread's Drives to `/run/flotilla/drive/<scope>` and returns the prompt note (AGENTS.md text, skills). A failure opens a card; the run continues. */
  async mount({ thread, containerId, driver }: DriveRunCtx): Promise<string> {
    try {
      const v = await this.view(thread);
      const copyIn = (driver as MountDriver).copyIn; if (!copyIn) throw new Error('the machine driver cannot receive files');
      const { tars, skipped } = await this.archive(v.mounts, (m, p) => `${rel(m.dir)}/${p}`);
      for (const t of tars) await copyIn.call(driver, containerId, '/run', t);
      if (this.mounted.size > 1000) this.mounted.delete(this.mounted.keys().next().value!);
      this.mounted.set(containerId, v.mounts);
      const writable = v.mounts.filter((m) => m.writable).map((m) => m.dir);
      const parts = [`Drive files are in ${MOUNT_ROOT}/<scope>. Files you create or change in ${writable.join(', ')} are saved to Drive when this run ends.`];
      for (const i of v.instructions) parts.push(`Drive instructions (${i.path}):\n${(await readFile(this.blob(i.sha256))).toString('utf8').slice(0, 64 * 1024)}`);
      if (v.skills.length) parts.push(`Drive skills:\n${v.skills.map((s) => `- ${s.name}: ${s.path}`).join('\n')}`);
      if (skipped) parts.push(`${skipped} Drive files were not copied (more than ${MOUNT_MAX_BYTES} bytes).`);
      return parts.join('\n\n');
    } catch (err) {
      await this.card(thread.id, CARDS.mount_failed((err as Error).message)).catch(() => undefined);
      return '';
    }
  }
  /** Saves files the run created or changed in writable Drives as versions by the thread (autosave, no commit). Deletions are not synced. */
  async writeBack({ thread, containerId, driver }: DriveRunCtx): Promise<DriveItem[]> {
    const copyOut = (driver as MountDriver).copyOut; if (!copyOut) return [];
    const mounted = this.mounted.get(containerId); this.mounted.delete(containerId);
    let entries: { name: string; data: Buffer }[];
    try { entries = untar(await copyOut.call(driver, containerId, MOUNT_ROOT, MOUNT_MAX_BYTES)); }
    catch (err) { if (mounted) await this.card(thread.id, CARDS.save_failed(`${MOUNT_ROOT}: ${(err as Error).message}`)).catch(() => undefined); return []; }
    const current = await this.view(thread); const base = mounted ?? current.mounts;
    const saved: DriveItem[] = []; const failed = new Map<string, DriveFailureCard>();
    for (const e of entries) {
      const [, dir, ...rest] = e.name.split('/');
      const m = current.mounts.find((x) => x.dir === `${MOUNT_ROOT}/${dir}`); if (!m?.writable || !rest.length) continue;
      let path: string; try { path = parsePath(rest.join('/')); } catch { continue; }
      const was = base.find((x) => x.dir === m.dir)?.files.find((f) => f.path === path);
      if (was?.sha256 === sha256(e.data)) continue;
      try { saved.push(await this.save(m.scope, path, e.data, { by: thread.id, source: 'agent', baseVersion: was?.version ?? 0 })); }
      catch (err) { const card = err instanceof DriveFailure ? err.card : CARDS.save_failed(`${m.dir}/${path}: ${(err as Error).message}`); failed.set(card.code, card); }
    }
    for (const card of failed.values()) await this.card(thread.id, card).catch(() => undefined);
    return saved;
  }
  /** A point-in-time archive for a machine that keeps its own copy (unpack into `~/.flotilla/drive`); nothing syncs afterwards. */
  async localCopy(thread: Row): Promise<Buffer> {
    const { tars } = await this.archive((await this.view(thread)).mounts, (m, p) => `${m.dir.slice(MOUNT_ROOT.length + 1)}/${p}`);
    return Buffer.concat([...tars.map((t) => t.subarray(0, t.length - 1024)), Buffer.alloc(1024)]);
  }
  /** A non-blocking request card (phase2-06 cards read `approvals`); the title says what failed and the next step. */
  async card(threadId: string, card: DriveFailureCard): Promise<void> {
    await this.q(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail) VALUES ($1,$2,'decision',$3,$4,false,'open',$5)`,
      [`apr_${randomBytes(10).toString('base64url')}`, threadId, `${card.title}. ${card.nextStep}`, JSON.stringify([{ id: 'ok', label: 'OK' }]), JSON.stringify({ drive: card })]);
  }
}

let singleton: DriveStore | undefined;
export function driveStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): DriveStore {
  return (singleton ??= new DriveStore(databaseUrl));
}
