import type {Ev} from './thread-composer.js';
export type InboxItem={id:string;text:string;state:'waiting_upload'|'pending'|'delivered'|'cancelled';mode:string};
export type InboxView={items:InboxItem[];queuedCount:number;folded:boolean};
export type ContextMeter={usedTokens:number;compactAt:number;compactSupported:boolean};
export type Version={seq:number;inboxId:string;version:number;text:string};

/** CAPY-468: two or more queued messages fold behind a count. */
export const queueFold=(v:InboxView)=>({folded:v.items.length>=2,label:`${v.items.length} queued`});
/** CAPY-467: a message sent while its file is still uploading. */
export const stateLabel=(i:InboxItem)=>i.state==='waiting_upload'?'waiting for upload':'queued';
/** CAPY-009: a 409 means the agent already read the message, so its controls go away. */
export const alreadyRead=(err:unknown)=>err instanceof Error&&err.message==='409';

/** CAPY-010: versions of one sent message share a root; only the latest event is shown, with a switcher. */
export function versionGroups(events:Ev[]):{shown:Map<number,Version[]>;hidden:Set<number>}{
 const roots=new Map<string,Version[]>();
 for(const e of [...events].sort((a,b)=>a.seq-b.seq)){
  if(e.kind!=='user.message'||!e.payload?.inboxId)continue;
  const root=String(e.payload.rootId??e.payload.inboxId);
  roots.set(root,[...(roots.get(root)??[]),{seq:e.seq,inboxId:e.payload.inboxId,version:Number(e.payload.version??1),text:String(e.payload.text??'')}]);
 }
 const shown=new Map<number,Version[]>();const hidden=new Set<number>();
 for(const vs of roots.values()){vs.sort((a,b)=>a.version-b.version);shown.set(vs[vs.length-1].seq,vs);for(const v of vs.slice(0,-1))hidden.add(v.seq)}
 return {shown,hidden};
}
export const switcherLabel=(index:number,total:number)=>`${index+1}/${total}`;

/** CAPY-026: context meter text and the Compact-at percentage. */
export function meterView(c:ContextMeter,limit?:number|null){
 const n=(x:number)=>x.toLocaleString('en-US');
 return {label:limit?`${n(c.usedTokens)} / ${n(limit)} tokens`:`${n(c.usedTokens)} tokens`,ratio:limit?Math.min(1,c.usedTokens/limit):null,compactPercent:Math.round(c.compactAt*100),editable:c.compactSupported};
}
export const compactBody=(percent:number)=>({compactAt:Math.min(100,Math.max(1,Math.round(percent)))/100});
