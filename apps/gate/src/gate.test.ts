import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { createGate, type GateState } from './main.js';

function state(): GateState { return { byInterface: new Map(), byName: new Map(), interfaceForName: new Map() }; }
async function listen(server: ReturnType<typeof createServer>, port=0) { server.listen(port,'127.0.0.1'); await once(server,'listening'); return (server.address() as {port:number}).port; }

describe('gate servers', () => {
  it('rejects admin without bearer and accepts network updates with bearer', async () => {
    process.env.GATE_ADMIN_TOKEN='test-token';
    const gate=createGate(state(),async()=>['8.8.8.8']); const port=await listen(gate.admin);
    expect((await fetch(`http://127.0.0.1:${port}/networks/flt-x`,{method:'PUT',body:'{}'})).status).toBe(401);
    const ok=await fetch(`http://127.0.0.1:${port}/networks/flt-x`,{method:'PUT',headers:{authorization:'Bearer test-token','content-type':'application/json'},body:JSON.stringify({allow:['api.github.com'],gateIp:'10.1.0.1'})});
    expect(ok.status).toBe(204); expect(gate.state.byInterface.get('10.1.0.1')?.allow).toEqual(['api.github.com']);
    gate.admin.close();
  });
  it('relay forwards only flotilla-tools /mcp/captain', async () => {
    const upstream=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end(`up:${req.url}`)}); await listen(upstream,8082);
    const gate=createGate(state(),async()=>['8.8.8.8'],'127.0.0.1'); const port=await listen(gate.relay);
    const raw=(path:string,host:string)=>new Promise<{status:number;text:string}>((resolve,reject)=>{const r=request({host:'127.0.0.1',port,path,headers:{host}},(res)=>{let text='';res.on('data',(c)=>text+=c);res.on('end',()=>resolve({status:res.statusCode??0,text}))});r.on('error',reject);r.end()});
    const ok=await raw('/mcp/captain/x','flotilla-tools'); expect(ok.status).toBe(200); expect(ok.text).toBe('up:/mcp/captain/x');
    expect((await raw('/other','flotilla-tools')).status).toBe(404);
    expect((await raw('/mcp/captain/x',`127.0.0.1:${port}`)).status).toBe(404);
    gate.relay.close(); upstream.close();
  });
});
