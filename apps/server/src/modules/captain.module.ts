import pg from 'pg';
import { CaptainScheduler } from '../captain/scheduler/index.js';
import { defaultRunner } from '../routes/threads.route.js';

export default {
  name: 'captain',
  async start() {
    if (process.env.FLOTILLA_CAPTAIN_SCHEDULER === '0') return async () => undefined;
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla' });
    const scheduler = new CaptainScheduler({
      pool,
      wake: async (id, text) => { await defaultRunner().message(id, text, 'queue'); }
    });
    const scan = async () => {
      await pool.query('INSERT INTO captain_scheduler_state (captain_id) SELECT thread_id FROM captains ON CONFLICT DO NOTHING');
      const captains = (await pool.query(
        `SELECT c.thread_id FROM captains c
         WHERE NOT EXISTS (
           SELECT 1 FROM captain_wakes w
           WHERE w.captain_id=c.thread_id AND w.kind='heartbeat' AND w.processed_at IS NULL
         )`
      )).rows;
      for (const c of captains) await scheduler.scheduleHeartbeat(c.thread_id, 0);

      // Events are durable. Restart recovery scans from the persisted high-water mark,
      // not merely from the few seconds before this process happened to start.
      const rows = (await pool.query(
        `SELECT e.kind,e.payload,e.at,e.at::text AS at_raw,t.crew_of
         FROM events e
         JOIN threads t ON t.id=e.thread_id
         LEFT JOIN captain_scheduler_state st ON st.captain_id=t.crew_of
         WHERE t.crew_of IS NOT NULL AND e.at > COALESCE(st.last_event_at, 'epoch'::timestamptz)
         ORDER BY e.at,e.seq
         LIMIT 200`
      )).rows;
      for (const row of rows) {
        await scheduler.handleCrewEvent(row.crew_of, { kind: row.kind, payload: row.payload });
        await pool.query('UPDATE captain_scheduler_state SET last_event_at=$2 WHERE captain_id=$1', [row.crew_of, row.at_raw]);
      }
      await scheduler.pollDue();
    };
    const timer = setInterval(() => { void scan().catch(() => undefined); }, 5_000);
    void scan().catch(() => undefined);
    return async () => { clearInterval(timer); await pool.end().catch(() => undefined); };
  }
};
