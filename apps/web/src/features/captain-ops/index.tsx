import React,{useEffect,useState}from'react';import{api}from'../../lib/api.js';
type Digest={file:string;content:string;needsYou:string[];truncated:boolean};
export function CaptainDigestPanel({captainId}:{captainId:string}){const[d,setD]=useState<Digest|null>(null);useEffect(()=>{if(captainId)api(`/captains/${captainId}/digest`).then(setD).catch(()=>{})},[captainId]);return<section><h2>Digest</h2>{!d&&<p>No digest loaded.</p>}{d&&<><p><small>{d.file}{d.truncated?' · truncated to 64 KiB':''}</small></p><h3>Top needs you</h3><ol>{d.needsYou.map(x=><li key={x}>{x}</li>)}</ol><pre>{d.content}</pre></>}</section>}
function Page(){const[id,setId]=useState('');return<main><h1>Captain operations</h1><input aria-label='captain id'value={id}onChange={e=>setId(e.target.value)}/><CaptainDigestPanel captainId={id}/><p><small>Templates: Feature Captain, Triage Captain, Janitor Captain.</small></p></main>}
export default{path:'/captain-ops',element:<Page/>,nav:'Captain ops'}
