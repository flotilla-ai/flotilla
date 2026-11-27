import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
type Step={name:string;ok:boolean|null;detail:string};type Test={ok:boolean;failingStep:string|null;httpStatus:number|null;checklist:string[];steps:Step[];tools:string[]};
export type Server={id:string;key:string;name:string;transport:'http'|'stdio';url:string|null;command:string[]|null;status:string;toolPrefix:string;lastTest:Test|null;auth:{kind:string;connection?:'none'|'pending'|'connected';flowId?:string|null;redirectUri?:string}};
type Card={id:string;kind:string;question:string;state:string};
const needsYou=(s:string)=>s==='failing'||s==='needs-auth'||s==='pending-browser';
export function ServerRow({server,test,connect,cancel}:{server:Server;test:()=>void;connect:()=>void;cancel:(flowId:string)=>void}){const t=server.lastTest;const o=server.auth;
 return <div className='row'><span>{server.key}</span><span>{server.transport==='http'?server.url:server.command?.join(' ')}</span><span style={{color:needsYou(server.status)?'#f28c28':'#999'}}>{server.status}</span>
  <button onClick={test}>Test</button>
  {o.kind==='oauth'&&o.connection==='pending'&&o.flowId?<span>Finish in your browser <button onClick={()=>cancel(o.flowId!)}>Cancel</button></span>:o.kind==='oauth'&&o.connection!=='connected'?<button onClick={connect}>Connect</button>:null}
  {t&&!t.ok&&t.failingStep&&<div>Failed at {t.failingStep}: {t.steps.find(s=>s.name===t.failingStep)?.detail}</div>}
  {t?.checklist.length?<ul aria-label='403 checklist'>{t.checklist.map(c=><li key={c}>{c}</li>)}</ul>:null}
  {t?.ok&&<small>{t.tools.map(x=>server.toolPrefix+x).join(', ')}</small>}
 </div>}
export function ReviewCard({card,answer}:{card:Card;answer:(optionId:'approve'|'decline')=>void}){return <div className='card'><b style={{color:'#f28c28'}}>Review</b> <span>{card.question}</span> <button onClick={()=>answer('approve')}>Approve</button> <button onClick={()=>answer('decline')}>Decline</button></div>}
function Mcp(){const[servers,setServers]=useState<Server[]>([]);const[cards,setCards]=useState<Card[]>([]);const[text,setText]=useState('');const[error,setError]=useState('');
 const load=async()=>{setServers((await api('/mcp/servers')).items);setCards(((await api('/approvals?state=open')) as Card[]).filter(c=>c.kind==='mcp'))};
 useEffect(()=>{void load().catch(()=>{})},[]);
 const act=async(f:()=>Promise<unknown>)=>{setError('');try{await f()}catch{setError('request failed')}await load().catch(()=>{})};
 return <main><h1>MCP servers</h1>{cards.map(c=><ReviewCard key={c.id} card={c} answer={o=>act(()=>api(`/approvals/${c.id}/answer`,{method:'POST',body:JSON.stringify({optionId:o})}))}/>)}
  <div className='list'>{servers.map(s=><ServerRow key={s.id} server={s} test={()=>act(()=>api(`/mcp/servers/${s.id}/test`,{method:'POST'}))} connect={()=>act(async()=>{const f=await api(`/mcp/servers/${s.id}/oauth/start`,{method:'POST'});open(f.authorizeUrl,'_blank')})} cancel={id=>act(()=>api(`/mcp/oauth/flows/${id}/cancel`,{method:'POST'}))}/>)}</div>
  <h2>Import</h2><textarea aria-label='import' rows={6} style={{width:'100%',background:'#090909',color:'#eee'}} placeholder='Claude Code JSON, Codex TOML, a URL or a command line' value={text} onChange={e=>setText(e.target.value)}/>
  <button onClick={()=>act(async()=>{await api('/mcp/import',{method:'POST',body:JSON.stringify({text})});setText('')})}>Import</button>{error&&<p>{error}</p>}
 </main>}
export default {path:'/mcp',element:<Mcp/>,nav:'MCP'}
