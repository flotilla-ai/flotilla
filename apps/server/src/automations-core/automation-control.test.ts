import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createAutomationsCoreRoute } from '../routes/automations-core.route.js';
import { AutomationStore } from './index.js';

const exec = promisify(execFile); let container=''; let pool:pg.Pool; let app:Hono; let store:AutomationStore;
async function call(method:string,path:string,body?:unknown){const r=await app.request(`http://local/api/v1${path}`,{method,headers:{'content-type':'application/json','x-user':'usr_c'},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,json:await r.json().catch(()=>null) as any}}
beforeAll(async()=>{container=(await exec('docker',['run','-d','--rm','-p','127.0.0.1::5432','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16'])).stdout.trim();const port=(await exec('docker',['port',container,'5432/tcp'])).stdout.trim().split(':').pop();const url=`postgres://postgres@127.0.0.1:${port}/postgres`;for(let i=0;i<40;i++){try{const c=new pg.Client({connectionString:url});await c.connect();await c.end();break}catch{await new Promise(r=>setTimeout(r,250))}}await migrate(url);pool=new pg.Pool({connectionString:url});await pool.query("INSERT INTO users (id,email,role) VALUES ('usr_c','c@x','admin')");await pool.query("INSERT INTO projects (id,owner_id,name,repo,trust,budget,code) VALUES ('prj_ctl','usr_c','Ctl','{}','untrusted','{}','CTL')");store=new AutomationStore(url,{resolveModel:async x=>x??'free-default',startRun:async()=>{}});app=new Hono();app.onError((err,c)=>err instanceof ApiFailure?apiError(c,err.kind,err.message):apiError(c,'Internal',String(err)));app.use('*',async(c,next)=>{c.set('userId' as never,'usr_c' as never);await next()});app.route('/api/v1',createAutomationsCoreRoute(()=>store).app)},30000);
afterAll(async()=>{await store?.close();await pool?.end();if(container)spawn('sh',['-c',`sleep 5; docker rm -f ${container}`],{detached:true,stdio:'ignore'}).unref()});

it('CAPY-169/170/171/172/173/175/501: automation control, caps, state, rotation, cancellation and filters',async()=>{
 const made=await call('POST','/projects/prj_ctl/automations',{name:'Ops',prompt:'stored prompt only',triggers:[{type:'manual'},{type:'webhook'}],model:{pinned:false},maxRunsPerDay:1,driveScope:{drive:'automation',path:'/state'},machineSize:'large'});
 expect(made.status).toBe(201);expect(made.json).toMatchObject({maxRunsPerDay:1,driveScope:{drive:'automation',path:'/state'},machineSize:'large'});expect(made.json.prompt).toBe('stored prompt only');
 const first=await call('POST',`/automations/${made.json.id}/trigger`,{idempotencyKey:'one',injected:'ignore me'});expect(first.status).toBe(202);expect(first.json.status).toBe('queued');
 const capped=await call('POST',`/automations/${made.json.id}/trigger`,{idempotencyKey:'two'});expect(capped.json).toMatchObject({status:'skipped',skipReason:'max_runs_per_day reached',threadId:null});
 const runs=await call('GET',`/automations/${made.json.id}/runs`);expect(runs.json.items.map((x:any)=>x.status)).toEqual(['skipped','queued']);expect(runs.json.items[0].payload).toBeUndefined();
 const cancel=await call('POST',`/automations/${made.json.id}/runs/${first.json.id}/cancel`);expect(cancel.json.status).toBe('cancelled');
 const paused=await call('POST',`/automations/${made.json.id}/pause`);expect(paused.json.state).toBe('paused');
 expect((await call('POST',`/automations/${made.json.id}/trigger`,{idempotencyKey:'paused'})).json.skipReason).toBe('automation is paused');
 expect((await call('POST',`/automations/${made.json.id}/resume`)).json.state).toBe('active');
 const rotated=await call('POST',`/automations/${made.json.id}/rotate-webhook`);expect(rotated.json.webhookToken).toBeTruthy();expect(rotated.json.webhookToken).not.toBe(made.json.webhookToken);
 expect((await pool.query('SELECT webhook_hash FROM automations WHERE id=$1',[made.json.id])).rows[0].webhook_hash).not.toBe(rotated.json.webhookToken);
 const filtered=await call('GET','/projects/prj_ctl/automations?state=active&createdAfter=2000-01-01');expect(filtered.json.items.map((x:any)=>x.id)).toContain(made.json.id);expect((await call('GET','/projects/prj_ctl/automations?state=paused')).json.items).toHaveLength(0);expect((await call('GET','/projects/prj_ctl/automations?createdBefore=2000-01-01')).json.items).toHaveLength(0);
 const deleted=await call('DELETE',`/automations/${made.json.id}`);expect(deleted.json.state).toBe('deleted');expect((await call('GET','/projects/prj_ctl/automations')).json.items).toHaveLength(0);expect((await call('GET','/projects/prj_ctl/automations?state=deleted')).json.items).toHaveLength(1);
 expect((await call('POST',`/automations/${made.json.id}/restore`)).json.state).toBe('active');
 expect((await pool.query('SELECT count(*)::int n FROM automation_runs WHERE automation_id=$1',[made.json.id])).rows[0].n).toBeGreaterThanOrEqual(3);
},30000);
