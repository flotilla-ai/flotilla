import pg from 'pg';
import { RunTokenService } from '../captain/tools/tokens.js';
import { setRunTokenService } from '../captain/tools/registry.js';
import { CaptainToolService } from '../captain/tools/service.js';
import { createCaptainToolsServer } from '../captain/tools/http.js';
import { MemoryV2Service } from '../memory-v2/index.js';
import { defaultRunner } from '../routes/threads.route.js';
export default { name:'captain-tools', async start(){
 if(process.env.FLOTILLA_CAPTAIN_TOOLS==='0')return async()=>undefined;
 const tokens=new RunTokenService();setRunTokenService(tokens);
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://postgres@postgres:5432/flotilla'});
 const service=new CaptainToolService({pool,tokens,runner:defaultRunner()});
 const memory=new MemoryV2Service({pool,tokens});
 const server=createCaptainToolsServer(service,{memory});server.listen(8082);
 return async()=>{setRunTokenService(null);server.close();await service.deps.pool.end().catch(()=>undefined)};
}};
