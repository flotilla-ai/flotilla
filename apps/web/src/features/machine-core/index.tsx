import React,{useEffect,useState} from 'react';import {api,money} from '../../lib/api.js';
type Size={size:string;memMb:number;cpus:number;microUsdPerHour:number;allowed:boolean};
export type Limits={ramMb:number;serviceRamMb:number;sizes:Size[];kernel:{netfilter:string[]}};
export type MachineState={state:string;size:string|null;keepAwakeUntil:string|null;deleteAt:string|null};
type Props={limits:Limits;size:string;state:MachineState|null;setSize:(s:string)=>void;wake:()=>void;keepAwake:(on:boolean)=>void};
export function MachinePanel({limits,size,state,setSize,wake,keepAwake}:Props){
 return <section><h2>Machine</h2><label>Size <select aria-label='machine size' value={size} onChange={e=>setSize(e.target.value)}>{limits.sizes.map(s=><option key={s.size} value={s.size} disabled={!s.allowed}>{s.size} · {s.memMb/1024} GB · {s.cpus} CPU · {money(s.microUsdPerHour)}/h{s.allowed?'':' (bigger plan)'}</option>)}</select></label>
  <p><small>Billed only while awake. Concurrent RAM limit {limits.ramMb} MB ({limits.serviceRamMb} MB for API service users). No /dev/kvm, kernel modules or {limits.kernel.netfilter.join('; ')}.</small></p>
  {state&&<div className='row'><span>Machine {state.state}</span>{state.state!=='awake'&&state.state!=='starting'&&<button onClick={wake}>Wake machine</button>}
   {state.keepAwakeUntil?<><span>Kept awake until {new Date(state.keepAwakeUntil).toISOString().slice(11,16)} UTC</span><button onClick={()=>keepAwake(false)}>Cancel keep awake</button></>:<button onClick={()=>keepAwake(true)}>Keep awake 4 h</button>}
   {state.state==='sleeping'&&state.deleteAt&&<small>Deleted {state.deleteAt.slice(0,10)} unless woken</small>}</div>}</section>}
function Machine(){const[limits,setLimits]=useState<Limits|null>(null);const[projectId,setProjectId]=useState('');const[size,setSz]=useState('small');const[threadId,setThreadId]=useState('');const[state,setState]=useState<MachineState|null>(null);const[error,setError]=useState('');
 useEffect(()=>{api('/machines/limits').then(setLimits).catch(()=>{})},[]);
 useEffect(()=>{if(projectId)api(`/projects/${projectId}/machine`).then(r=>setSz(r.size)).catch(()=>{})},[projectId]);
 useEffect(()=>{if(threadId)api(`/threads/${threadId}/machine`).then(setState).catch(()=>setState(null))},[threadId]);
 const act=(p:Promise<MachineState>)=>{setError('');p.then(setState).catch(e=>setError(String(e.message)==='409'?"Cloud machine couldn't start":'failed'))};
 return <main><h1>Machine</h1><input aria-label='project id' value={projectId} onChange={e=>setProjectId(e.target.value)}/><input aria-label='thread id' value={threadId} onChange={e=>setThreadId(e.target.value)}/>
  {limits&&<MachinePanel limits={limits} size={size} state={threadId?state:null} setSize={s=>void api(`/projects/${projectId}/machine`,{method:'PUT',body:JSON.stringify({size:s})}).then(r=>setSz(r.size)).catch(()=>setError('size needs a bigger plan'))} wake={()=>act(api(`/threads/${threadId}/machine/wake`,{method:'POST'}))} keepAwake={on=>act(api(`/threads/${threadId}/machine/keep-awake`,on?{method:'PUT',body:'{}'}:{method:'DELETE'}))}/>}{error&&<p>{error}</p>}</main>}
export default {path:'/machine',element:<Machine/>,nav:'Machine'}
