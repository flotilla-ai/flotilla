import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../../db/migrate.js';
import { CaptainScheduler, coalesceWake, digestMd, heartbeatInterval, triage } from './index.js';

const exec = promisify(execFile);
let container = '';
let pool: pg.Pool;
let databaseUrl = '';

async function docker(args: string[]): Promise<string> { return (await exec('docker', args)).stdout.trim(); }
async function waitPostgres(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try { await docker(['exec', container, 'pg_isready', '-U', 'postgres']); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  throw new Error('postgres did not become ready');
}
async function insertCaptain(id = 'cap_restart'): Promise<void> {
  await pool.query('INSERT INTO users (id,email,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', ['usr_sched', 'sched@example.invalid', 'admin']);
  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$2,NULL,'captain','usr_sched','captain','idle','{}','{}','{}')`, [id, 'FLO-SCH1']);
  await pool.query(`INSERT INTO captains (thread_id,purpose,crew_runs_on,max_concurrent_crew,digest_md,wake_policy) VALUES ($1,'purpose','pool',5,'','{}')`, [id]);
  await pool.query('INSERT INTO captain_scheduler_state (captain_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
}

beforeAll(async () => {
  container = await docker(['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16']);
  const portLine = await docker(['port', container, '5432/tcp']);
  databaseUrl = `postgres://postgres@127.0.0.1:${portLine.split(':').pop()}/postgres`;
  await waitPostgres();
  for (let i = 0; i < 40; i++) {
    try { const probe = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 }); await probe.connect(); await probe.end(); break; }
    catch (err) { if (i === 39) throw err; await new Promise((r) => setTimeout(r, 250)); }
  }
  await migrate(databaseUrl);
  pool = new pg.Pool({ connectionString: databaseUrl });
}, 120000);
afterAll(async () => { if (pool) await pool.end(); if (container) await docker(['rm', '-f', container]).catch(() => ''); }, 30000);

describe('captain scheduler pure policy', () => {
  it('triages coalesces and backs off', () => {
    expect(triage([{ kind: 'crew.status', payload: { status: 'done' } }]).wake).toBe(true);
    expect(triage([{ kind: 'crew.status', payload: { status: 'paused' } }]).wake).toBe(false);
    expect(triage([{ kind: 'kernel.denied' }]).wake).toBe(true);
    expect(coalesceWake(null, 1)).toBe(true);
    expect(coalesceWake(0, 10_000)).toBe(false);
    expect(heartbeatInterval(0)).toBe(600);
    expect(heartbeatInterval(10)).toBe(7200);
    for (const h of ['## Needs you', '## New', '## In progress']) expect(digestMd([], [], [])).toContain(h);
  });
});

describe('captain scheduler restart recovery', () => {
  it('persists event and heartbeat wakes across a restart with a fake clock', async () => {
    await insertCaptain();
    let now = 1_000;
    const firstWakes: string[][] = [];
    const first = new CaptainScheduler({ pool, now: () => now, wake: async (id, text) => { firstWakes.push([id, text]); } });
    expect(await first.handleCrewEvent('cap_restart', { kind: 'run.ended', payload: { state: 'completed' } })).toBe(true);
    expect(await first.handleCrewEvent('cap_restart', { kind: 'crew.status', payload: { status: 'blocked' } })).toBe(true);
    expect(firstWakes).toHaveLength(0);
    let pending = await pool.query(`SELECT * FROM captain_wakes WHERE captain_id='cap_restart' AND kind='event' AND processed_at IS NULL`);
    expect(pending.rows).toHaveLength(1);
    expect(pending.rows[0].reasons).toEqual(expect.arrayContaining(['run.completed', 'blocked']));

    // Simulate process death before pollDue. A fresh object has no in-memory state.
    const secondWakes: string[][] = [];
    const restarted = new CaptainScheduler({ pool, now: () => now, wake: async (id, text) => { secondWakes.push([id, text]); } });
    expect(await restarted.pollDue()).toBe(1);
    expect(secondWakes).toHaveLength(1);
    expect(secondWakes[0][1]).toContain('Wake reasons: run.completed');
    pending = await pool.query(`SELECT * FROM captain_wakes WHERE captain_id='cap_restart' AND kind='event' AND processed_at IS NULL`);
    expect(pending.rows).toHaveLength(0);

    now = 10_000;
    await restarted.scheduleHeartbeat('cap_restart', 0);
    now += 600_001;
    // Another restart after the heartbeat became due but before the scanner ran.
    const heartbeatWakes: string[][] = [];
    const restartedAgain = new CaptainScheduler({ pool, now: () => now, wake: async (id, text) => { heartbeatWakes.push([id, text]); } });
    expect(await restartedAgain.pollDue()).toBe(1);
    expect(heartbeatWakes).toHaveLength(1);
    const next = await pool.query(`SELECT * FROM captain_wakes WHERE captain_id='cap_restart' AND kind='heartbeat' AND processed_at IS NULL ORDER BY created_at DESC`);
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].idle_cycles).toBe(1);
  });
});
