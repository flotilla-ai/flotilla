import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
type State='idle'|'running'|'ready'|'passed'|'failed'|'timeout'|'stopped';
type Menu={services:{name:string;state:State;readinessPort:number|null;preview:boolean}[];commands:{name:string;state:State;description:string}[];terminals:{name:string;state:State}[]};
type Version={version:number;source:string;note:string;spec:unknown;verification:{state:string}|null};
const dot=(s:State)=>s==='failed'||s==='timeout'?'#f28c28':s==='ready'||s==='passed'?'#eee':s==='running'?'#999':'#444';
const Dot=({state}:{state:State})=><span role='img' aria-label={`status ${state}`} style={{display:'inline-block',width:8,height:8,borderRadius:4,background:dot(state),marginRight:8}}/>;
export function EnvironmentMenu({threadId}:{threadId:string}){const[open,setOpen]=useState(false);const[menu,setMenu]=useState<Menu|null>(null);const load=()=>api(`/threads/${threadId}/environment`).then(setMenu);
 return <div><button aria-label='environment menu' onClick={()=>{setOpen(!open);void load()}}>+</button>{open&&menu&&<div role='menu' className='card'>
  <b>Services</b>{menu.services.map(s=><div key={s.name}><Dot state={s.state}/><span>{s.name}</span>{s.readinessPort!==null&&<small> :{s.readinessPort}</small>}{s.preview&&s.state==='ready'&&<small> preview</small>}</div>)}
  <b>Commands</b>{menu.commands.map(c=><div key={c.name}><Dot state={c.state}/><button role='menuitem' onClick={async()=>{await api(`/threads/${threadId}/environment/commands/${encodeURIComponent(c.name)}`,{method:'POST'}).catch(()=>null);await load()}}>{c.name}</button> <small>{c.description}</small></div>)}
  <b>Terminals</b>{menu.terminals.length?menu.terminals.map(t=><div key={t.name}><Dot state={t.state}/><span>{t.name}</span></div>):<small>none</small>}
 </div>}</div>}
function Environments(){const[projectId,setProjectId]=useState('');const[threadId,setThreadId]=useState('');const[text,setText]=useState('');const[history,setHistory]=useState<Version[]>([]);const[error,setError]=useState('');const[base,setBase]=useState(0);
 const load=async(id=projectId)=>{const cur=await api(`/projects/${id}/environment`);setText(JSON.stringify(cur.spec,null,2));setBase(cur.version);setHistory((await api(`/projects/${id}/environment/versions`)).items)};
 useEffect(()=>{if(projectId)void load().catch(()=>setError('project not found'))},[projectId]);
 return <main><h1>Environments</h1><input aria-label='project id' value={projectId} onChange={e=>setProjectId(e.target.value)}/>
  <textarea aria-label='environment spec' rows={14} style={{width:'100%',background:'#090909',color:'#eee'}} value={text} onChange={e=>setText(e.target.value)}/>
  <button onClick={async()=>{setError('');try{await api(`/projects/${projectId}/environment`,{method:'PUT',body:JSON.stringify({spec:JSON.parse(text),baseVersion:base})});await load()}catch{setError('not saved: invalid or changed since loaded (reload)')}}}>Save environment</button>{error&&<p>{error}</p>}
  <h2>History</h2>{history.map(v=><div key={v.version}>v{v.version} {v.source} {v.note} {v.verification?.state??''}</div>)}
  <h2>Thread</h2><input aria-label='thread id' value={threadId} onChange={e=>setThreadId(e.target.value)}/>{threadId&&<EnvironmentMenu threadId={threadId}/>}
 </main>}
export default {path:'/environments',element:<Environments/>,nav:'Environments'}
