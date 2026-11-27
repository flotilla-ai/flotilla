import React,{useEffect,useRef,useState} from 'react';import {api} from '../../lib/api.js';
import {deepLinkPrompt,fold,keyAction,loadKeymap,mentionQuery,quote,saveKeymap,sections,type ComposerKeymap,type Ev,type ThreadSection} from './thread-composer.js';
import {keyEventAction,loadShortcuts} from '../keyboard-shortcuts/model.js';
import './thread-composer.css';
import {InlineVisuals} from '../thread-media/index.js';
type Ref={id:string;code:string;title:string};type Attachment={fileId:string;name:string};
type Card={id:string;title:string;inline:null|{kind:'env';name:string}|{kind:'desktop';url:string}|{kind:'feedback';title:string;body:string}};
const text=(e:Ev)=>typeof e.payload==='string'?e.payload:e.payload?.text??e.payload?.delta??JSON.stringify(e.payload);
const lookup=(q:string)=>api(`/thread-lookup?q=${encodeURIComponent(q)}`).then((r:{items:Ref[]})=>r.items).catch(()=>[] as Ref[]);

async function upload(f:File):Promise<Attachment>{
 const g=await api('/files',{method:'POST',body:JSON.stringify({name:f.name,contentType:f.type||'application/octet-stream',size:f.size})});
 const r=await fetch(new URL(g.uploadUrl,location.href).pathname+new URL(g.uploadUrl,location.href).search,{method:'PUT',headers:g.headers,body:f});if(!r.ok)throw new Error(String(r.status));
 return {fileId:g.fileId,name:f.name};
}

export function CommandPalette(){
 const[open,setOpen]=useState(false);const[q,setQ]=useState('');const[hits,setHits]=useState<Ref[]>([]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.isComposing||e.keyCode===229)return;if(e.key==='Escape'){setOpen(false);return}const target=e.target as HTMLElement|null;if(target?.closest('input,textarea,select,[contenteditable=true]'))return;const mac=navigator.platform.toLowerCase().includes('mac');if(keyEventAction(loadShortcuts(localStorage),e.key,{ctrl:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,meta:e.metaKey},mac)==='commandMenu'){e.preventDefault();setOpen(o=>!o)}};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[]);
 useEffect(()=>{if(open&&q)void lookup(q).then(setHits);else setHits([])},[open,q]);
 if(!open)return null;
 const go=(t:Ref)=>{location.hash=`#/threads/${t.id}`;setOpen(false);setQ('')};
 return <dialog open className='card palette' aria-label='command palette'><input autoFocus aria-label='go to thread' value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&hits[0])go(hits[0])}}/>{hits.map(t=><button key={t.id} onClick={()=>go(t)}>{t.code} {t.title}</button>)}</dialog>;
}

