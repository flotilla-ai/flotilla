import{Hono,type Context}from'hono';import pg from'pg';import{DeviceExecutionStore}from'../device-execution/index.js';import{ApiFailure}from'../api-platform/types.js';
const user=(c:Context)=>c.get('userId')as string;const body=async(c:Context)=>{try{return(await c.req.json())as Record<string,unknown>}catch{throw new ApiFailure('ValidationFailed','request body must be valid JSON')}};let one:DeviceExecutionStore|null=null;
export function deviceExecutionStore(databaseUrl=process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'){one??=new DeviceExecutionStore(new pg.Pool({connectionString:databaseUrl}));return one}
export function createDeviceExecutionRoute(getStore=()=>deviceExecutionStore()){const app=new Hono();
 app.put('/devices/:id/worktree-policy',async c=>c.json(await getStore().setWorktreePolicy(user(c),c.req.param('id'),await body(c))));
 app.get('/devices/:id/worktree-policy',async c=>c.json(await getStore().worktreePolicy(user(c),c.req.param('id'))));
 app.put('/threads/:id/device-placement',async c=>c.json(await getStore().placeThread(user(c),c.req.param('id'),(await body(c)).deviceId)));
 app.get('/threads/:id/device-placement',async c=>c.json(await getStore().placement(user(c),c.req.param('id'))));
 app.post('/devices/:id/reconnected',async c=>c.json({ready:await getStore().deviceReconnected(user(c),c.req.param('id'))}));
 app.put('/devices/:id/tailscale',async c=>c.json(await getStore().configureTailscale(user(c),c.req.param('id'),await body(c))));
 app.delete('/devices/:id/tailscale',async c=>c.json(await getStore().disconnectTailscale(user(c),c.req.param('id'))));
 app.post('/devices/:id/import-history',async c=>c.json(await getStore().importHistory(user(c),c.req.param('id'),await body(c)),201));
 return{basePath:'/api/v1',app,public:false}}
export default createDeviceExecutionRoute();
