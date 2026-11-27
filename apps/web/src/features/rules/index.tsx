import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
type Layer={kind:string;source:string;tokens:number;fullTokens:number;truncated:boolean};
type Context={runId:string;budget:{maxTokens:number;usedTokens:number};ignored:{path:string;reason:string}[];layers:Layer[]}|null;
type Flags={memory:boolean|null;captain:boolean|null};type Exp={org:Flags;user:Flags;effective:{memory:boolean;captain:boolean}};
type Guidance={whereToPut:{layer:string;use:string}[];antiPatterns:string[];migration:{from:string;notes:string}[]};
export function ContextBreakdown({threadId}:{threadId:string}){const[ctx,setCtx]=useState<Context>(null);useEffect(()=>{api(`/threads/${threadId}/rules-context`).then(setCtx).catch(()=>setCtx(null))},[threadId]);
 if(!ctx)return <small>no run yet</small>;
 return <div><table aria-label='context breakdown'><tbody><tr><th>Layer</th><th>Source</th><th>Tokens</th></tr>{ctx.layers.map((l,i)=><tr key={i}><td>{l.kind}</td><td>{l.source}</td><td>{l.truncated?`${l.tokens} of ${l.fullTokens} (truncated)`:l.tokens}</td></tr>)}</tbody></table>
  <small>{ctx.budget.usedTokens} of {ctx.budget.maxTokens} tokens</small>{ctx.ignored.map(x=><div key={x.path}><small>{x.path} {x.reason}</small></div>)}</div>}
function Rules(){const[org,setOrg]=useState('');const[me,setMe]=useState('');const[exp,setExp]=useState<Exp|null>(null);const[g,setG]=useState<Guidance|null>(null);const[mem,setMem]=useState<{id:string;text:string}[]>([]);const[teach,setTeach]=useState('');const[threadId,setThreadId]=useState('');const[msg,setMsg]=useState('');const[loaded,setLoaded]=useState(false);
 const loadMem=()=>api('/memory').then(r=>setMem(r.items)).catch(()=>{});
 useEffect(()=>{api('/rules/instructions').then(r=>{setOrg(r.org.text);setMe(r.user.text);setLoaded(true)}).catch(()=>setMsg('instructions not loaded'));api('/experiments').then(setExp).catch(()=>{});api('/rules/guidance').then(setG).catch(()=>{});void loadMem()},[]);
 const save=(path:string,text:string)=>api(path,{method:'PUT',body:JSON.stringify({text})}).then(()=>setMsg('saved')).catch(()=>setMsg('not saved'));
 const flag=(scope:'org'|'user',k:'memory'|'captain',v:boolean|null)=>api('/experiments',{method:'PUT',body:JSON.stringify({scope,[k]:v})}).then(setExp).catch(()=>setMsg('not saved (org flags need an admin)'));
 return <main><h1>Rules</h1>
  <h2>Instructions</h2><textarea aria-label='organization instructions' rows={4} style={{width:'100%'}} value={org} onChange={e=>setOrg(e.target.value)}/><button disabled={!loaded} onClick={()=>save('/rules/instructions/org',org)}>Save organization</button>
  <textarea aria-label='personal instructions' rows={4} style={{width:'100%'}} value={me} onChange={e=>setMe(e.target.value)}/><button disabled={!loaded} onClick={()=>save('/rules/instructions/me',me)}>Save personal</button>{msg&&<small> {msg}</small>}
  {g&&<><h2>What goes where</h2>{g.whereToPut.map(w=><div key={w.layer}><b>{w.layer}</b> {w.use}</div>)}<h2>Anti-patterns</h2>{g.antiPatterns.map(a=><div key={a}>{a}</div>)}<h2>Migrating</h2>{g.migration.map(m=><div key={m.from}><b>{m.from}</b> {m.notes}</div>)}</>}
  <h2>Experiments</h2>{exp&&(['memory','captain'] as const).map(k=><div key={k}>{(['user','org'] as const).map(s=><label key={s} style={{marginRight:16}}>{k==='memory'?'Memory':'Captain'} ({s==='user'?'me':'organization'}) <select aria-label={`${k==='memory'?'Memory':'Captain'} for ${s==='user'?'me':'organization'}`} value={exp[s][k]===null?'inherit':exp[s][k]?'on':'off'} onChange={e=>void flag(s,k,e.target.value==='inherit'?null:e.target.value==='on')}><option value='inherit'>{s==='user'?'inherit':'default (off)'}</option><option value='on'>on</option><option value='off'>off</option></select></label>)}<small>{exp.effective[k]?'on':'off'}</small></div>)}
  <h2>Memory</h2>{mem.map(m=><div key={m.id}>{m.text} <button onClick={()=>api(`/memory/${m.id}`,{method:'DELETE'}).then(loadMem)}>Forget</button></div>)}
  {exp?.effective.memory&&<><input aria-label='teach memory' value={teach} onChange={e=>setTeach(e.target.value)}/><button onClick={()=>api('/memory',{method:'POST',body:JSON.stringify({text:teach})}).then(()=>{setTeach('');return loadMem()})}>Remember</button></>}
  <h2>Context</h2><input aria-label='thread id' value={threadId} onChange={e=>setThreadId(e.target.value)}/>{threadId&&<ContextBreakdown key={threadId} threadId={threadId}/>}
 </main>}
export default {path:'/rules',element:<Rules/>,nav:'Rules'}