function Composer({value,setValue,onSend,threadId,attach=true}:{value:string;setValue:(v:string)=>void;onSend:(text:string,files:Attachment[],mode:'queue'|'interrupt')=>Promise<void>;threadId?:string;attach?:boolean}){
 const[keymap,setKeymap]=useState<ComposerKeymap>(()=>loadKeymap(localStorage));const[files,setFiles]=useState<Attachment[]>([]);const[hits,setHits]=useState<Ref[]>([]);const[uploading,setUploading]=useState(0);const ta=useRef<HTMLTextAreaElement>(null);
 const send=async(mode:'queue'|'interrupt'='queue')=>{if(uploading||!value.trim()&&!files.length)return;await onSend(value,files,mode);setValue('');setFiles([])};
 const changed=(v:string,caret:number)=>{setValue(v);const m=mentionQuery(v,caret);if(m)void lookup(m).then(setHits);else setHits([])};
 const mention=(t:Ref)=>{const c=ta.current?.selectionStart??value.length;const head=value.slice(0,c).replace(/@[\w-]*$/,`@${t.code} `);setValue(head+value.slice(c));setHits([])};
 return <form className='composer' onSubmit={e=>{e.preventDefault();void send()}}>
  <textarea ref={ta} aria-label='message' value={value} onChange={e=>changed(e.target.value,e.target.selectionStart)} onKeyDown={e=>{const a=keyAction(keymap,e);if(!a)return;e.preventDefault();if(a==='send')void send();else{const t=e.currentTarget,s=t.selectionStart;setValue(value.slice(0,s)+'\n'+value.slice(t.selectionEnd));requestAnimationFrame(()=>t.setSelectionRange(s+1,s+1))}}}/>
  {hits.map(t=><button type='button' key={t.id} onClick={()=>mention(t)}>@{t.code} {t.title}</button>)}
  {files.map(f=><small key={f.fileId}>{f.name}</small>)}
  {attach&&<input type='file' multiple aria-label='attach' onChange={e=>{const l=[...(e.target.files??[])];e.target.value='';setUploading(n=>n+l.length);void Promise.all(l.map(upload)).then(x=>setFiles(f=>[...f,...x])).finally(()=>setUploading(n=>n-l.length))}}/>}
  <select aria-label='send key' value={keymap.send} onChange={e=>{const k={send:e.target.value as ComposerKeymap['send']};saveKeymap(localStorage,k);setKeymap(k)}}><option value='enter'>Enter sends</option><option value='mod+enter'>⌘/Ctrl+Enter sends</option></select>
  <button type='submit' disabled={uploading>0}>Queue</button>
  {threadId&&<><button type='button' onClick={()=>void send('interrupt')}>Interrupt</button><button type='button' onClick={()=>void api(`/threads/${threadId}/stop`,{method:'POST'})}>Stop</button></>}
 </form>;
}

function RequestCards({threadId}:{threadId:string}){
 const[cards,setCards]=useState<Card[]>([]);const[undo,setUndo]=useState<Card|null>(null);const[val,setVal]=useState<Record<string,string>>({});
 const load=()=>api(`/threads/${threadId}/requests`).then((r:{items:Card[]})=>setCards(r.items)).catch(()=>{});
 useEffect(()=>{void load()},[threadId]);
 const act=async(c:Card,path:string,body?:unknown)=>{await api(`/approvals/${c.id}/${path}`,{method:'POST',body:body===undefined?undefined:JSON.stringify(body)});setCards(x=>x.filter(y=>y.id!==c.id));if(path==='dismiss')setUndo(c)};
 return <section aria-label='requests'>
  {cards.map(c=><article className='needs' key={c.id}><b>{c.title}</b>
   {c.inline?.kind==='env'&&<><input type='password' aria-label={c.inline.name} value={val[c.id]??''} onChange={e=>setVal(v=>({...v,[c.id]:e.target.value}))}/><button onClick={async()=>{await api('/me/environment-variables',{method:'PUT',body:JSON.stringify({variables:[{name:(c.inline as {name:string}).name,value:val[c.id]??''}]})});await act(c,'answer',{optionId:'done'})}}>Save</button></>}
   {c.inline?.kind==='desktop'&&<iframe title='desktop' src={c.inline.url}/>}
   {c.inline?.kind==='feedback'&&<><textarea aria-label='feedback report' value={val[c.id]??c.inline.body} onChange={e=>setVal(v=>({...v,[c.id]:e.target.value}))}/><button onClick={()=>void act(c,'feedback',{optionId:'send',body:val[c.id]??(c.inline as {body:string}).body})}>Send report</button><button onClick={()=>void act(c,'feedback',{optionId:'discard'})}>Discard</button></>}
   <button onClick={()=>void act(c,'later',{minutes:60})}>Later</button><button onClick={()=>void act(c,'dismiss')}>Dismiss</button>
  </article>)}
  {undo&&<p>Dismissed <button onClick={async()=>{await api(`/approvals/${undo.id}/undo`,{method:'POST'});setUndo(null);await load()}}>Undo</button></p>}
 </section>;
}

