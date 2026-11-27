import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createPrAutofixRoute } from '../routes/pr-autofix.route.js';
import { PrAutofixStore, type PrGateway } from './index.js';

const exec=promisify(execFile);let container='';let pool:pg.Pool;let app:Hono;let store:PrAutofixStore;const calls:any[]=[];
async function call(method:string,path:string,body?:unknown){const r=await app.request(`http://local/api/v1${path}`,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,json:await r.json().catch(()=>null) as any}}
beforeAll(async()=>{container=(await exec('docker',['run','-d','--rm','-p','127.0.0.1::5432','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16'])).stdout.trim();const port=(await exec('docker',['port',container,'5432/tcp'])).stdout.trim().split(':').pop();const url=`postgres://postgres@127.0.0.1:${port}/postgres`;for(let i=0;i<40;i++){try{const c=new pg.Client({connectionString:url});await c.connect();await c.end();break}catch{await new Promise(r=>setTimeout(r,250))}}await migrate(url);pool=new pg.Pool({connectionString:url});
 const gateway:PrGateway={act:async x=>{calls.push(x);return{ok:true,actor:x.actor}},review:async x=>{calls.push(x);return{ok:true,actor:x.actor}}};store=new PrAutofixStore(pool,gateway);
 await pool.query("INSERT INTO users (id,email,role) VALUES ('usr_pr','p@x','admin')");
 await pool.query("INSERT INTO github_accounts (id,user_id,login,kind,token_ref) VALUES ('gha_pr','usr_pr','alice','personal','vault:github/token')");
 await pool.query(`INSERT INTO github_installations (id,account_id,installation_id,subject,repositories,permissions,verified_at) VALUES ('ghi_pr','gha_pr','1','acme','["acme/api","acme/web"]','{"contents":"write","pullRequests":"write","checks":"read","issues":"write","metadata":"read"}',now())`);
 for(const [id,code,title] of [['thr_pr1','PR-1','one'],['thr_pr2','PR-2','two'],['thr_pr3','PR-3','three']] as const) await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$2,'thread','usr_pr',$3,'idle','{}','{}','{}')`,[id,code,title]);
 await pool.query(`INSERT INTO prs (repo,number,thread_id,head_branch,title,author,state,labels,draft,checks_state,pushed_at) VALUES
  ('acme/api',1,'thr_pr1','feature/x','Fix API','alice','open','["bug"]',false,'failed',now()-interval '40 minutes'),
  ('acme/api',2,'thr_pr2','feature/y','Draft API','alice','open','["wip"]',true,'pending',now()),
  ('acme/web',3,'thr_pr3','feature/z','Web','bob','merged','[]',false,'green',now()),
  ('acme/api',4,'thr_pr1','feature/no-ci','No CI','alice','open','[]',false,'unknown',now()-interval '40 minutes')`);
 app=new Hono();app.onError((err,c)=>err instanceof ApiFailure?apiError(c,err.kind,err.message):apiError(c,'Internal',String(err)));app.use('*',async(c,next)=>{c.set('userId' as never,'usr_pr' as never);await next()});app.route('/api/v1',createPrAutofixRoute(()=>store).app)},30000);
afterAll(async()=>{await pool?.end();if(container)spawn('sh',['-c',`sleep 5; docker rm -f ${container}`],{detached:true,stdio:'ignore'}).unref()});

it('CAPY-110/111/112/115/117/120/123/125: pull settings, filters, fixture actions, review identity and no-CI wake',async()=>{
 expect((await call('PUT','/pulls/settings',{branchPrefix:'release'})).status).toBe(400);
 const settings=await call('PUT','/pulls/settings',{branchPrefix:'feature',draftDefault:true,openInFlotilla:false});expect(settings.json).toMatchObject({branchPrefix:'feature',draftDefault:true,openInFlotilla:false,personalOverride:true});
 await pool.query(`INSERT INTO prs (repo,number,thread_id,head_branch,title,author,state,labels,draft,checks_state) VALUES ('acme/api',5,NULL,'external/x','External API','alice','open','[]',false,'green')`);
 const list=await call('GET','/pulls');expect(list.json.items.map((x:any)=>`${x.repo}#${x.number}`).sort()).toEqual(['acme/api#1','acme/api#2','acme/api#4','acme/api#5','acme/web#3']);
 expect((await call('GET','/pulls?q=author:alice status:open label:bug')).json.items.map((x:any)=>x.number)).toEqual([1]);
 const one=await call('GET','/pulls/acme/api/1');expect(one.status).toBe(200);expect(one.json.blockedReason).toBe('checks are failing');await pool.query(`UPDATE prs SET checks_state='green' WHERE repo='acme/api' AND number=1`);
 expect((await call('POST','/pulls/acme/api/2/actions',{action:'merge',method:'squash'})).status).toBe(409);
 const merged=await call('POST','/pulls/acme/api/1/actions',{action:'merge',method:'squash',comment:'ship it'});expect(merged.status).toBe(200);expect(calls.at(-1)).toMatchObject({action:'merge',method:'squash',actor:'alice'});
 const review=await call('POST','/pulls/acme/api/1/review',{verdict:'approve',comment:'looks good'});expect(review.status).toBe(200);expect(calls.at(-1)).toMatchObject({verdict:'approve',actor:'alice'});
 const wakes:unknown[]=[];const n=await store.noCiWakes(new Date(),async x=>{wakes.push(x)});expect(n).toBe(1);expect(wakes[0]).toMatchObject({threadId:'thr_pr1',repo:'acme/api',number:4});expect(await store.noCiWakes(new Date(),async x=>{wakes.push(x)})).toBe(0);
},30000);
