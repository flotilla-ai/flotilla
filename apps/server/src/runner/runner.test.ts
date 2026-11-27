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
});
