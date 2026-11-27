import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { createNotificationsRoute } from '../routes/notifications.route.js';
import { NotificationCenter, mentionsIn, normalizeSettings, prFollowupSentence } from './index.js';

const exec=promisify(execFile);let container='';let pool:pg.Pool;let app:Hono;
async function call(method:string,path:string,body?:unknown){const r=await app.request(`http://x/api/v1${path}`,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,json:await r.json().catch(()=>null) as any}}
beforeAll(async()=>{container=(await exec('docker',['run','-d','--rm','-p','127.0.0.1::5432','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16'])).stdout.trim();const port=(await exec('docker',['port',container,'5432/tcp'])).stdout.trim().split(':').pop();const url=`postgres://postgres@127.0.0.1:${port}/postgres`;let ready=false;for(let i=0;i<80&&!ready;i++){try{const c=new pg.Client({connectionString:url});await c.connect();await c.end();await new Promise(r=>setTimeout(r,500));const c2=new pg.Client({connectionString:url});await c2.connect();await c2.query('SELECT 1');await c2.end();ready=true}catch{await new Promise(r=>setTimeout(r,250))}}if(!ready)throw new Error('postgres fixture did not become ready');await migrate(url);pool=new pg.Pool({connectionString:url});await pool.query(`INSERT INTO users(id,email,role) VALUES('usr_ntf','ntf@example.invalid','member'),('usr_target','target@example.invalid','member')`);app=new Hono();app.onError((err,c)=>err instanceof ApiFailure?apiError(c,err.kind,err.message):apiError(c,'Internal',String(err)));app.use('*',async(c,next)=>{c.set('userId' as never,'usr_ntf' as never);await next()});app.route('/api/v1',createNotificationsRoute(()=>new NotificationCenter(pool)).app)},30_000);
afterAll(async()=>{await pool?.end();if(container)spawn('sh',['-c',`sleep 3; docker rm -f ${container}`],{detached:true,stdio:'ignore'}).unref()});
it('CAPY-448..452 notification settings, push records, mentions, unread badge and follow-up copy',async()=>{
 expect(normalizeSettings({requests:false})).toMatchObject({requests:false,failures:true,systemAlerts:true});expect(mentionsIn('hello @target@example.invalid and @other')).toEqual(['target@example.invalid','other']);expect(prFollowupSentence({merged:true,number:12,repo:'acme/app'})).toContain('merged');
 const bad=await app.request('http://x/api/v1/notifications/settings',{method:'PUT',headers:{'content-type':'application/json'},body:'{'});expect(bad.status).toBe(400);
 const settings=await call('PUT','/notifications/settings',{requests:true,failures:true,sounds:true,systemAlerts:true,devicePush:true,slackDm:false});expect(settings.status).toBe(200);expect(settings.json).toMatchObject({sounds:true,devicePush:true});
 const sub=await call('POST','/notifications/push-subscriptions',{endpoint:'https://push.example.invalid/sub/1',keys:{auth:'a',p256dh:'p'}});expect(sub.status).toBe(201);expect((await call('POST','/notifications/push-subscriptions',{endpoint:'http://insecure.invalid/x'})).status).toBe(400);
 const failure=await call('POST','/notifications/failure',{body:'thread failed'});expect(failure.status).toBe(201);expect(failure.json.kind).toBe('failure');
 expect((await call('GET','/notifications/unread-count')).json.count).toBe(1);expect((await call('GET','/notifications?unread=true')).json.items).toHaveLength(1);
 const mentions=await call('POST','/notifications/mentions',{body:'@target@example.invalid please look',threadId:'thr_x'});expect(mentions.status).toBe(201);expect(mentions.json.items).toHaveLength(1);expect(mentions.json.items[0]).toMatchObject({userId:'usr_target',kind:'mention'});
 const follow=await call('POST','/notifications/pr-followup',{merged:true,number:12,repo:'acme/app'});expect(follow.json.sentence).toContain('acme/app#12 merged');
 expect((await call('POST',`/notifications/${failure.json.id}/read`)).status).toBe(204);expect((await call('GET','/notifications/unread-count')).json.count).toBe(0);
},30_000);
