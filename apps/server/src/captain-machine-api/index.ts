import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export interface CaptainProfile { captainId: string; alias: string | null; photo: { kind: 'none' | 'upload' | 'library'; libraryId?: string }; purpose: string }
export interface CaptainPlacement { crewRunsOn: 'pool' | 'device'; deviceId: string | null; threadMachines: Record<string, string> }
export interface CaptainSummary { id: string; title: string; projectId: string | null; purpose: string; alias: string | null; photo: unknown; crewRunsOn: string; maxConcurrentCrew: number }
export const CAPTAIN_PHOTO_LIBRARY = [
  { id: 'captain-compass', label: 'Compass' },
  { id: 'captain-anchor', label: 'Anchor' },
  { id: 'captain-helm', label: 'Helm' }
] as const;
type Row = Record<string, any>;
const rows = async (pool: pg.Pool, sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as Row[];
const one = async (pool: pg.Pool, sql: string, params: unknown[] = []) => (await rows(pool, sql, params))[0];
const summary = (r: Row): CaptainSummary => ({ id: r.id, title: r.title, projectId: r.project_id ?? null, purpose: r.purpose, alias: r.alias ?? null, photo: r.photo, crewRunsOn: r.crew_runs_on, maxConcurrentCrew: r.max_concurrent_crew });

/** Captain profile, placement metadata, photos and crew-centric REST reads/writes. */
export class CaptainMachineApiStore {
  constructor(readonly pool: pg.Pool) {}
  async owned(userId: string, captainId: string): Promise<Row> {
    const r = await one(this.pool, `SELECT t.*,c.purpose,c.crew_runs_on,c.max_concurrent_crew,c.drive_root,c.digest_md,c.hook_bundle,c.wake_policy,c.alias,c.photo,c.crew_device_id,c.machine_placement FROM threads t JOIN captains c ON c.thread_id=t.id WHERE t.id=$1 AND t.role='captain' AND t.owner_id=$2`, [captainId, userId]);
    if (!r) throw new ApiFailure('NotFound', 'captain not found');
    return r;
  }
  async accessible(userId: string, captainId: string): Promise<Row> {
    const r = await one(this.pool, `SELECT t.*,c.purpose,c.crew_runs_on,c.max_concurrent_crew,c.drive_root,c.digest_md,c.hook_bundle,c.wake_policy,c.alias,c.photo,c.crew_device_id,c.machine_placement FROM threads t JOIN captains c ON c.thread_id=t.id WHERE t.id=$1 AND t.role='captain' AND (t.owner_id=$2 OR EXISTS(SELECT 1 FROM captain_shares s WHERE s.captain_id=t.id AND (s.subject_type='org' OR (s.subject_type='user' AND s.subject_id=$2))))`, [captainId, userId]);
    if (!r) throw new ApiFailure('NotFound', 'captain not found');
    return r;
  }
  async list(userId: string): Promise<CaptainSummary[]> {
    return (await rows(this.pool, `SELECT DISTINCT t.*,c.purpose,c.crew_runs_on,c.max_concurrent_crew,c.alias,c.photo FROM threads t JOIN captains c ON c.thread_id=t.id LEFT JOIN captain_shares s ON s.captain_id=t.id WHERE t.role='captain' AND t.status<>'archived' AND (t.owner_id=$1 OR s.subject_type='org' OR (s.subject_type='user' AND s.subject_id=$1)) ORDER BY t.created_at`, [userId])).map(summary);
  }
  async crew(userId: string, captainId: string): Promise<Row[]> {
    await this.accessible(userId, captainId);
    return rows(this.pool, `SELECT id,code,title,status,machine_id,crew_of,project_id,created_at,updated_at FROM threads WHERE crew_of=$1 ORDER BY created_at LIMIT 500`, [captainId]);
  }
  async digest(userId: string, captainId: string): Promise<{ captainId: string; digestMd: string }> {
    const r = await this.accessible(userId, captainId);
    return { captainId, digestMd: String(r.digest_md ?? '') };
  }
  async profile(userId: string, captainId: string): Promise<CaptainProfile> {
    const r = await this.accessible(userId, captainId);
    return { captainId, alias: r.alias ?? null, photo: r.photo, purpose: r.purpose };
  }
  async updateProfile(userId: string, captainId: string, input: { alias?: unknown }): Promise<CaptainProfile> {
    await this.owned(userId, captainId);
    if (input.alias !== undefined && input.alias !== null && (typeof input.alias !== 'string' || input.alias.length > 80)) throw new ApiFailure('ValidationFailed', 'alias must be a string of at most 80 characters');
    if (input.alias !== undefined) await this.pool.query('UPDATE captains SET alias=$2 WHERE thread_id=$1', [captainId, input.alias === null ? null : String(input.alias).trim() || null]);
    return this.profile(userId, captainId);
  }
  async setLibraryPhoto(userId: string, captainId: string, libraryId: string): Promise<CaptainProfile> {
    await this.owned(userId, captainId);
    if (!CAPTAIN_PHOTO_LIBRARY.some((x) => x.id === libraryId)) throw new ApiFailure('ValidationFailed', 'unknown Captain photo library item');
    await this.pool.query(`UPDATE captains SET photo=$2 WHERE thread_id=$1`, [captainId, JSON.stringify({ kind: 'library', libraryId })]);
    await this.pool.query('DELETE FROM captain_photos WHERE captain_id=$1', [captainId]);
    return this.profile(userId, captainId);
  }
  async uploadPhoto(userId: string, captainId: string, contentType: string, content: Buffer): Promise<CaptainProfile> {
    await this.owned(userId, captainId);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) throw new ApiFailure('ValidationFailed', 'photo must be png, jpeg or webp');
    if (!content.length || content.length > 1024 * 1024) throw new ApiFailure('ValidationFailed', 'photo must be 1 byte to 1 MiB');
    await this.pool.query('INSERT INTO captain_photos (captain_id,content_type,content) VALUES ($1,$2,$3) ON CONFLICT (captain_id) DO UPDATE SET content_type=$2,content=$3,updated_at=now()', [captainId, contentType, content]);
    await this.pool.query(`UPDATE captains SET photo='{"kind":"upload"}'::jsonb WHERE thread_id=$1`, [captainId]);
    return this.profile(userId, captainId);
  }
  async photo(userId: string, captainId: string): Promise<{ contentType: string; content: Buffer } | null> {
    await this.owned(userId, captainId);
    const r = await one(this.pool, 'SELECT content_type,content FROM captain_photos WHERE captain_id=$1', [captainId]);
    return r ? { contentType: r.content_type, content: r.content } : null;
  }
  async placement(userId: string, captainId: string): Promise<CaptainPlacement> {
    const r = await this.owned(userId, captainId);
    return { crewRunsOn: r.crew_runs_on === 'device' ? 'device' : 'pool', deviceId: r.crew_device_id ?? null, threadMachines: (r.machine_placement?.threadMachines ?? {}) as Record<string, string> };
  }
  async setPlacement(userId: string, captainId: string, input: Record<string, unknown>): Promise<CaptainPlacement> {
    await this.owned(userId, captainId);
    const mode = String(input.crewRunsOn ?? 'pool');
    if (!['pool', 'device'].includes(mode)) throw new ApiFailure('ValidationFailed', 'crewRunsOn must be pool or device');
    if (mode === 'device') throw new ApiFailure('Conflict', 'paired devices are not available yet');
    const threadMachines = input.threadMachines && typeof input.threadMachines === 'object' && !Array.isArray(input.threadMachines) ? Object.fromEntries(Object.entries(input.threadMachines as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {};
    for (const threadId of Object.keys(threadMachines)) {
      const t = await one(this.pool, 'SELECT id FROM threads WHERE id=$1 AND crew_of=$2', [threadId, captainId]);
      if (!t) throw new ApiFailure('ValidationFailed', 'threadMachines keys must be crew threads');
    }
    await this.pool.query(`UPDATE captains SET crew_runs_on='pool',crew_device_id=NULL,machine_placement=$2 WHERE thread_id=$1`, [captainId, JSON.stringify({ threadMachines })]);
    return this.placement(userId, captainId);
  }
}
