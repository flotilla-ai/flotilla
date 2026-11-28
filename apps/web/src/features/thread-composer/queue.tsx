import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
import {alreadyRead,compactBody,meterView,queueFold,stateLabel,switcherLabel,type ContextMeter as Meter,type InboxItem,type InboxView,type Version} from './queue-model.js';

/** CAPY-009 / CAPY-467 / CAPY-468: queued messages above the composer. */
export function QueuePanel({threadId,tick,onReturn}:{threadId:string;tick:number;onReturn:(text:string)=>void}){
 const[view,setView]=useState<InboxView>({items:[],queuedCount:0,folded:false});const[editing,setEditing]=useState<string|null>(null);const[text,setText]=useState('');const[note,setNote]=useState('');
 const load=()=>api(`/threads/${threadId}/inbox`).then((v:InboxView)=>setView({...v,items:v?.items??[]})).catch(()=>{});
 useEffect(()=>{void load()},[threadId,tick]);
 const act=async(run:()=>Promise<unknown>)=>{try{await run();setNote('')}catch(err){setNote(alreadyRead(err)?'The agent already read this message.':'That did not work. Try again.')}setEditing(null);await load()};
 const path=(i:InboxItem)=>`/threads/${threadId}/inbox/${i.id}`;
 const rows=view.items.map(i=><article className='queued' key={i.id}>
  {editing===i.id?<><textarea aria-label='edit queued message' value={text} onChange={e=>setText(e.target.value)}/><button onClick={()=>void act(()=>api(path(i),{method:'PATCH',body:JSON.stringify({text})}))}>Save</button><button onClick={()=>setEditing(null)}>Cancel</button></>
  :<><p>{i.text}</p><small>{stateLabel(i)}</small>
   <button onClick={()=>{setEditing(i.id);setText(i.text)}}>Edit</button>
   <button onClick={()=>void act(()=>api(`${path(i)}/send`,{method:'POST'}))}>Send now</button>
   <button onClick={()=>void act(()=>api(path(i),{method:'DELETE'}))}>Discard</button>
   <button onClick={()=>void act(async()=>{await api(path(i),{method:'DELETE'});onReturn(i.text)})}>Return to composer</button></>}
 </article>);
 const fold=queueFold(view);
 return <section aria-label='queue'>{note&&<p role='status'>{note}</p>}{fold.folded?<details><summary>{fold.label}</summary>{rows}</details>:rows}</section>;
}

/** CAPY-010: a sent message with Edit and an n/total version switcher. */
export function SentMessage({threadId,versions,onEdited}:{threadId:string;versions:Version[];onEdited:()=>void}){
 const[index,setIndex]=useState(versions.length-1);const[editing,setEditing]=useState(false);const[text,setText]=useState('');
 useEffect(()=>setIndex(versions.length-1),[versions.length]);
 const v=versions[Math.min(index,versions.length-1)];const last=versions[versions.length-1];
 const save=async()=>{await api(`/threads/${threadId}/inbox/${last.inboxId}/versions`,{method:'POST',body:JSON.stringify({text})});setEditing(false);onEdited()};
 if(editing)return <><textarea aria-label='edit sent message' value={text} onChange={e=>setText(e.target.value)}/><button onClick={()=>void save()}>Save as new version</button><button onClick={()=>setEditing(false)}>Cancel</button></>;
 return <><p>{v.text}</p>
  {versions.length>1&&<span className='versions'><button aria-label='previous version' disabled={index===0} onClick={()=>setIndex(index-1)}>‹</button><span aria-label='version'>{switcherLabel(index,versions.length)}</span><button aria-label='next version' disabled={index>=versions.length-1} onClick={()=>setIndex(index+1)}>›</button></span>}
  <button onClick={()=>{setText(last.text);setEditing(true)}}>Edit</button></>;
}

/** CAPY-026: context meter and Compact at. */
export function ContextMeter({threadId,tick}:{threadId:string;tick:number}){
 const[ctx,setCtx]=useState<Meter|null>(null);const[limit,setLimit]=useState<number|null>(null);const[pct,setPct]=useState('');
 useEffect(()=>{api(`/threads/${threadId}/context`).then((c:Meter)=>{setCtx(c);setPct(String(Math.round(c.compactAt*100)))}).catch(()=>{})},[threadId,tick]);
 useEffect(()=>{api(`/threads/${threadId}`).then((t:{engine?:{contextWindow?:number}})=>setLimit(t?.engine?.contextWindow??null)).catch(()=>{})},[threadId]);
 if(!ctx||typeof ctx.usedTokens!=='number')return null;const m=meterView(ctx,limit);
 const save=async()=>{const c=await api(`/threads/${threadId}/context`,{method:'PATCH',body:JSON.stringify(compactBody(Number(pct)))}).catch(()=>null);if(c)setCtx(c)};
 return <div className='context' aria-label='context'>
  <span>Context {m.label}</span>{m.ratio!==null&&<meter aria-label='context used' min={0} max={1} value={m.ratio}/>}
  <label>Compact at <input type='number' min={1} max={100} aria-label='compact at' value={pct} disabled={!m.editable} title={m.editable?undefined:'This agent does not support compaction'} onChange={e=>setPct(e.target.value)} onBlur={()=>{if(m.editable&&Number(pct)!==m.compactPercent)void save()}}/> %</label>
 </div>;
}
