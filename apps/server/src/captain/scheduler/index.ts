import { randomBytes } from 'node:crypto';
import type pg from 'pg';

export type CrewEvent = { kind: string; payload?: { status?: string; state?: string }; at?: string };

export function triage(events: CrewEvent[]): { wake: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const e of events) {
    if (e.kind === 'budget.warning' || e.kind === 'budget.exceeded' || e.kind === 'kernel.denied') reasons.push(e.kind);
    else if (e.kind === 'crew.status' && ['done', 'needs-decision', 'blocked', 'failed', 'resolved'].includes(e.payload?.status ?? '')) reasons.push(String(e.payload?.status));
    else if (e.kind === 'run.ended' && ['completed', 'failed'].includes(e.payload?.state ?? '')) reasons.push(`run.${e.payload?.state}`);
  }
  return { wake: reasons.length > 0, reasons };
}

export function coalesceWake(lastWakeMs: number | null, nowMs: number, windowMs = 30_000): boolean {
  return lastWakeMs === null || nowMs - lastWakeMs >= windowMs;
}
export function heartbeatInterval(idleCycles: number): number {
  return Math.min(600 * 2 ** Math.max(0, idleCycles), 7200);
}
export function digestMd(needs: string[], news: string[], active: string[]): string {
  return `## Needs you\n${needs.map((x) => `- ${x}`).join('\n')}\n\n## New\n${news.map((x) => `- ${x}`).join('\n')}\n\n## In progress\n${active.map((x) => `- ${x}`).join('\n')}\n`;
}

const id = () => `wake_${randomBytes(8).toString('hex')}`;
const mergeReasons = (existing: unknown, added: string[]): string[] => [...new Set([...(Array.isArray(existing) ? existing.map(String) : []), ...added])];

export type SchedulerDeps = { pool: pg.Pool; wake(captainId: string, prompt: string): Promise<void>; now?: () => number };

export class CaptainScheduler {
  constructor(readonly deps: SchedulerDeps) {}
  now() { return this.deps.now?.() ?? Date.now(); }

  async handleCrewEvent(captainId: string, event: CrewEvent): Promise<boolean> {
    const t = triage([event]);
    if (!t.wake) return false;
    const state = (await this.deps.pool.query('SELECT last_wake_at FROM captain_scheduler_state WHERE captain_id=$1', [captainId])).rows[0];
    const last = state?.last_wake_at ? new Date(state.last_wake_at).getTime() : null;
    const dueAt = coalesceWake(last, this.now()) ? this.now() : (last ?? this.now()) + 30_000;

    const pending = (await this.deps.pool.query(
      `SELECT id,reasons FROM captain_wakes WHERE captain_id=$1 AND kind='event' AND processed_at IS NULL ORDER BY created_at LIMIT 1`,
      [captainId]
    )).rows[0];
    const insertWake = async () => this.deps.pool.query(
      'INSERT INTO captain_wakes (id,captain_id,kind,due_at,reasons) VALUES ($1,$2,$3,to_timestamp($4/1000.0),$5)',
      [id(), captainId, 'event', dueAt, JSON.stringify(t.reasons)]
    );
    if (pending) {
      const updated = await this.deps.pool.query(
        'UPDATE captain_wakes SET reasons=$2 WHERE id=$1 AND processed_at IS NULL',
        [pending.id, JSON.stringify(mergeReasons(pending.reasons, t.reasons))]
      );
      if ((updated as { rowCount?: number }).rowCount === 0) await insertWake();
    } else {
      await insertWake();
    }
    await this.deps.pool.query('INSERT INTO captain_scheduler_state (captain_id) VALUES ($1) ON CONFLICT DO NOTHING', [captainId]);
    await this.refreshDigest(captainId);
    return true;
  }

  async scheduleHeartbeat(captainId: string, idleCycles = 0): Promise<void> {
    const existing = (await this.deps.pool.query(
      `SELECT 1 FROM captain_wakes WHERE captain_id=$1 AND kind='heartbeat' AND processed_at IS NULL LIMIT 1`,
      [captainId]
    )).rows[0];
    if (existing) return;
    const due = this.now() + heartbeatInterval(idleCycles) * 1000;
    await this.deps.pool.query('INSERT INTO captain_wakes (id,captain_id,kind,due_at,idle_cycles) VALUES ($1,$2,$3,to_timestamp($4/1000.0),$5)', [id(), captainId, 'heartbeat', due, idleCycles]);
  }

