import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
type Scope={kind:string;id?:string;userId?:string};type Usage={scope:Scope;usedBytes:number;limitBytes:number;full:boolean};
type Item={id:string;path:string;name:string;type:'file'|'folder';size:number;version:number};type Card={code:string;title:string;nextStep:string};
const key=(s:Scope)=>s.kind==='org'||s.kind==='user'?s.kind:`${s.kind}:${s.id}`;
const label=(s:Scope)=>({org:'Organization',user:'Personal',project:'Project','project-user':'Project + personal',captain:'Captain',automation:'Automation'} as Record<string,string>)[s.kind]+(s.id&&s.kind!=='user'?` ${s.id}`:'');
const mb=(n:number)=>`${(n/1048576).toFixed(1)} MiB`;
/** PUT raw bytes; a failed save returns its card (what happened, next step). */
async function put(scope:string,path:string,body:BodyInit,base?:number):Promise<Card|null>{const csrf=sessionStorage.getItem('csrf');const r=await fetch(`/api/v1/drive/files?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(path)}${base===undefined?'':`&baseVersion=${base}`}`,{method:'PUT',body,headers:{'content-type':'application/octet-stream',...(csrf?{'x-flotilla-csrf':csrf}:{})}});if(r.ok)return null;const b=await r.json().catch(()=>({}));return b.card??{code:'save_failed',title:'Drive changes were not saved',nextStep:b.error??`HTTP ${r.status}`}}
function Drive(){const[scopes,setScopes]=useState<Usage[]>([]);const[scope,setScope]=useState('user');const[folder,setFolder]=useState('');const[items,setItems]=useState<Item[]>([]);const[open,setOpen]=useState<Item|null>(null);const[text,setText]=useState('');const[card,setCard]=useState<Card|null>(null);const[name,setName]=useState('');
 const load=async()=>{setScopes((await api('/drive/scopes')).items);setItems((await api(`/drive/items?scope=${encodeURIComponent(scope)}${folder?`&parent=${encodeURIComponent(folder)}`:''}`)).items)};
 useEffect(()=>{void load().catch(()=>undefined)},[scope,folder]);
 const within=(n:string)=>folder?`${folder}/${n}`:n;const done=async(c:Card|null)=>{setCard(c);await load()};
 const usage=scopes.find(s=>key(s.scope)===scope);
 return <main><h1>Drive</h1>
  <select aria-label='drive' value={scope} onChange={e=>{setScope(e.target.value);setFolder('');setOpen(null)}}>{scopes.map(s=><option key={key(s.scope)} value={key(s.scope)}>{label(s.scope)}</option>)}</select>
  {usage&&<small> {mb(usage.usedBytes)} of {mb(usage.limitBytes)}</small>}
  {card&&<div role='alert' className='card' style={{borderColor:'#f28c28'}}><b>{card.title}</b><p>{card.nextStep}</p><button onClick={()=>setCard(null)}>Dismiss</button></div>}
  <div>{folder&&<button onClick={()=>setFolder(folder.split('/').slice(0,-1).join('/'))}>Up</button>} <span>/{folder}</span></div>
  <div className='list'>{items.map(i=><div className='row' key={i.id}><button onClick={async()=>{if(i.type==='folder'){setFolder(i.path);return}const r=await fetch(`/api/v1/drive/items/${i.id}/content`);setText(await r.text());setOpen(i)}}>{i.type==='folder'?`${i.name}/`:i.name}</button><span>{i.type==='file'?`${i.size} B v${i.version}`:''}</span><button aria-label={`delete ${i.name}`} onClick={async()=>{await api(`/drive/items/${i.id}`,{method:'DELETE'});if(open?.id===i.id)setOpen(null);await load()}}>Delete</button></div>)}</div>
  {open&&<section><h2>{open.path}</h2><textarea aria-label='file content' rows={12} value={text} onChange={e=>setText(e.target.value)}/><button onClick={async()=>{const c=await put(scope,open.path,text,open.version);if(!c)setOpen({...open,version:open.version+1});await done(c)}}>Save</button></section>}
  <div><input aria-label='new file name' value={name} onChange={e=>setName(e.target.value)}/><button onClick={async()=>{if(name)await done(await put(scope,within(name),''));setName('')}}>New file</button>
  <input aria-label='upload' type='file' onChange={async e=>{const f=e.target.files?.[0];if(f)await done(await put(scope,within(f.name),f));e.target.value=''}}/></div>
 </main>}
export default {path:'/drive',nav:'Drive',element:<Drive/>};
