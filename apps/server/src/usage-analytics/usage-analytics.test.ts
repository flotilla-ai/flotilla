import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createUsageAnalyticsRoute } from '../routes/usage-analytics.route.js';
import { UsageAnalyticsStore } from './index.js';

const exec = promisify(execFile); let container = ''; let pool: pg.Pool; let app: Hono; let asMember = false;
async function call(path: string) { const r = await app.request(`http://x/api/v1${path}`); const text = await r.text(); let json: any = null; try { json = JSON.parse(text) } catch {} return { status: r.status, json, text }; }
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await migrate(url); pool = new pg.Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_ua','ua@example.invalid','admin'),('usr_ub','ub@example.invalid','member')`);
  for (const [id,owner,code,title] of [['thr_ua','usr_ua','FLO-UA','Secret private title'],['thr_ub','usr_ub','FLO-UB','Member work']] as const) {
    await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent,visibility) VALUES ($1,$2,'thread',$3,$4,'idle','{}','{}','{}','private')`, [id, code, owner, title]);
    await pool.query(`INSERT INTO runs (id,thread_id,ordinal,trigger,state,usage) VALUES ($1,$2,1,'{}','completed','{}')`, [`run_${id}`, id]);
    await pool.query(`INSERT INTO cost_entries (thread_id,run_id,source,delta) VALUES ($1,$2,'vendor-usd',$3)`, [id, `run_${id}`, JSON.stringify({ usd: owner === 'usr_ua' ? 300000 : 100000, inputTokens: 100, outputTokens: 50, cacheTokens: 25, machineSec: owner === 'usr_ua' ? 7200 : 1800 })]);
  }
  await pool.query(`INSERT INTO events (id,thread_id,seq,kind,source,trust,payload,pos) VALUES ('evt_ua1','thr_ua',1,'pr.opened','github','trusted','{"number":5}',1),('evt_ua2','thr_ua',2,'pr.merged','github','trusted','{"number":5}',2),('evt_ub1','thr_ub',1,'pr.opened','github','trusted','{"number":8}',3)`);
  await pool.query(`INSERT INTO prs (repo,number,thread_id,head_branch,owned,state) VALUES
    ('acme/app',5,'thr_ua','flotilla/5',true,'merged'),
    ('acme/app',8,'thr_ub','flotilla/8',true,'open'),
    ('acme/app',9,NULL,'external/9',false,'merged'),
    ('acme/app',10,NULL,'external/10',false,'open'),
    ('acme/app',11,'thr_ub','flotilla/11',true,'open')`);
  await pool.query(`INSERT INTO review_runs (id,owner_id,repo,pr_number,head_sha,round,source,credits) VALUES ('rr_ua','usr_ua','acme/app',5,'abcdef0',1,'api',1)`);
  await pool.query(`INSERT INTO review_findings (id,run_id,owner_id,repo,pr_number,round,kind,category,severity,confidence,file,line,body,fingerprint) VALUES ('rf_ua','rr_ua','usr_ua','acme/app',5,1,'finding','bug','high','confirmed','a.ts',2,'bug','fp')`);
  const store = new UsageAnalyticsStore(pool); app = new Hono(); app.onError((err, c) => err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)));
  app.use('*', async (c, next) => { c.set('userId' as never, (asMember ? 'usr_ub' : 'usr_ua') as never); await next(); });
  app.route('/api/v1', createUsageAnalyticsRoute(() => store).app);
}, 30_000);
afterAll(async () => { await pool?.end(); if (container) spawn('sh', ['-c', `sleep 3; docker rm -f ${container}`], { detached: true, stdio: 'ignore' }).unref(); });
it('CAPY-350/354/355/487: workspace type, metadata-only activity and ranked member usage', async () => {
  expect((await call('/workspace')).json).toEqual({ type: 'Team', userCount: 2, billingAttached: false });
  const activity = (await call('/usage/activity')); expect(activity.status).toBe(200); expect(activity.text).not.toContain('Secret private title');
  expect(activity.json).toMatchObject({ privateWorkMetadataOnly: true, capyShareOfMergedPrs: 0.5 });
  expect(activity.json.items).toEqual(expect.arrayContaining([expect.objectContaining({ userId: 'usr_ua', mergedPrs: 1, contributedPrs: 1, reviewFoundIssues: 1, agentHours: 2 }), expect.objectContaining({ userId: 'usr_ub', mergedPrs: 0, contributedPrs: 2, reviewFoundIssues: 0, agentHours: 0.5 })]));
  const cost = (await call('/usage/by-member?sort=cost')).json; expect(cost.items.map((x: any) => x.userId)).toEqual(['usr_ua', 'usr_ub']); expect(cost.items[0]).toMatchObject({ usd: 300000, tokens: 175, cacheTokens: 25 });
  await pool.query(`UPDATE cost_entries SET delta=jsonb_set(delta,'{cacheTokens}','1000') WHERE thread_id='thr_ub'`);
  const tokens = (await call('/usage/by-member?sort=tokens')).json; expect(tokens.items.map((x: any) => x.userId)).toEqual(['usr_ub', 'usr_ua']); expect(tokens.items[0].cacheTokens).toBe(1000); expect(tokens.items[0].tokens).toBe(1150);
  asMember = true; const mine = (await call('/usage/by-member')).json; expect(mine.items).toHaveLength(1); expect(mine.items[0].userId).toBe('usr_ub');
  const myActivity = (await call('/usage/activity')).json; expect(myActivity.items).toHaveLength(1); expect(myActivity.items[0].userId).toBe('usr_ub');
  expect((await call('/usage/by-member?sort=bad')).status).toBe(400);
}, 30_000);
