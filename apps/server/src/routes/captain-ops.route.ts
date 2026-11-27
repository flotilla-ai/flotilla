import {Hono,type Context} from 'hono';import pg from 'pg';import {ApiFailure} from '../api-platform/types.js';import {CaptainOpsStore} from '../captain-ops/index.js';import {PrAutofixStore} from '../pr-autofix/index.js';import {NotificationCenter} from '../notifications/index.js';
const user=(c:Context)=>c.get('userId')as string;const body=async(c:Context)=>{try{return ((await c.req.json())??{})as Record<string,unknown>}catch{throw new ApiFailure('ValidationFailed','request body must be valid JSON')}};let one:CaptainOpsStore|null=null;
export function captainOpsStore(databaseUrl=process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'){if(!one){const pool=new pg.Pool({connectionString:databaseUrl});const prs=new PrAutofixStore(pool);one=new CaptainOpsStore(pool,async(action,userId)=>{if(action.action==='merge')await prs.act(userId,String(action.repo),Number(action.number),{action:'merge',method:'squash'});else throw new ApiFailure('ValidationFailed','unsupported digest action')})}return one}
export function createCaptainOpsRoute(getStore=()=>captainOpsStore()){const app=new Hono();
 app.get('/captain-ops/:id/digest',async c=>c.json(await getStore().digest(user(c),c.req.param('id'))));
 app.put('/captains/:id/documents/:file',async c=>c.json(await getStore().writeDocument(user(c),c.req.param('id'),c.req.param('file'),(await body(c)).content)));
 app.get('/captains/:id/digest-items',async c=>c.json({items:await getStore().digestItems(user(c),c.req.param('id'))}));
 app.post('/captains/:id/digest-items',async c=>c.json(await getStore().addDigestItem(user(c),c.req.param('id'),(await body(c)).text),201));
 app.post('/captains/:id/digest-items/:item/answer',async c=>c.json(await getStore().answerDigestItem(user(c),c.req.param('id'),c.req.param('item'),(await body(c)).text)));
 app.post('/captains/:id/instruct',async c=>c.json(await getStore().instruct(user(c),c.req.param('id'),(await body(c)).text),201));
 app.get('/captains/:id/rules',async c=>c.json({items:await getStore().rules(user(c),c.req.param('id'))}));
 app.post('/captains/:from/messages/:to',async c=>{const store=getStore();const text=(await body(c)).text;const result=await store.message(user(c),c.req.param('from'),c.req.param('to'),text);if(!result.suppressed&&typeof text==='string')await new NotificationCenter(store.pool).notifyMentions(user(c),text,String(c.req.param('to')));return c.json(result,201)});
 app.get('/captains/:id/messages',async c=>c.json({items:await getStore().messages(user(c),c.req.param('id'))}));
 app.get('/captain-templates',async c=>c.json({items:getStore().templates()}));
 return{basePath:'/api/v1',app,public:false}}
export default createCaptainOpsRoute();
