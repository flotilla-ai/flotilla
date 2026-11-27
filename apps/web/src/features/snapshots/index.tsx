import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
type Step={step:string;state:'passed'|'failed'|'skipped';output:string;ms:number};
type Build={id:string;state:'running'|'succeeded'|'failed';failedStep:string|null;environmentVersion:number;tier:number;usedGb:number|null;images:{tier:number;ref:string}[];steps:Step[];createdAt:string|null};
type Spec={enabled:boolean;repos:string[];tier:64|128|256;alsoSmaller:boolean};
const needsYou='#f28c28';
function BuildRow({projectId,b}:{projectId:string;b:Build}){const[ask,setAsk]=useState<string|null>(null);
 useEffect(()=>{if(b.state==='failed')void api(`/projects/${projectId}/snapshots/builds/${b.id}`).then(d=>setAsk(d.ask)).catch(()=>null)},[b.id]);
 return <div className='card' aria-label={`build ${b.id}`}><div><b style={{color:b.state==='failed'?needsYou:'#eee'}}>{b.state}</b> {b.id} env v{b.environmentVersion} {b.tier} GB{b.failedStep&&<> at {b.failedStep}</>}{b.usedGb!==null&&<small> {b.usedGb.toFixed(2)} GB used</small>}</div>
  {b.images.map(i=><div key={i.ref}><small>{i.tier} GB {i.ref}</small></div>)}
  {b.steps.map(s=><details key={s.step} open={s.state==='failed'}><summary>{s.step} {s.state} {s.ms} ms</summary><pre style={{whiteSpace:'pre-wrap',background:'#090909'}}>{s.output}</pre></details>)}
  {ask&&<a href={`#/compose?prompt=${encodeURIComponent(ask)}`}>Ask why it failed</a>}
 </div>}
function Snapshots(){const[projectId,setProjectId]=useState('');const[spec,setSpec]=useState<Spec>({enabled:true,repos:[],tier:64,alsoSmaller:false});const[builds,setBuilds]=useState<Build[]>([]);const[boot,setBoot]=useState('');const[error,setError]=useState('');
 const load=async()=>{const s=await api(`/projects/${projectId}/snapshot`);if(s.spec)setSpec(s.spec);setBoot(s.boot.image);setBuilds((await api(`/projects/${projectId}/snapshots/builds`)).items)};
 useEffect(()=>{if(projectId)void load().catch(()=>setError('project not found'))},[projectId]);
 const save=async()=>{setError('');try{await api(`/projects/${projectId}/snapshot`,{method:'PUT',body:JSON.stringify({spec})});await load()}catch{setError('not saved: repos must be in this project')}};
 return <main><h1>Snapshots</h1><input aria-label='project id' value={projectId} onChange={e=>setProjectId(e.target.value)}/>
  <label><input type='checkbox' checked={spec.enabled} onChange={e=>setSpec({...spec,enabled:e.target.checked})}/> Enabled</label>
  <input aria-label='repos' value={spec.repos.join(', ')} onChange={e=>setSpec({...spec,repos:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/>
  <select aria-label='disk tier' value={spec.tier} onChange={e=>setSpec({...spec,tier:Number(e.target.value) as Spec['tier']})}>{[64,128,256].map(t=><option key={t} value={t}>{t} GB</option>)}</select>
  <label><input type='checkbox' checked={spec.alsoSmaller} onChange={e=>setSpec({...spec,alsoSmaller:e.target.checked})}/> Also snapshot smaller sizes</label>
  <button onClick={()=>void save()}>Save snapshot settings</button><button onClick={async()=>{await api(`/projects/${projectId}/snapshot/rebuild`,{method:'POST'}).catch(()=>setError('enable snapshots first'));}}>Rebuild</button>{error&&<p>{error}</p>}
  {boot&&<p>Boots from {boot}</p>}
  <h2>Build history</h2>{builds.map(b=><BuildRow key={b.id} projectId={projectId} b={b}/>)}
 </main>}
export default {path:'/snapshots',element:<Snapshots/>,nav:'Snapshots'}
