import pg from 'pg';
import { RunTokenService } from '../captain/tools/tokens.js';
import { setRunTokenService } from '../captain/tools/registry.js';
import { CaptainToolService } from '../captain/tools/service.js';
import { createCaptainToolsServer } from '../captain/tools/http.js';
import { defaultRunner } from '../routes/threads.route.js';
export default { name:'captain-tools', async start(){
 if(process.env.FLOTILLA_CAPTAIN_TOOLS==='0')return async()=>undefined;
 const tokens=new RunTokenService();setRunTokenService(tokens);
 const service=new CaptainToolService({pool:new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'}),tokens,runner:defaultRunner()});
 const server=createCaptainToolsServer(service);server.listen(8082);
 return async()=>{setRunTokenService(null);server.close();await service.deps.pool.end().catch(()=>undefined)};
}};