export function ThreadComposer({threadId,events:raw}:{threadId:string;events:Ev[]}){const events=Array.isArray(raw)?raw:[];
 const[draft,setDraft]=useState('');const restored=useRef(false);const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const items=fold(events);const humans=events.filter(e=>e.kind==='user.message').sort((a,b)=>a.seq-b.seq);
 useEffect(()=>{if(restored.current||!events.length)return;restored.current=true;void api(`/threads/${threadId}/reading-place`).then((p:{seq:number|null;offset:number})=>{if(p.seq!==null)document.getElementById(`ev-${p.seq}`)?.scrollIntoView({block:'start'})}).catch(()=>{})},[threadId,events.length]);
 useEffect(()=>{const save=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{const el=[...document.querySelectorAll<HTMLElement>('[data-seq]')].find(x=>x.getBoundingClientRect().bottom>0);if(el)void api(`/threads/${threadId}/reading-place`,{method:'PUT',body:JSON.stringify({seq:Number(el.dataset.seq),offset:Math.round(-el.getBoundingClientRect().top)})}).catch(()=>{})},300)};addEventListener('scroll',save,{passive:true});return()=>{removeEventListener('scroll',save);clearTimeout(timer.current)}},[threadId]);
 const reply=(s:ThreadSection)=>setDraft(d=>quote(s)+d);
 const send=async(text:string,files:Attachment[],mode:'queue'|'interrupt')=>{
  const fb=/^\/feedback\s+(.+)\n?([\s\S]*)$/.exec(text);
  if(fb){await api(`/threads/${threadId}/feedback`,{method:'POST',body:JSON.stringify({title:fb[1].trim(),body:fb[2].trim()||fb[1].trim()})});location.reload();return}
  if(files.length){await api(`/threads/${threadId}/inbox`,{method:'POST',body:JSON.stringify({text,mode,attachments:files.map(f=>f.fileId)})});return}
  if(mode==='interrupt')await api(`/threads/${threadId}/interrupt`,{method:'POST'});
  await api(`/threads/${threadId}/message`,{method:'POST',body:JSON.stringify({text})});
 };
 return <>
  <nav className='ticks' aria-label='ticks'>{humans.map((e,i)=><button key={e.seq} aria-label={`Jump to ask ${i+1}`} onClick={()=>document.getElementById(`ev-${e.seq}`)?.scrollIntoView({block:'start'})}/>)}</nav>
  <section className='events'>{items.map(x=>x.kind==='work'?<details key={`w${x.seq}`} data-seq={x.seq}><summary>{x.label}</summary>{x.events.map(e=><small key={e.seq}>{e.kind}</small>)}</details>
   :(x.event.kind==='agent.message'||x.event.kind==='agent.delta')?<article key={x.event.seq} id={`ev-${x.event.seq}`} data-seq={x.event.seq}>{sections(x.event.seq,text(x.event)).map(s=><section key={s.index}>{s.heading&&<h3>{s.heading}</h3>}<p>{s.text}</p><InlineVisuals markdown={s.text}/><button onClick={()=>reply(s)}>Reply</button></section>)}</article>
   :<article key={x.event.seq} id={`ev-${x.event.seq}`} data-seq={x.event.seq}><small>{x.event.kind}</small><p>{text(x.event)}</p></article>)}</section>
  <RequestCards threadId={threadId}/>
  <Composer threadId={threadId} value={draft} setValue={setDraft} onSend={send}/>
 </>;
}

function Compose(){
 const[projects,setProjects]=useState<{id:string;name:string}[]>([]);const[projectId,setProject]=useState('');const[draft,setDraft]=useState(()=>deepLinkPrompt(location.hash,location.search));
 useEffect(()=>{api('/projects').then(setProjects).catch(()=>{})},[]);
 const create=async(text:string)=>{const t=await api('/threads',{method:'POST',body:JSON.stringify({projectId:projectId||null,title:text.split('\n')[0].slice(0,80),prompt:text,engine:'fake'})});location.hash=`#/threads/${t.id}`};
 return <main><h1>New thread</h1><select aria-label='project' value={projectId} onChange={e=>setProject(e.target.value)}><option value=''>No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><Composer value={draft} setValue={setDraft} onSend={create} attach={false}/></main>;
}
export default {path:'/compose',element:<Compose/>,nav:'Compose'}
