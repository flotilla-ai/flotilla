import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createCaptainsRoute } from '../routes/captains.route.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let app: Hono;
const madeThreads: Record<string, unknown>[] = [];
async function call(method: string, path: string, body?: unknown, raw?: Buffer) {
  const headers: Record<string, string> = { 'x-user': 'usr_cap' };
  if (raw) headers['content-type'] = 'image/png'; else if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await app.request(`http://local/api/v1/captains${path === '/' ? '' : path}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  return { status: r.status, json: await r.clone().json().catch(() => null) as any, buffer: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get('content-type') };
}
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_cap','cap@x','admin')`);
  await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget,code) VALUES ('prj_cap','usr_cap','Cap','{}','untrusted','{}','CAP')`);
  const createThread = async (input: Record<string, unknown>) => {
    madeThreads.push(input); const id = `thr_new${madeThreads.length}`;
    await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$1,$2,'thread',$3,$4,'idle','{}','{}','{}')`, [id, input.projectId, input.ownerId, input.title]);
    return { id, title: input.title };
  };
  app = new Hono(); app.use('*', async (c, next) => { c.set('userId' as never, 'usr_cap' as never); await next(); }); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.route('/api/v1/captains', createCaptainsRoute(pool, createThread as never, async () => undefined).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 5; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });

it('CAPY-094/492/493/555..561: Captain profile, photo, placement metadata and crew REST API', async () => {
  const created = await call('POST', '/', { projectId: 'prj_cap', title: 'Ops Captain', purpose: 'run ops', maxConcurrentCrew: 5 });
  expect(created.status).toBe(201); const captain = created.json;
  expect(captain.captain).toMatchObject({ purpose: 'run ops', crewRunsOn: 'pool', maxConcurrentCrew: 5 });
  expect((await call('POST', '/', { projectId: 'prj_cap', title: 'Bad', maxConcurrentCrew: 0 })).status).toBe(400);
  expect((await call('GET', '/')).json.items.map((x: any) => x.id)).toContain(captain.id);
  expect((await call('GET', `/${captain.id}`)).json.captain).toMatchObject({ purpose: 'run ops', crewRunsOn: 'pool', maxConcurrentCrew: 5 });

  expect((await call('PATCH', `/${captain.id}/profile`, { alias: 'Ops' })).json).toMatchObject({ alias: 'Ops' });
  expect((await call('PATCH', `/${captain.id}/profile`, { alias: 'x'.repeat(81) })).status).toBe(400);
  expect((await call('GET', '/photo-library')).json.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'captain-helm' })]));
  expect((await call('PUT', `/${captain.id}/photo/library`, { libraryId: 'captain-helm' })).json.photo).toEqual({ kind: 'library', libraryId: 'captain-helm' });
  expect((await call('PUT', `/${captain.id}/photo/library`, { libraryId: 'bad' })).status).toBe(400);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const upload = await call('PUT', `/${captain.id}/photo`, undefined, png);
  expect(upload.status).toBe(200); expect(upload.json.photo).toEqual({ kind: 'upload' });
  expect((await call('PUT', `/${captain.id}/photo`, undefined, Buffer.alloc(1024 * 1024 + 1, 1))).status).toBe(413);
  const photo = await call('GET', `/${captain.id}/photo`);
  expect(photo.status).toBe(200); expect(photo.contentType).toContain('image/png'); expect(photo.buffer.subarray(0, 4)).toEqual(png.subarray(0, 4));

  expect((await call('GET', `/${captain.id}/placement`)).json).toEqual({ crewRunsOn: 'pool', deviceId: null, threadMachines: {} });
  expect((await call('PUT', `/${captain.id}/placement`, { crewRunsOn: 'device', deviceId: 'dev_x' })).status).toBe(409);

  const crewThread = await call('POST', `/${captain.id}/crew-thread`, { title: 'Investigate', prompt: 'look at ops' });
  expect(crewThread.status).toBe(201); expect(crewThread.json.membership).toMatchObject({ captainId: captain.id, existing: false });
  expect(madeThreads[0]).toMatchObject({ ownerId: 'usr_cap', projectId: 'prj_cap', title: 'Investigate', prompt: 'look at ops' });
  const crewId = crewThread.json.thread.id;
  expect((await call('PUT', `/${captain.id}/placement`, { crewRunsOn: 'pool', threadMachines: { [crewId]: 'builder-1' } })).json.threadMachines).toEqual({ [crewId]: 'builder-1' });
  expect((await call('PUT', `/${captain.id}/placement`, { crewRunsOn: 'pool', threadMachines: { thr_missing: 'builder-1' } })).status).toBe(400);

  await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_manual','thr_manual','prj_cap','thread','usr_cap','manual','idle','{}','{}','{}')`);
  expect((await call('POST', `/${captain.id}/crew/thr_manual`)).status).toBe(201);
  const crew = await call('GET', `/${captain.id}/crew`);
  expect(crew.json.items.map((x: any) => x.id)).toEqual(expect.arrayContaining([crewId, 'thr_manual']));
  expect((await call('DELETE', `/${captain.id}/crew/thr_manual`)).status).toBe(204);
  expect((await call('DELETE', `/${captain.id}/crew/thr_manual`)).status).toBe(404);
  await pool.query('UPDATE captains SET digest_md=$2 WHERE thread_id=$1', [captain.id, '# digest']);
  expect((await call('GET', `/${captain.id}/digest`)).json).toEqual({ captainId: captain.id, digestMd: '# digest' });
}, 30_000);
