import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
export type Policy={runOut:'ask'|'ask-before-free'|'keep-going';neverFree:boolean;excludedAdapters:string[];background:unknown};
export type ModelRow={id:string;adapter:string;displayName:string;contextWindow:number|null;connections:{id:string;label:string;badge:string}[]};
export type RunOut={id:string;question:string;options:{id:string;label:string}[]};
const runOutLabels:[Policy['runOut'],string][]=[['ask','Ask me'],['ask-before-free','Ask before free models'],['keep-going','Keep going']];
export function RunOutCard({card,onAnswer}:{card:RunOut;onAnswer:(optionId:string)=>void}){return <article className='needs'><b>Connection ran out</b><p>{card.question}</p>{card.options.map(o=><button key={o.id} onClick={()=>onAnswer(o.id)}>{o.label}</button>)}</article>}
export function PolicyForm({policy,adapters,onChange}:{policy:Policy;adapters:string[];onChange:(p:Policy)=>void}){return <form className='card'>
  <label>When a connection runs out <select aria-label='run-out' value={policy.runOut} onChange={e=>onChange({...policy,runOut:e.target.value as Policy['runOut']})}>{runOutLabels.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <label><input type='checkbox' aria-label='never-free' checked={policy.neverFree} onChange={e=>onChange({...policy,neverFree:e.target.checked})}/> Never use free models</label>
  {adapters.map(a=><label key={a}><input type='checkbox' aria-label={`exclude-${a}`} checked={policy.excludedAdapters.includes(a)} onChange={e=>onChange({...policy,excludedAdapters:e.target.checked?[...policy.excludedAdapters,a]:policy.excludedAdapters.filter(x=>x!==a)})}/> Exclude {a} models</label>)}
</form>}
export function ModelTable({rows}:{rows:ModelRow[]}){return <div className='list'>{rows.map(m=><div className='row' key={m.id}><span>{m.displayName}</span><span>{m.contextWindow?`${m.contextWindow.toLocaleString('en-US')} tokens`:''}</span><span>{m.connections.map(c=>c.label).join(' → ')}</span></div>)}</div>}
function Models(){const[policy,setPolicy]=useState<Policy|null>(null);const[rows,setRows]=useState<ModelRow[]>([]);const[cards,setCards]=useState<RunOut[]>([]);
  const load=()=>{api('/me/model-policy').then(setPolicy).catch(()=>{});api('/models').then(r=>setRows(r.items)).catch(()=>{});api('/approvals?state=open').then((a:(RunOut&{kind:string})[])=>setCards(a.filter(x=>x.kind==='run-out'))).catch(()=>{})};useEffect(load,[]);
  const save=async(p:Policy)=>{setPolicy(await api('/me/model-policy',{method:'PUT',body:JSON.stringify(p)}));api('/models').then(r=>setRows(r.items)).catch(()=>{})};
  const answer=async(card:RunOut,optionId:string)=>{await api(`/approvals/${card.id}/answer`,{method:'POST',body:JSON.stringify({optionId})});setCards(x=>x.filter(y=>y.id!==card.id))};
  return <main><h1>Models</h1>{cards.map(c=><RunOutCard key={c.id} card={c} onAnswer={o=>void answer(c,o)}/>)}{policy&&<PolicyForm policy={policy} adapters={['claude-code','codex']} onChange={p=>void save(p)}/>}<ModelTable rows={rows}/></main>}
export default {path:'/models',element:<Models/>,nav:'Models'}