  async pollDue(): Promise<number> {
    const rows = await this.deps.pool.query(
      'SELECT * FROM captain_wakes WHERE processed_at IS NULL AND due_at<=to_timestamp($1/1000.0) ORDER BY due_at',
      [this.now()]
    );
    let delivered = 0;
    for (const wake of rows.rows) {
      const reasons = Array.isArray(wake.reasons) ? wake.reasons.map(String) : [];
      await this.refreshDigest(wake.captain_id);
      await this.deps.wake(wake.captain_id, await this.wakePrompt(wake.captain_id, wake.kind === 'heartbeat' ? ['heartbeat'] : reasons));
      const claimed = await this.deps.pool.query(
        'UPDATE captain_wakes SET processed_at=to_timestamp($1/1000.0) WHERE id=$2 AND processed_at IS NULL AND reasons=$3::jsonb',
        [this.now(), wake.id, JSON.stringify(reasons)]
      );
      if ((claimed as { rowCount?: number }).rowCount === 0) continue;
      await this.deps.pool.query(
        'INSERT INTO captain_scheduler_state (captain_id,last_wake_at) VALUES ($1,to_timestamp($2/1000.0)) ON CONFLICT (captain_id) DO UPDATE SET last_wake_at=to_timestamp($2/1000.0)',
        [wake.captain_id, this.now()]
      );
      if (wake.kind === 'heartbeat') {
        const resets = await this.deps.pool.query(
          `SELECT count(*)::int n FROM captain_wakes WHERE captain_id=$1 AND kind='event' AND created_at>$2`,
          [wake.captain_id, wake.created_at]
        );
        await this.scheduleHeartbeat(wake.captain_id, Number(resets.rows[0]?.n ?? 0) > 0 ? 0 : Number(wake.idle_cycles) + 1);
      }
      delivered++;
    }
    return delivered;
  }

  async refreshDigest(captainId: string): Promise<{ ids: string[]; md: string }> {
    const approvals = (await this.deps.pool.query(
      `SELECT a.id,a.question FROM approvals a LEFT JOIN threads t ON t.id=a.thread_id WHERE a.state='open' AND (a.thread_id=$1 OR t.crew_of=$1) ORDER BY a.id`,
      [captainId]
    )).rows;
    const crew = (await this.deps.pool.query('SELECT title,status FROM threads WHERE crew_of=$1 ORDER BY created_at', [captainId])).rows;
    const ids = approvals.map((x: { id: string }) => x.id);
    const md = digestMd(
      approvals.map((x: { question: string }) => x.question),
      crew.filter((x: { status: string }) => x.status === 'queued').map((x: { title: string }) => x.title),
      crew.filter((x: { status: string }) => ['working', 'paused'].includes(x.status)).map((x: { title: string }) => x.title)
    );
    await this.deps.pool.query('UPDATE captains SET digest_md=$2 WHERE thread_id=$1', [captainId, md]);
    await this.deps.pool.query('UPDATE threads SET needs_you=$2 WHERE id=$1', [captainId, JSON.stringify(ids)]);
    return { ids, md };
  }

  async wakePrompt(captainId: string, reasons: string[]): Promise<string> {
    const row = (await this.deps.pool.query('SELECT t.title,c.purpose,c.digest_md FROM threads t JOIN captains c ON c.thread_id=t.id WHERE t.id=$1', [captainId])).rows[0] ?? {};
    const crew = (await this.deps.pool.query('SELECT title,status FROM threads WHERE crew_of=$1 ORDER BY created_at', [captainId])).rows;
    return `Captain purpose: ${row.purpose ?? row.title ?? ''}\nDigest:\n${row.digest_md ?? ''}\nCrew state:\n${crew.map((x: { title: string; status: string }) => `- ${x.title}: ${x.status}`).join('\n')}\nWake reasons: ${reasons.join(', ')}`;
  }
}
