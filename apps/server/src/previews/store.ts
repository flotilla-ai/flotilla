import type pg from 'pg';
import { KEEP_AWAKE_MS, MAX_AWAKE_MS, type Preview } from './types.js';

export type PreviewRow = {
  thread_id: string; code: string; port: number; hostname: string | null; start_command: string | null;
  share_until: Date | null; share_revoked_at: Date | null; awake_since: Date | null; awake_until: Date | null;
};
const base = () => (process.env.FLOTILLA_PREVIEW_URL ?? 'http://localhost:8081').replace(/\/$/, '');
export const previewUrl = (code: string, port: number) => `${base()}/p/${encodeURIComponent(code)}/${port}/`;

export function keepAwake(now: number, since: Date | null, until: Date | null): { since: Date; until: Date } {
  const start = !since || !until || until.getTime() <= now ? now : since.getTime();
  return { since: new Date(start), until: new Date(Math.min(now + KEEP_AWAKE_MS, start + MAX_AWAKE_MS)) };
}

function toPreview(r: PreviewRow, now: number): Preview {
  const shared = !!r.share_until && r.share_until.getTime() > now;
  return {
    threadId: r.thread_id, code: r.code, port: r.port, hostname: r.hostname, startCommand: r.start_command,
    access: shared ? 'shared' : 'private', shareUntil: shared ? r.share_until!.toISOString() : null,
    awakeUntil: r.awake_until?.toISOString() ?? null,
    url: previewUrl(r.code, r.port), localUrl: `http://${r.hostname ?? `localhost:${r.port}`}/`
  };
}

export type PreviewStore = ReturnType<typeof previewStore>;
export function previewStore(pool: pg.Pool, now = () => Date.now()) {
  const sel = 'SELECT p.*, t.code FROM previews p JOIN threads t ON t.id = p.thread_id';
  const one = async (threadId: string, port: number) => (await pool.query<PreviewRow>(`${sel} WHERE p.thread_id=$1 AND p.port=$2`, [threadId, port])).rows[0] ?? null;
  return {
    now,
    async thread(id: string, ownerId: string) {
      return (await pool.query<{ id: string; code: string }>('SELECT id, code FROM threads WHERE id=$1 AND owner_id=$2', [id, ownerId])).rows[0] ?? null;
    },
    async list(threadId: string): Promise<Preview[]> {
      return (await pool.query<PreviewRow>(`${sel} WHERE p.thread_id=$1 ORDER BY p.port`, [threadId])).rows.map((r) => toPreview(r, now()));
    },
    async byCode(code: string, port: number): Promise<PreviewRow | null> {
      return (await pool.query<PreviewRow>(`${sel} WHERE t.code=$1 AND p.port=$2`, [code, port])).rows[0] ?? null;
    },
    async expose(threadId: string, port: number, p: { hostname: string | null; startCommand: string | null }): Promise<Preview> {
      await pool.query(`INSERT INTO previews (thread_id, port, hostname, start_command) VALUES ($1,$2,$3,$4)
        ON CONFLICT (thread_id, port) DO UPDATE SET hostname=EXCLUDED.hostname, start_command=EXCLUDED.start_command`, [threadId, port, p.hostname, p.startCommand]);
      return toPreview((await one(threadId, port))!, now());
    },
    async share(threadId: string, port: number, until: Date): Promise<boolean> {
      return !!(await pool.query('UPDATE previews SET share_until=GREATEST(COALESCE(share_until, $3), $3) WHERE thread_id=$1 AND port=$2', [threadId, port, until])).rowCount;
    },
    async revoke(threadId: string, port: number): Promise<Preview | null> {
      await pool.query('UPDATE previews SET share_until=NULL, share_revoked_at=$3 WHERE thread_id=$1 AND port=$2', [threadId, port, new Date(now())]);
      const r = await one(threadId, port);
      return r && toPreview(r, now());
    },
    async touch(r: PreviewRow): Promise<Date> {
      const next = keepAwake(now(), r.awake_since, r.awake_until);
      await pool.query('UPDATE previews SET awake_since=$3, awake_until=$4 WHERE thread_id=$1 AND port=$2', [r.thread_id, r.port, next.since, next.until]);
      return next.until;
    }
  };
}
