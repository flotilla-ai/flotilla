import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createCaptainsRoute } from '../routes/captains.route.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono;
const call = async (method: string, path: string, body?: unknown, user = 'usr_c') => { const r = await app.request(`http://local/api/v1/captains${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) as any }; };
const thread = async (id: string, over: Record<string, unknown> = {}) => pool.query(`INSERT INTO threads (id,code,project_id,role,parent_id,crew_of,owner_id,title,status,engine,machine_id,prs,budget,spent) VALUES ($1,$1,$2,$3,$4,$5,'usr_c',$6,'idle',$7,$8,$9,'{}','{}')`, [id, over.projectId ?? 'prj_c', over.role ?? 'thread', over.parentId ?? null, over.crewOf ?? null, over.title ?? id, JSON.stringify(over.engine ?? { adapter: 'fake', model: 'm' }), over.machineId ?? null, JSON.stringify(over.prs ?? [])]);
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_c','c@x','member'),('usr_o','o@x','member')`);
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_c','usr_c','one','{}','untrusted','{}'),('prj_x','usr_c','two','{}','untrusted','{}')`);
  app = new Hono(); app.use('*', async (c, next) => { c.set('userId' as never, c.req.header('x-user') as never); await next(); }); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err))); app.route('/api/v1/captains', createCaptainsRoute(pool).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });

it('CAPY-068/073/074/075/088/090: promote preserves the thread and crew membership enforces project/ownership rules with release/archive', async () => {
  await thread('thr_cap', { title: 'Original', machineId: 'machine-1', prs: [{ number: 4 }], engine: { adapter: 'fake', model: 'kept' } });
  const promoted = await call('POST', '/promote', { threadId: 'thr_cap' });
  expect(promoted.status).toBe(201); expect(promoted.json).toMatchObject({ id: 'thr_cap', role: 'captain', owner_id: 'usr_c', machine_id: 'machine-1' });
  expect(promoted.json.engine).toMatchObject({ model: 'kept' }); expect(promoted.json.prs).toEqual([{ number: 4 }]);
  await thread('thr_crew'); await thread('thr_other_project', { projectId: 'prj_x' }); await thread('thr_sub', { parentId: 'thr_crew' }); await thread('thr_other_owner');
  await pool.query(`UPDATE threads SET owner_id='usr_o' WHERE id='thr_other_owner'`);
  expect((await call('POST', '/thr_cap/crew/thr_crew')).status).toBe(201);
  expect((await call('POST', '/thr_cap/crew/thr_crew')).status).toBe(200);
  for (const [target, error] of [['thr_other_project', 'same project'], ['thr_sub', 'subagent'], ['thr_other_owner', 'owner'], ['thr_cap', 'itself']] as const) {
    const r = await call('POST', `/thr_cap/crew/${target}`); expect(r.status).toBe(409); expect(r.json.error).toContain(error);
  }
  await thread('thr_captain2', { role: 'captain' }); expect((await call('POST', '/thr_cap/crew/thr_captain2')).status).toBe(409);
  await thread('thr_race'); await thread('thr_cap2');
  expect((await call('POST', '/promote', { threadId: 'thr_cap2' })).status).toBe(201);
  expect((await call('POST', '/thr_cap/crew/thr_race')).status).toBe(201);
  expect((await call('POST', '/thr_cap2/crew/thr_race')).status).toBe(409);
  expect((await pool.query(`SELECT crew_of FROM threads WHERE id='thr_race'`)).rows[0].crew_of).toBe('thr_cap');
  expect((await call('POST', '/promote', { threadId: 'thr_race' })).status).toBe(409);
  expect((await call('POST', '/thr_cap/crew/thr_crew', undefined, 'usr_o')).status).toBe(404);
  expect((await call('POST', '/thr_cap/crew/thr_crew/archive')).status).toBe(200);
  expect((await pool.query(`SELECT status,archived_at,archived_from FROM threads WHERE id='thr_crew'`)).rows[0]).toMatchObject({ status: 'archived', archived_from: 'idle' });
  expect((await pool.query(`SELECT archived_at FROM threads WHERE id='thr_crew'`)).rows[0].archived_at).toBeTruthy();
  expect((await call('DELETE', '/thr_cap/crew/thr_crew')).status).toBe(204);
  expect((await pool.query(`SELECT crew_of FROM threads WHERE id='thr_crew'`)).rows[0].crew_of).toBeNull();
});
