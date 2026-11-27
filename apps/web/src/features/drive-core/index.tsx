import React,{useEffect,useRef,useState} from 'react';import {api} from '../../lib/api.js';
import {markdownOutline,simpleDiff,utf8Text} from './drive-ux.js';
type Scope={kind:string;id?:string;userId?:string};type Usage={scope:Scope;usedBytes:number;limitBytes:number;full:boolean};
type Item={id:string;path:string;name:string;type:'file'|'folder';size:number;version:number};type Card={code:string;title:string;nextStep:string};
type Version={version:number;at:string;source:string};type Share={id:string;itemId:string;path:string;access:'read'|'write'};
const key=(s:Scope)=>s.kind==='org'||s.kind==='user'?s.kind:`${s.kind}:${s.id}`;
const label=(s:Scope)=>({org:'Organization',user:'Personal',project:'Project','project-user':'Project + personal',captain:'Captain',automation:'Automation'} as Record<string,string>)[s.kind]+(s.id&&s.kind!=='user'?` ${s.id}`:'');
const mb=(n:number)=>`${(n/1048576).toFixed(1)} MiB`;
async function put(scope:string,path:string,body:BodyInit,base?:number):Promise<Card|null>{const csrf=sessionStorage.getItem('csrf');const r=await fetch(`/api/v1/drive/files?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(path)}${base===undefined?'':`&baseVersion=${base}`}`,{method:'PUT',body,headers:{'content-type':'application/octet-stream',...(csrf?{'x-flotilla-csrf':csrf}:{})}});if(r.ok)return null;const b=await r.json().catch(()=>({}));return b.card??{code:'save_failed',title:'Drive changes were not saved',nextStep:b.error??`HTTP ${r.status}`}}
async function textOf(url:string){const r=await fetch(url);if(!r.ok)throw new Error(String(r.status));return utf8Text(await r.arrayBuffer())}

export function DriveEditor({scope,item,onSaved}:{scope:string;item:Item;onSaved:(card:Card|null)=>Promise<void>}){
 const[text,setText]=useState('');const[version,setVersion]=useState(item.version);const ta=useRef<HTMLTextAreaElement>(null);const[versions,setVersions]=useState<Version[]>([]);const[a,setA]=useState(0);const[b,setB]=useState(0);const[diff,setDiff]=useState('');const[share,setShare]=useState('');const[err,setErr]=useState('');
 useEffect(()=>{setErr('');setText('');setVersion(item.version);void textOf(`/api/v1/drive/items/${item.id}/content`).then(setText).catch(()=>setErr('This is not a UTF-8 text file'));api(`/drive/items/${item.id}/versions`).then((r:{items:Version[]})=>{setVersions(r.items);setA(r.items.at(-1)?.version??0);setB(r.items[0]?.version??0)}).catch(()=>{})},[item.id]);
 useEffect(()=>{if(!a||!b)return;if(a===b){setDiff('Pick two different versions to compare.');return}void Promise.all([textOf(`/api/v1/drive/items/${item.id}/versions/${a}/content`),textOf(`/api/v1/drive/items/${item.id}/versions/${b}/content`)]).then(([x,y])=>setDiff(simpleDiff(x,y)||'No line differences')).catch(()=>setDiff(''))},[a,b,item.id]);
 const save=async()=>{const c=await put(scope,item.path,text,version);if(!c){const meta=await api(`/drive/items/${item.id}`) as Item;setVersion(meta.version);setText(await textOf(`/api/v1/drive/items/${item.id}/content`))}await onSaved(c)};
 const jump=(line:number)=>{const pos=text.split('\n').slice(0,line-1).reduce((n,l)=>n+l.length+1,0);ta.current?.focus();ta.current?.setSelectionRange(pos,pos)};
 const makeShare=async(access:'read'|'write')=>{const s=await api(`/drive/items/${item.id}/shares`,{method:'POST',body:JSON.stringify({access})});const u=new URL(s.url,location.href).href;setShare(u);await navigator.clipboard?.writeText(u).catch(()=>undefined)};
 const outline=item.name.endsWith('.md')?markdownOutline(text):[];
 return <section aria-label='drive editor'><h2>{item.path}</h2>{err&&<p>{err}</p>}<textarea ref={ta} aria-label='file content' rows={12} value={text} onChange={e=>setText(e.target.value)}/><button disabled={!!err} onClick={()=>void save()}>Save</button>
  {outline.length>0&&<nav aria-label='markdown outline'><b>Outline</b>{outline.map(h=><div key={h.line} style={{paddingLeft:(h.level-1)*12}}><a href={`#line-${h.line}`}>{h.text}</a></div>)}</nav>}
  <div><button onClick={()=>void makeShare('read')}>Share read link</button><button onClick={()=>void makeShare('write')}>Share write link</button>{share&&<small> copied: {share}</small>}</div>
  {versions.length>1&&<section><b>Compare versions</b><select aria-label='compare from' value={a} onChange={e=>setA(Number(e.target.value))}>{versions.map(v=><option key={v.version} value={v.version}>v{v.version}</option>)}</select><select aria-label='compare to' value={b} onChange={e=>setB(Number(e.target.value))}>{versions.map(v=><option key={v.version} value={v.version}>v{v.version}</option>)}</select><pre aria-label='version diff'>{diff}</pre></section>}
 </section>;
}

