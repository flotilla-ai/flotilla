import { createServer } from 'node:http';
import type { CaptainToolService } from './service.js';
export function createCaptainToolsServer(service: CaptainToolService) {
  return createServer((req, res) => { void (async () => {
    if (!(req.url ?? '').startsWith('/mcp/captain')) { res.writeHead(404); res.end(); return; }
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    const auth = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    if (!auth) { res.writeHead(401); res.end(); return; }
    let raw = ''; let tooLarge = false;
    try { for await (const x of req) { raw += x; if (raw.length > 64 * 1024) { tooLarge = true; break; } } } catch { res.writeHead(400); res.end(); return; }
    if (tooLarge) { res.writeHead(413); res.end(); return; }
    try {
      const rpc = JSON.parse(raw || '{}') as { method?: string; params?: { name?: string; arguments?: Record<string, unknown> }; id?: unknown };
      if (rpc.method === 'initialize') { res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'flotilla-captain',version:'0.1'}}})); return; }
      if (rpc.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
      if (rpc.method === 'tools/list') { const issue={type:'object',properties:{title:{type:'string'},body:{type:'string'},assigneeId:{type:'string'},labelIds:{type:'array',items:{type:'string'}},dueDate:{type:'string'}}};const schemas:Record<string,unknown>={'issue.file':{...issue,required:['title']},'issue.update':{...issue,properties:{...issue.properties,issueId:{type:'string'},stateId:{type:'string'}},required:['issueId']},'issue.close':{type:'object',properties:{issueId:{type:'string'}},required:['issueId']}};const tools=['issue.file','issue.update','issue.close','crew.start','crew.message','crew.release','digest.write','ask.human'].map((name)=>({name,description:name,inputSchema:schemas[name]??{type:'object',properties:{}}})); res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{tools}})); return; }
      if (rpc.method !== 'tools/call') { res.writeHead(400); res.end(); return; }
      const out = await service.call(auth, String(rpc.params?.name ?? ''), rpc.params?.arguments ?? {});
      res.writeHead(out.status,{'content-type':'application/json'}); res.end(JSON.stringify(out.status===200?{jsonrpc:'2.0',id:rpc.id,result:out.body}:out.body));
    } catch { res.writeHead(500); res.end(); }
  })(); });
}
