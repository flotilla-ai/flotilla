import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { ThreadRunner } from './runner.js';

const exec = promisify(execFile);
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function*(){let rest='';for await(const c of stream){rest+=c.toString();const p=rest.split('\n');rest=p.pop()!;for(const x of p)yield x;}if(rest)yield rest;})(); }
const localTransport: ProcessTransport = { spawn(argv,opts) { const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:{...process.env,...opts.env},detached:true,stdio:['ignore','pipe','pipe']}); return { stdout:lines(child.stdout!),stderr:lines(child.stderr!),exit:new Promise((r)=>child.once('exit',(code,signal)=>r({code,signal}))),signal:async(sig)=>{if(child.pid)process.kill(-child.pid,sig)} } satisfies ProcessHandle; } };
const driver = { startThreadContainer: async()=>({containerId:'fake'}), transport:()=>localTransport, copyIn:async()=>undefined, copyOut:async()=>Buffer.from(''), stop:async()=>undefined };
let container=''; let pool: pg.Pool; let runner: ThreadRunner;
beforeAll(async()=>{
  container=(await exec('docker',['run','-d','--rm','-p','127.0.0.1::5432','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16'])).stdout.trim();
  const port=(await exec('docker',['port',container,'5432/tcp'])).stdout.trim().split(':').pop(); const url=`postgres://postgres@127.0.0.1:${port}/postgres`;
  for(let i=0;i<40;i++){try{const c=new pg.Client({connectionString:url});await c.connect();await c.end();break}catch{await new Promise(r=>setTimeout(r,250))}}
  await migrate(url); const store=new EventStore(url); pool=store.pool; runner=new ThreadRunner({store,driver:driver as never,adapters:new Map([['fake',fakeAdapter]])});
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_test','r@x','admin') ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_other','o@x','member') ON CONFLICT (id) DO NOTHING`);
},30_000);
afterAll(async()=>{await runner.drain(); await pool.end(); if(container)await exec('docker',['rm','-f',container]).catch(()=>undefined);});
async function waitFor(sql:string,args:string[],n=1){for(let i=0;i<80;i++){const r=await pool.query(sql,args);if(r.rows.length>=n)return r.rows;await new Promise(r=>setTimeout(r,100));}return (await pool.query(sql,args)).rows;}

describe('thread runner',()=>{
  it('runs fake adapter events and is idempotent by requestId',async()=>{
    const a=await runner.createThread({ownerId:'usr_test',title:'t',prompt:'hello',requestId:'req-one'});
    const b=await runner.createThread({ownerId:'usr_test',title:'t',prompt:'hello',requestId:'req-one'});
    expect(b.id).toBe(a.id);
    const events=await waitFor(`SELECT * FROM events WHERE thread_id=$1 AND kind='run.ended'`,[a.id as string]);
    expect(events[0]).toBeTruthy();
    const kinds=(await pool.query('SELECT kind FROM events WHERE thread_id=$1 ORDER BY seq',[a.id as string])).rows.map((x)=>x.kind);
    expect(kinds).toContain('run.started'); expect(kinds).toContain('agent.delta'); expect(kinds).toContain('cost.entry');
    expect((await pool.query('SELECT state FROM runs WHERE thread_id=$1',[a.id as string])).rows[0].state).toBe('completed');
  },20_000);
  it('pauses at cap and raise resumes',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'budget',prompt:'hello',maxUsd:1000,requestId:'req-budget'});
    await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND kind='budget' AND state='open'`,[t.id as string]);
    expect((await pool.query('SELECT status FROM threads WHERE id=$1',[t.id as string])).rows[0].status).toBe('paused');
    const approval=(await pool.query('SELECT * FROM approvals WHERE thread_id=$1',[t.id as string])).rows[0];
    await runner.answerApproval(approval.id as string,'raise',2000,'usr_test');
    await waitFor(`SELECT * FROM runs WHERE thread_id=$1 AND state IN ('completed','paused_budget')`,[t.id as string],2);
    await runner.stop(t.id as string);
    expect((await pool.query('SELECT status FROM threads WHERE id=$1',[t.id as string])).rows[0].status).toBe('idle');
  },20_000);
  it('scopes requestId idempotency by owner',async()=>{
    const a=await runner.createThread({ownerId:'usr_test',title:'a',prompt:'hello',requestId:'req-shared-owner'});
    const b=await runner.createThread({ownerId:'usr_other',title:'b',prompt:'hello',requestId:'req-shared-owner'});
    expect(b.id).not.toBe(a.id);
    await runner.stop(a.id as string,'usr_test'); await runner.stop(b.id as string,'usr_other');
  },20_000);
  it('carries first-prompt attachment ids into the durable inbox',async()=>{
    await pool.query(`INSERT INTO api_files (id,owner_id,name,content_type,size,upload_token_hash,upload_expires_at) VALUES ('file_first','usr_test','a.txt','text/plain',1,'',now())`);
    const t=await runner.createThread({ownerId:'usr_test',title:'first attachments',prompt:'hello',requestId:'req-first-attachments',attachments:['file_first']});
    const item=(await pool.query('SELECT attachments,state FROM thread_inbox WHERE thread_id=$1 ORDER BY created_at LIMIT 1',[t.id as string])).rows[0];
    expect(item.attachments).toEqual(['file_first']); expect(item.state).toBe('waiting_upload');
    await runner.drain();
    expect((await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1',[t.id as string])).rows[0].n).toBe(0);
    await pool.query(`UPDATE api_files SET uploaded_at=now() WHERE id='file_first'`);
    await runner.resumePending(); await runner.drain();
    await waitFor(`SELECT 1 FROM runs WHERE thread_id=$1 AND state<>'running' AND state<>'starting'`,[t.id as string]);
    expect((await pool.query('SELECT state FROM thread_inbox WHERE thread_id=$1 ORDER BY created_at LIMIT 1',[t.id as string])).rows[0].state).toBe('delivered');
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('rejects unknown first-prompt attachments before creating the thread',async()=>{
    await expect(runner.createThread({ownerId:'usr_test',title:'bad first attachments',prompt:'hello',requestId:'req-bad-first-attachments',attachments:['file_missing_first']})).rejects.toThrow('unknown attachment');
    expect((await pool.query(`SELECT count(*)::int n FROM threads WHERE owner_id='usr_test' AND title='bad first attachments'`)).rows[0].n).toBe(0);
    await pool.query(`INSERT INTO api_files (id,owner_id,name,content_type,size,upload_token_hash,upload_expires_at) VALUES ('file_retry_first','usr_test','a.txt','text/plain',1,'',now())`);
    const t=await runner.createThread({ownerId:'usr_test',title:'bad first attachments',prompt:'hello',requestId:'req-bad-first-attachments',attachments:['file_retry_first']});
    expect((await pool.query('SELECT count(*)::int n FROM thread_inbox WHERE thread_id=$1',[t.id as string])).rows[0].n).toBe(1);
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('does not close feedback drafts through the generic approval answer path',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'feedback-guard',prompt:'hello',requestId:'req-feedback-guard'});
    await waitFor(`SELECT * FROM events WHERE thread_id=$1 AND kind='run.ended'`,[t.id as string]);
    const id='apr_feedback_guard';
    await pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail) VALUES ($1,$2,'decision','Send feedback?','[]',false,'open','{"feedback":{"title":"t","body":"b"}}')`,[id,t.id]);
    await expect(runner.answerApproval(id,'approve',undefined,'usr_test')).rejects.toThrow('feedback');
    const after=(await pool.query('SELECT state,answer FROM approvals WHERE id=$1',[id])).rows[0];
    expect(after.state).toBe('open'); expect(after.answer).toBeNull();
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('does not duplicate a prompt that was capped before its first run',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'precapped',prompt:'hello',maxUsd:0,requestId:'req-precapped'});
    const rows=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND kind='budget' AND state='open'`,[t.id as string]);
    await runner.answerApproval(rows[0].id as string,'raise',1000,'usr_test');
    expect((await pool.query(`SELECT count(*)::int n FROM thread_inbox WHERE thread_id=$1 AND text='hello'`,[t.id as string])).rows[0].n).toBe(1);
    expect((await pool.query(`SELECT count(*)::int n FROM thread_inbox WHERE thread_id=$1`,[t.id as string])).rows[0].n).toBe(1);
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('keep planning queues a contextual plan revision instead of stalling',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'plan revise',prompt:'/plan design it',requestId:'req-plan-revise'});
    const rows=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`,[t.id as string]);
    await runner.answerApproval(rows[0].id as string,'revise',undefined,'usr_test');
    const items=(await pool.query(`SELECT text,plan FROM thread_inbox WHERE thread_id=$1 ORDER BY created_at`,[t.id as string])).rows;
    expect(items.length).toBe(2); expect(items[1].plan).toBe(true); expect(items[1].text).toContain('Continue planning'); expect(items[1].text).toContain('Request:\ndesign it');
    const revised=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`,[t.id as string]);
    await runner.answerApproval(revised[0].id as string,'approve',undefined,'usr_test');
    const after=(await pool.query(`SELECT text FROM thread_inbox WHERE thread_id=$1 ORDER BY created_at`,[t.id as string])).rows;
    expect(after.length).toBe(3); expect(after[2].text).toContain('Implement the plan now'); expect(after[2].text).toContain('Request:\ndesign it'); expect(after[2].text).not.toContain('do not implement yet');
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('stop on a plan approval does not queue another planning run',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'plan stop',prompt:'/plan stop it',requestId:'req-plan-stop'});
    const rows=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`,[t.id as string]);
    await runner.answerApproval(rows[0].id as string,'stop',undefined,'usr_test');
    expect((await pool.query(`SELECT count(*)::int n FROM thread_inbox WHERE thread_id=$1`,[t.id as string])).rows[0].n).toBe(1);
    const stopped=(await pool.query('SELECT status,plan_mode,needs_you FROM threads WHERE id=$1',[t.id as string])).rows[0];
    expect(stopped.status).toBe('idle'); expect(stopped.plan_mode).toBe(false); expect(stopped.needs_you).toEqual([]);
    await runner.message(t.id as string,'next after stop','queue','usr_test');
    await waitFor(`SELECT 1 FROM thread_inbox WHERE thread_id=$1 AND text='next after stop' AND state='delivered'`,[t.id as string]);
  },20_000);
  it('does not reuse an earlier plan request for a later plan',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'two plans',prompt:'ordinary start',requestId:'req-two-plans'});
    await waitFor(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='run.ended'`,[t.id as string]);
    await runner.message(t.id as string,'/plan first plan','queue','usr_test');
    let rows=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`,[t.id as string]);
    await runner.answerApproval(rows[0].id as string,'approve',undefined,'usr_test');
    await waitFor(`SELECT count(*)::int n FROM events WHERE thread_id=$1 AND kind='run.ended' HAVING count(*) >= 3`,[t.id as string]);
    await runner.message(t.id as string,'/plan second plan','queue','usr_test');
    rows=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`,[t.id as string]);
    await runner.answerApproval(rows[0].id as string,'approve',undefined,'usr_test');
    const items=(await pool.query(`SELECT text FROM thread_inbox WHERE thread_id=$1 ORDER BY created_at`,[t.id as string])).rows;
    expect(items.at(-1).text).toContain('Request:\nsecond plan'); expect(items.at(-1).text).not.toContain('Request:\nfirst plan');
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('uses the message that started a later plan as the implementation request',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'late plan',prompt:'hello first',requestId:'req-late-plan'});
    await waitFor(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='run.ended'`,[t.id as string]);
    await runner.message(t.id as string,'/plan design later','queue','usr_test');
    const rows=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`,[t.id as string]);
    await runner.answerApproval(rows[0].id as string,'approve',undefined,'usr_test');
    const items=(await pool.query(`SELECT text FROM thread_inbox WHERE thread_id=$1 ORDER BY created_at`,[t.id as string])).rows;
    expect(items.at(-1).text).toContain('Request:\ndesign later'); expect(items.at(-1).text).not.toContain('Request:\nhello first');
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('does not mutate another owner approval before the ownership check',async()=>{
    const t=await runner.createThread({ownerId:'usr_test',title:'approval-owner',prompt:'hello',maxUsd:1000,requestId:'req-approval-owner'});
    const rows=await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND kind='budget' AND state='open'`,[t.id as string]);
    const approval=rows[0];
    const result=await runner.answerApproval(approval.id as string,'raise',2000,'usr_other');
    expect(result).toBeNull();
    const after=(await pool.query('SELECT state,answer FROM approvals WHERE id=$1',[approval.id])).rows[0];
    expect(after.state).toBe('open'); expect(after.answer).toBeNull();
    await runner.stop(t.id as string,'usr_test');
  },20_000);
  it('starts repoless project threads in /workspace without seeding a repo (CAPY-177)',async()=>{
    const cwds:string[]=[]; const seen={...fakeAdapter,start:(input:{cwd:string})=>{cwds.push(input.cwd);return fakeAdapter.start(input as never);}};
    const st=new EventStore((pool as unknown as {options:{connectionString:string}}).options.connectionString); const r=new ThreadRunner({store:st,driver:driver as never,adapters:new Map([['fake',seen as never]])});
    await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,egress_allow,budget,code) VALUES ('prj_empty','usr_test','Empty',NULL,'untrusted','[]','{}','EMP')`);
    const t=await r.createThread({ownerId:'usr_test',title:'notes',prompt:'hello',projectId:'prj_empty',requestId:'req-empty'});
    await waitFor(`SELECT * FROM events WHERE thread_id=$1 AND kind='run.ended'`,[t.id as string]); await r.drain(); await st.pool.end();
    expect(cwds).toEqual(['/workspace']); expect(t.code).toBe('EMP-1');
  },20_000);
  it('CAPY-192/197: thread boot uses the snapshot image and prepends the repair prompt',async()=>{
    await pool.query(`INSERT INTO projects (id,owner_id,name,repo,trust,budget) VALUES ('prj_snapboot','usr_test','snapboot',NULL,'untrusted','{}') ON CONFLICT (id) DO NOTHING`);
    const starts: Record<string, unknown>[] = []; let seenPrompt = '';
    const capture = { ...fakeAdapter, probe: (ctx: Parameters<typeof fakeAdapter.probe>[0]) => fakeAdapter.probe(ctx), cancel: (runId: Parameters<typeof fakeAdapter.cancel>[0]) => fakeAdapter.cancel(runId), start: (input: Parameters<typeof fakeAdapter.start>[0]) => { seenPrompt = input.prompt; return fakeAdapter.start(input); }, resume: (input: Parameters<typeof fakeAdapter.resume>[0]) => fakeAdapter.resume(input) };
    const snapDriver = { ...driver, startThreadContainer: async (input: Record<string, unknown>) => { starts.push(input); return { containerId: 'snapshot-fake' }; } };
    const snapRunner = new ThreadRunner({ store: runner.deps.store, driver: snapDriver as never, adapters: new Map([['fake', capture]]), snapshots: { bootPlan: async () => ({ image: 'snapshot:image', buildId: 'snb_good', repair: { buildId: 'snb_bad', prompt: 'Repair the failing environment build.' } }) } });
    const t = await snapRunner.createThread({ ownerId: 'usr_test', projectId: 'prj_snapboot', title: 'snapshot boot', prompt: 'hello', requestId: 'req-snapshot-boot' });
    await waitFor(`SELECT * FROM events WHERE thread_id=$1 AND kind='run.ended'`, [t.id as string]);
    expect(starts[0]?.image).toBe('snapshot:image');
    expect(seenPrompt).toContain('Repair the failing environment build.');
    await snapRunner.drain();
  },20_000);
  it('budget raises validate amounts and update shared windows before closing approvals',async()=>{
    await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_capfix','CF-1','thread','usr_test','cap fix','paused','{}','{}','{}') ON CONFLICT (id) DO NOTHING`);
    await pool.query(`INSERT INTO usage_budgets(scope,scope_id,budget_window,max_usd) VALUES ('project','prj_capfix','month',1000) ON CONFLICT (scope,scope_id) DO UPDATE SET max_usd=1000`);
    await pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail) VALUES ('apr_capfix','thr_capfix','budget','cap','[]',true,'open','{"shared":{"scope":"project","scopeId":"prj_capfix","window":"month"}}') ON CONFLICT (id) DO NOTHING`);
    await expect(runner.answerApproval('apr_capfix','raise',Number.MAX_SAFE_INTEGER+1,'usr_test')).rejects.toThrow('micro-USD');
    expect((await pool.query(`SELECT state FROM approvals WHERE id='apr_capfix'`)).rows[0].state).toBe('open');
    await runner.answerApproval('apr_capfix','raise',5000000,'usr_test');
    expect((await pool.query(`SELECT max_usd FROM usage_budgets WHERE scope='project' AND scope_id='prj_capfix'`)).rows[0].max_usd).toBe('5000000');
    expect((await pool.query(`SELECT state FROM approvals WHERE id='apr_capfix'`)).rows[0].state).toBe('answered');
  },20_000);
  it('failed starts requeue claimed input without cancelling queued messages',async()=>{
    await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_failstart','FS-1','thread','usr_test','fail start','queued','{}','{}','{}')`);
    await pool.query(`INSERT INTO runs (id,thread_id,ordinal,trigger,state,usage) VALUES ('run_failstart','thr_failstart',1,'{}','starting','{}')`);
    await pool.query(`INSERT INTO thread_inbox (id,thread_id,root_id,mode,text,state,run_id,delivered_at) VALUES
      ('inb_claimed','thr_failstart','inb_claimed','queue','claimed','delivered','run_failstart',now()),
      ('inb_pending','thr_failstart','inb_pending','queue','pending','pending',NULL,NULL),
      ('inb_cancelled','thr_failstart','inb_cancelled','queue','cancelled','cancelled',NULL,NULL)`);
    await expect((runner as never as {failStart(t:string,r:string,e:unknown):Promise<never>}).failStart('thr_failstart','run_failstart',new Error('machine setup failed'))).rejects.toThrow('machine setup failed');
    const rows=(await pool.query(`SELECT id,state,run_id FROM thread_inbox WHERE thread_id='thr_failstart' ORDER BY id`)).rows;
    expect(rows).toEqual([
      {id:'inb_cancelled',state:'cancelled',run_id:null},
      {id:'inb_claimed',state:'pending',run_id:null},
      {id:'inb_pending',state:'pending',run_id:null}
    ]);
    expect((await pool.query(`SELECT state FROM runs WHERE id='run_failstart'`)).rows[0].state).toBe('failed');
  },20_000);
});
