import { Hono } from 'hono';import { PreviewTokens, shareToken } from '../previews/index.js';
export const previewTokens=new PreviewTokens();
export function createPreviewsRoute(tokens=previewTokens){const app=new Hono();app.post('/threads/:id/preview-token',async c=>{const b=await c.req.json().catch(()=>({}));if(!b.code||!b.port)return c.json({error:'code and port required'},400);const exp=Date.now()+10*60_000;const one=tokens.mint({threadId:c.req.param('id'),code:b.code,port:Number(b.port),exp});return c.json({token:one,shareToken:shareToken({threadId:c.req.param('id'),code:b.code,port:Number(b.port),exp})})});return{basePath:'/api/v1',app,public:false}}
export default createPreviewsRoute();
