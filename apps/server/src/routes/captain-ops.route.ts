import {Hono,type Context} from 'hono';import pg from 'pg';import {CaptainOpsStore} from '../captain-ops/index.js';
const user=(c:Context)=>c.get('userId')as string;const body=async(c:Context)=>((await c.req.json().catch(()=>null))??{})as Record<string,unknown>;let one:CaptainOpsStore|null=null;
export function captainOpsStore(databaseUrl=process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'){one??=new CaptainOpsStore(new pg.Pool({connectionString:databaseUrl}));return one}
export function createCaptainOpsRoute(getStore=()=>captainOpsStore()){const app=new Hono();
 app.get('/captains/:id/digest',async c=>c.json(await getStore().digest(user(c),c.req.param('id'))));
 app.put('/captains/:id/documents/:file',async c=>c.json(await getStore().writeDocument(user(c),c.req.param('id'),c.req.param('file'),(await body(c)).content)));
 app.get('/captains/:id/digest-items',async c=>c.json({items:await getStore().digestItems(user(c),c.req.param('id'))}));
 app.post('/captains/:id/digest-items',async c=>c.json(await getStore().addDigestItem(user(c),c.req.param('id'),(await body(c)).text),201));
 app.post('/captains/:id/digest-items/:item/answer',async c=>c.json(await getStore().answerDigestItem(user(c),c.req.param('id'),c.req.param('item'),(await body(c)).text)));
 app.post('/captains/:id/instruct',async c=>c.json(await getStore().instruct(user(c),c.req.param('id'),(await body(c)).text),201));
 app.get('/captains/:id/rules',async c=>c.json({items:await getStore().rules(user(c),c.req.param('id'))}));
 app.post('/captains/:from/messages/:to',async c=>c.json(await getStore().message(user(c),c.req.param('from'),c.req.param('to'),(await body(c)).text),201));
 app.get('/captains/:id/messages',async c=>c.json({items:await getStore().messages(user(c),c.req.param('id'))}));
 app.get('/captain-templates',async c=>c.json({items:getStore().templates()}));
 return{basePath:'/api/v1',app,public:false}}
export default createCaptainOpsRoute();
