import {Hono,type Context} from 'hono';import pg from 'pg';import {ApiFailure} from '../api-platform/types.js';import {ReviewPolicyStore,agentsRuleFindings,retryOnTimeout,stackBadge} from '../review-policy/index.js';
const userId=(c:Context)=>c.get('userId')as string;const body=async(c:Context)=>{try{return ((await c.req.json())??{})as Record<string,unknown>}catch{throw new ApiFailure('ValidationFailed','request body must be valid JSON')}};let one:ReviewPolicyStore|null=null;
export function reviewPolicyStore(databaseUrl=process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'){one??=new ReviewPolicyStore(new pg.Pool({connectionString:databaseUrl}));return one}
export function createReviewPolicyRoute(getStore=()=>reviewPolicyStore()){const app=new Hono();
 app.get('/review-policy/:owner/:repo',async c=>c.json({items:await getStore().policies(userId(c),`${c.req.param('owner')}/${c.req.param('repo')}`)}));
 app.put('/review-policy/:owner/:repo',async c=>c.json(await getStore().putPolicy(userId(c),`${c.req.param('owner')}/${c.req.param('repo')}`,await body(c))));
 app.post('/review-policy/guide',async c=>c.json(await retryOnTimeout(async()=>getStore().guide(userId(c),await body(c)),1),201));
 app.post('/review-policy/filter',async c=>{const b=await body(c);return c.json(await getStore().filter(userId(c),String(b.repo??''),(b.files??[])as never,b.pathScope===undefined?undefined:String(b.pathScope)))});
 app.post('/review-policy/agents-findings',async c=>{const b=await body(c);return c.json({items:agentsRuleFindings(String(b.agentsMd??''),(b.files??[])as never)})});
 app.put('/review-findings/:id/evidence',async c=>c.json(await getStore().attachEvidence(userId(c),c.req.param('id'),(await body(c)).evidence)));
 app.get('/review-findings/:id/evidence',async c=>c.json(await getStore().evidence(userId(c),c.req.param('id'))));
 app.get('/review-policy/stack-badge',async c=>c.json({badge:stackBadge(String(c.req.query('branch')??''),String(c.req.query('base')??'main'))}));
 return{basePath:'/api/v1',app,public:false}}
export default createReviewPolicyRoute();
