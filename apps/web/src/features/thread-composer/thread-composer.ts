export type ComposerKeymap={send:'enter'|'mod+enter'};
export type ThreadSection={seq:number;index:number;heading:string|null;text:string};
export type Ev={seq:number;kind:string;payload:any};
export type Folded={kind:'event';event:Ev}|{kind:'work';seq:number;label:string;events:Ev[]};
type Store={getItem(k:string):string|null;setItem(k:string,v:string):void};
const KEY='flotilla.composer.keymap';
export const loadKeymap=(s:Store):ComposerKeymap=>s.getItem(KEY)==='mod+enter'?{send:'mod+enter'}:{send:'enter'};
export const saveKeymap=(s:Store,k:ComposerKeymap)=>s.setItem(KEY,k.send);
export function keyAction(k:ComposerKeymap,e:{key:string;shiftKey?:boolean;metaKey?:boolean;ctrlKey?:boolean}):'send'|'newline'|null{
 if(e.key!=='Enter')return null;const mod=!!(e.metaKey||e.ctrlKey);
 return k.send==='enter'?(e.shiftKey?'newline':'send'):(mod?'send':'newline');
}
export function sections(seq:number,text:string):ThreadSection[]{
 const out:ThreadSection[]=[];let heading:string|null=null;let buf:string[]=[];
 const flush=()=>{const t=buf.join('\n').trim();if(t||heading)out.push({seq,index:out.length,heading,text:t});buf=[]};
 let fence='';
 for(const line of text.split('\n')){const f=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);if(f&&(fence?f[1][0]===fence[0]&&f[1].length>=fence.length&&!f[2].trim():!(f[1][0]==='`'&&f[2].includes('`'))))fence=fence?'':f[1];else if(fence){buf.push(line);continue}const m=f?null:/^#{1,6}\s+(.*)$/.exec(line);if(m){flush();heading=m[1].trim()}else buf.push(line)}
 flush();return out;
}
export const quote=(s:ThreadSection)=>[...(s.heading?[`**${s.heading}**`]:[]),...s.text.split('\n')].map(l=>`> ${l}`).join('\n')+'\n\n';
const evText=(e:Ev):string=>typeof e.payload==='string'?e.payload:e.payload?.text??e.payload?.delta??'';
const SHOWN=new Set(['user.message','agent.message','agent.delta','approval.requested']);
export function fold(events:Ev[]):Folded[]{
 const out:Folded[]=[];
 for(const e of [...events].sort((a,b)=>a.seq-b.seq)){
  const prev=out.at(-1);
  if(e.kind==='agent.delta'&&prev?.kind==='event'&&prev.event.kind==='agent.delta'){prev.event={...prev.event,payload:{text:evText(prev.event)+evText(e)}};continue}
  if(SHOWN.has(e.kind)){out.push({kind:'event',event:e});continue}
  const last=out.at(-1);const group=last?.kind==='work'?last:(out.push({kind:'work',seq:e.seq,label:'',events:[]}),out.at(-1) as Extract<Folded,{kind:'work'}>);
  group.events.push(e);const calls=group.events.filter(x=>x.kind==='agent.tool_call').length;group.label=`Worked · ${calls} tool call${calls===1?'':'s'}`;
 }
 return out;
}
export function mentionQuery(text:string,caret:number):string|null{const m=/(?:^|\s)@([\w-]*)$/.exec(text.slice(0,caret));return m?m[1]:null}
export function deepLinkPrompt(hash:string,search:string):string{
 const q=hash.includes('?')?hash.slice(hash.indexOf('?')):search;return new URLSearchParams(q).get('prompt')??'';
}
