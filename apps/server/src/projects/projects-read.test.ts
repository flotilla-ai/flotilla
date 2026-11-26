import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { createProjectsRoute } from '../routes/projects.route.js';
import { createReadRoute } from '../routes/read.route.js';

const exec = promisify(execFile);
let container = ''; let pool: pg.Pool; let app: Hono;
const json = (body: unknown, method = 'POST') => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop();
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url);
  pool = new pg.Pool({ connectionString: url });
  await pool.query("INSERT INTO users (id,email,role) VALUES ('usr_a','a@x','admin'),('usr_b','b@x','member')");
  app = new Hono();
  app.use('*', async (c, next) => { (c as unknown as { set(key: string, value: string): void }).set('userId', c.req.header('x-user') ?? 'usr_a'); await next(); });
  app.route('/api/v1/projects', createProjectsRoute(pool).app);
  app.route('/api/v1', createReadRoute(pool).app);
}, 30_000);
afterAll(async () => { await pool.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });

describe('projects and read APIs', () => {
  it('defaults projects to untrusted and requires trust confirmation', async () => {
    const bad = await app.request('http://local/api/v1/projects', json({ name: 'x', repo: { url: 'r' }, trust: 'trusted' }));
    expect(bad.status).toBe(400);
    const created = await app.request('http://local/api/v1/projects', json({ name: 'x', repo: { url: 'r' } }));
    expect(created.status).toBe(201);
    const project = await created.json() as { id: string; trust: string };
    expect(project.trust).toBe('untrusted');
    expect((await app.request(`http://local/api/v1/projects/${project.id}`, json({ trust: 'trusted' }, 'PATCH'))).status).toBe(400);
    const patched = await app.request(`http://local/api/v1/projects/${project.id}`, json({ trust: 'trusted', confirm: 'private-and-mine' }, 'PATCH'));
    expect((await patched.json() as { trust: string }).trust).toBe('trusted');
  });

  it('returns seeded rows in order and hides other users ids', async () => {
    await pool.query("INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_a','usr_a','a','{}','untrusted','{}')");
    await pool.query("INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_1','c1','prj_a','thread','usr_a','one','idle','{}','{}','{}'),('thr_2','c2','prj_a','thread','usr_a','two','idle','{}','{}','{}'),('thr_b','cb','prj_a','thread','usr_b','other','idle','{}','{}','{}')");
    await pool.query("INSERT INTO events (id,thread_id,seq,kind,source,trust,payload) VALUES ('evt_2','thr_1',2,'agent.message','adapter','trusted','{}'),('evt_1','thr_1',1,'agent.message','adapter','trusted','{}')");
    await pool.query("INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ('apr_1','thr_1','decision','q','[]',true,'open')");
    const threads = await (await app.request('http://local/api/v1/threads')).json() as { id: string }[];
    expect(threads.map((x) => x.id)).toEqual(['thr_1', 'thr_2']);
    expect((await app.request('http://local/api/v1/threads/thr_b')).status).toBe(404);
    const messages = await (await app.request('http://local/api/v1/threads/thr_1/messages')).json() as { id: string; seq: number }[];
    expect(messages.map((x) => x.id)).toEqual(['evt_1', 'evt_2']);
    const after = await (await app.request('http://local/api/v1/threads/thr_1/messages?after=1')).json() as { id: string }[];
    expect(after.map((x) => x.id)).toEqual(['evt_2']);
    const approvals = await (await app.request('http://local/api/v1/approvals?state=open')).json() as { id: string }[];
    expect(approvals.map((x) => x.id)).toEqual(['apr_1']);
  });
});
