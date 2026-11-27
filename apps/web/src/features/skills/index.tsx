import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
type Load={state:'loaded'}|{state:'not-loaded';reason:string}|{state:'replaced';by:string};
export type SkillItem={id:string;name:string;description:string;source:{kind:string};origin:string;files:Record<string,string>;load:Load};
const marker=(l:Load)=>l.state==='loaded'?'Loaded':l.state==='replaced'?`Replaced by ${l.by}`:`Not loaded: ${l.reason}`;
export function SkillList({items,toggle}:{items:SkillItem[];toggle:(s:SkillItem,disabled:boolean)=>void}){return <section>{items.map(s=>{const off=s.load.state==='not-loaded'&&s.load.reason==='turned off';return <div className='row' key={s.id}><strong>{s.name}</strong><span>{s.source.kind}{s.origin&&s.origin!==s.source.kind?` (from ${s.origin})`:''}</span><span>{s.description}</span><span>{marker(s.load)}</span>{(s.load.state==='loaded'||off)&&<button onClick={()=>toggle(s,!off)}>{off?'Turn on':'Turn off'}</button>}</div>})}</section>}
function Skills(){const[items,setItems]=useState<SkillItem[]>([]);const[err,setErr]=useState('');const[projects,setProjects]=useState<{id:string;name:string}[]>([]);const[pid,setPid]=useState('');
 const load=()=>api(`/skills${pid?`?projectId=${encodeURIComponent(pid)}`:''}`).then((r:{items:SkillItem[]})=>{setErr('');setItems(r.items)}).catch((e:Error)=>setErr(e.message));
 useEffect(()=>{api('/projects').then(setProjects).catch(()=>{})},[]);useEffect(()=>{void load()},[pid]);
 const toggle=(s:SkillItem,disabled:boolean)=>void api('/skills/disabled',{method:'PUT',body:JSON.stringify({source:s.source.kind,name:s.name,disabled})}).then(load);
 return <main><h1>Skills</h1><p><small>Invoke with $name, /name, @name or plain words. Loaded skills are mounted into every thread.</small></p><select aria-label='project' value={pid} onChange={e=>setPid(e.target.value)}><option value=''>Personal skills only</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name} (repo + project skills)</option>)}</select>{err&&<p role='alert'>{err}</p>}<SkillList items={items} toggle={toggle}/></main>}
export default {path:'/skills',element:<Skills/>,nav:'Skills'}
