import { KernelDenied } from '../types.js';
export type CrewLimitInput={active:number;max?:number;subtreeRemaining:number;requested:number;sameProject:boolean;alreadyCrew:boolean};
export function crewLimitCheck(x:CrewLimitInput):'ok'{
 if(!x.sameProject)throw new KernelDenied('crew-limit','crew must stay in the captain project');
 if(x.alreadyCrew)throw new KernelDenied('crew-limit','thread is already crew');
 if(x.active>=(x.max??5))throw new KernelDenied('crew-limit','maximum active crew reached');
 if(x.requested>x.subtreeRemaining)throw new KernelDenied('crew-limit','requested budget exceeds captain subtree remaining');
 return 'ok';
}
