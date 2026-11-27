import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
export type Watch={id:string;threadId:string;threadTitle:string;kind:string;label:string;url:string|null};
/** Active watches across my threads; each label is the awaited event and links to it. */
export function WatchList({watches,stop}:{watches:Watch[];stop:(id:string)=>void}){return <section><h2>Watching</h2>{watches.length?watches.map(w=><div className='row' key={w.id}><a href={w.url??`#/threads/${w.threadId}`}>{w.label}</a><a href={`#/threads/${w.threadId}`}>{w.threadTitle}</a><button onClick={()=>stop(w.id)}>Stop watching</button></div>):<p>Nothing is being watched.</p>}</section>}
function Watches(){const[watches,setWatches]=useState<Watch[]>([]);const load=()=>api('/me/watches').then(r=>setWatches(r.watches)).catch(()=>setWatches([]));
 useEffect(()=>{void load()},[]);
 return <main><h1>Activity</h1><WatchList watches={watches} stop={id=>void api(`/watches/${id}`,{method:'DELETE'}).then(load)}/></main>}
export default {path:'/watches',element:<Watches/>,nav:'Activity'}
