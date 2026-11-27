import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

export interface Captain { id: string; ownerId: string; projectId: string | null; purpose: string; maxConcurrentCrew: number }
export interface CrewMembership { captainId: string; threadId: string; projectId: string | null }
export interface CrewRefusal { reason: 'owner' | 'same project' | 'subagent' | 'captain' | 'crew' | 'itself' | 'not found' }
export interface CaptainPromotion { threadId: string; captainId: string; preserved: ['history', 'prs', 'machine', 'model', 'members'] }

type Row = Record<string, any>;
const one = async (pool: pg.Pool, sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0] as Row | undefined;

export async function promoteCaptain(pool: pg.Pool, userId: string, threadId: string): Promise<Row> {
  const t = await one(pool, 'SELECT * FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]);
  if (!t) throw new ApiFailure('NotFound', 'thread not found');
  if (t.role !== 'thread' || t.parent_id || t.crew_of) throw new ApiFailure('Conflict', 'only an uncrewed root thread can be promoted');
  await pool.query(`UPDATE threads SET role='captain',updated_at=now() WHERE id=$1`, [threadId]);
  await pool.query(`INSERT INTO captains (thread_id,purpose,crew_runs_on,max_concurrent_crew,digest_md,wake_policy) VALUES ($1,$2,'pool',5,'',$3) ON CONFLICT (thread_id) DO NOTHING`, [threadId, t.title, JSON.stringify({ heartbeatSec: [600, 7200], coalesceSec: 30 })]);
  return (await one(pool, 'SELECT * FROM threads WHERE id=$1', [threadId]))!;
}

export async function crewRefusal(pool: pg.Pool, userId: string, captainId: string, threadId: string): Promise<CrewRefusal['reason'] | null> {
  const c = await one(pool, `SELECT * FROM threads WHERE id=$1 AND role='captain' AND owner_id=$2`, [captainId, userId]);
  const t = await one(pool, 'SELECT * FROM threads WHERE id=$1', [threadId]);
  if (!c || !t) return 'not found';
  if (threadId === captainId) return 'itself';
  if (t.owner_id !== userId) return 'owner';
  if ((t.project_id ?? null) !== (c.project_id ?? null)) return 'same project';
  if (t.parent_id) return 'subagent';
  if (t.role !== 'thread') return 'captain';
  if (t.crew_of && t.crew_of !== captainId) return 'crew';
  return null;
}

export async function addCrew(pool: pg.Pool, userId: string, captainId: string, threadId: string): Promise<CrewMembership & { existing: boolean }> {
  const reason = await crewRefusal(pool, userId, captainId, threadId);
  if (reason === 'not found') throw new ApiFailure('NotFound', 'captain or thread not found');
  if (reason) throw new ApiFailure('Conflict', `crew refusal: must have same owner and same project; not a subagent/Captain, not itself, and only one crew (${reason})`);
  const t = (await one(pool, 'SELECT project_id,crew_of FROM threads WHERE id=$1', [threadId]))!;
  const existing = t.crew_of === captainId;
  if (!existing) await pool.query('UPDATE threads SET crew_of=$2,updated_at=now() WHERE id=$1', [threadId, captainId]);
  return { captainId, threadId, projectId: t.project_id ?? null, existing };
}

export async function archiveCrew(pool: pg.Pool, userId: string, captainId: string, threadId: string): Promise<void> {
  const r = await pool.query(`UPDATE threads SET archived_from=status,status='archived',archived_at=now(),updated_at=now() WHERE id=$1 AND crew_of=$2 AND status IN ('idle','failed','waiting') AND EXISTS (SELECT 1 FROM threads c WHERE c.id=$2 AND c.owner_id=$3)`, [threadId, captainId, userId]);
  if (!r.rowCount) throw new ApiFailure('Conflict', 'only a finished crew thread can be archived by its Captain');
}