export function ThreadDrivePane(){
 const[items,setItems]=useState<Item[]>([]);const[open,setOpen]=useState<Item|null>(null);const[card,setCard]=useState<Card|null>(null);
 const load=()=>api('/drive/items?scope=user').then((r:{items:Item[]})=>setItems(r.items.filter(i=>i.type==='file'))).catch(()=>{});
 useEffect(()=>{void load()},[]);
 return <aside aria-label='thread drive' className='drive-side'><h2>Drive</h2>{card&&<div role='alert'><b>{card.title}</b><p>{card.nextStep}</p></div>}{items.slice(0,20).map(i=><button className='row' key={i.id} onClick={()=>setOpen(i)}>{i.path}</button>)}{open&&<DriveEditor scope='user' item={open} onSaved={async c=>{setCard(c);await load()}}/>}</aside>;
}

function Drive(){const[scopes,setScopes]=useState<Usage[]>([]);const[scope,setScope]=useState('user');const[folder,setFolder]=useState('');const[items,setItems]=useState<Item[]>([]);const[open,setOpen]=useState<Item|null>(null);const[card,setCard]=useState<Card|null>(null);const[name,setName]=useState('');const[shares,setShares]=useState<Share[]>([]);
 const load=async()=>{setScopes((await api('/drive/scopes')).items);setItems((await api(`/drive/items?scope=${encodeURIComponent(scope)}${folder?`&parent=${encodeURIComponent(folder)}`:''}`)).items);setShares((await api('/drive/shares')).items)};
 useEffect(()=>{void load().catch(()=>undefined)},[scope,folder]);
 const within=(n:string)=>folder?`${folder}/${n}`:n;const done=async(c:Card|null)=>{setCard(c);await load()};
 const usage=scopes.find(s=>key(s.scope)===scope);
 return <main><h1>Drive</h1>
  <select aria-label='drive' value={scope} onChange={e=>{setScope(e.target.value);setFolder('');setOpen(null)}}>{scopes.map(s=><option key={key(s.scope)} value={key(s.scope)}>{label(s.scope)}</option>)}</select>
  {usage&&<small> {mb(usage.usedBytes)} of {mb(usage.limitBytes)}</small>}
  {card&&<div role='alert' className='card' style={{borderColor:'#f28c28'}}><b>{card.title}</b><p>{card.nextStep}</p><button onClick={()=>setCard(null)}>Dismiss</button></div>}
  <div>{folder&&<button onClick={()=>setFolder(folder.split('/').slice(0,-1).join('/'))}>Up</button>} <span>/{folder}</span></div>
  <div className='list'>{items.map(i=><div className='row' key={i.id}><button onClick={()=>i.type==='folder'?setFolder(i.path):setOpen(i)}>{i.type==='folder'?`${i.name}/`:i.name}</button><span>{i.type==='file'?`${i.size} B v${i.version}`:''}</span><button aria-label={`delete ${i.name}`} onClick={async()=>{await api(`/drive/items/${i.id}`,{method:'DELETE'});if(open?.id===i.id)setOpen(null);await load()}}>Delete</button></div>)}</div>
  {open&&<DriveEditor scope={scope} item={open} onSaved={done}/>}
  <div><input aria-label='new file name' value={name} onChange={e=>setName(e.target.value)}/><button onClick={async()=>{if(name)await done(await put(scope,within(name),'',0));setName('')}}>New file</button>
  <input aria-label='upload' type='file' onChange={async e=>{const f=e.target.files?.[0];if(f)await done(await put(scope,within(f.name),f));e.target.value=''}}/></div>
  <section aria-label='shared view'><h2>Shared links</h2>{shares.map(s=><div className='row' key={s.id}><span>{s.path} ({s.access})</span><button onClick={async()=>{await api(`/drive/shares/${s.id}`,{method:'DELETE'});await load()}}>Revoke</button></div>)}</section>
 </main>}
export default {path:'/drive',nav:'Drive',element:<Drive/>};
