import {Hono,type Context}from'hono';
import pg from'pg';
import {PrPageStore}from'../pr-page/index.js';
import {defaultRunner}from'./threads.route.js';
const user=(c:Context)=>c.get('userId')as string;const body=async(c:Context)=>((await c.req.json().catch(()=>null))??{})as Record<string,unknown>;
let one:PrPageStore|null=null;
export function prPageStore(){one??=new PrPageStore(new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'}),undefined,input=>defaultRunner().createThread(input)as Promise<Record<string,unknown>>);return one}
export function createPrPageRoute(getStore=()=>prPageStore()){const app=new Hono();app.post('/pr-page/draft-choice',async c=>c.json(await getStore().setDraftChoice(user(c),await body(c)),201));app.post('/pr-page/open',async c=>c.json(await getStore().createPr(user(c),await body(c)),201));for(const action of ['chat','thread'])app.post(`/pulls/:owner/:repo/:number/${action}`,async c=>c.json(await getStore().threadForPr(user(c),`${c.req.param('owner')}/${c.req.param('repo')}`,Number(c.req.param('number')),await body(c)),201));return{basePath:'/api/v1',app,public:false}}
export default createPrPageRoute();
