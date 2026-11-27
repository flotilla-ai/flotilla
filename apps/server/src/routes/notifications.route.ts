import { Hono, type Context } from 'hono';
import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import { NotificationCenter, prFollowupSentence } from '../notifications/index.js';

const user=(c:Context)=>c.get('userId') as string;
let one:NotificationCenter|null=null;
export function notificationCenter(databaseUrl=process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'){one??=new NotificationCenter(new pg.Pool({connectionString:databaseUrl,max:3}));return one}
export function createNotificationsRoute(getStore=()=>notificationCenter()){
 const app=new Hono();
 const body=async(c:Context)=>{const x=await c.req.json().catch(()=>null);if(!x||typeof x!=='object'||Array.isArray(x))throw new ApiFailure('ValidationFailed','JSON object body required');return x as Record<string,unknown>};
 app.get('/notifications/settings',async(c)=>c.json(await getStore().settings(user(c))));
 app.put('/notifications/settings',async(c)=>c.json(await getStore().saveSettings(user(c),await body(c))));
 app.post('/notifications/push-subscriptions',async(c)=>c.json(await getStore().subscribe(user(c),await body(c) as any),201));
 app.get('/notifications',async(c)=>c.json({items:await getStore().list(user(c),c.req.query('unread')==='true')}));
 app.get('/notifications/unread-count',async(c)=>c.json({count:await getStore().unreadCount(user(c))}));
 app.post('/notifications/:id/read',async(c)=>{await getStore().markRead(user(c),c.req.param('id'));return c.body(null,204)});
 app.post('/notifications/failure',async(c)=>{const b=await body(c);return c.json(await getStore().notifyFailure(user(c),String(b.body??'')),201)});
 app.post('/notifications/request',async(c)=>{const b=await body(c);return c.json(await getStore().notifyRequest(user(c),String(b.body??'')),201)});
 app.post('/notifications/mentions',async(c)=>{const b=await body(c);return c.json({items:await getStore().notifyMentions(user(c),String(b.body??''),typeof b.threadId==='string'?b.threadId:undefined)},201)});
 app.post('/notifications/pr-followup',async(c)=>{const b=await body(c);return c.json({kind:'pr-followup',sentence:prFollowupSentence({merged:!!b.merged,closed:!!b.closed,number:Number(b.number),repo:String(b.repo??'')})})});
 return {basePath:'/api/v1',app,public:false};
}
export default createNotificationsRoute();
