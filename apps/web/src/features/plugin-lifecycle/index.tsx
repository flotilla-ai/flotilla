import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
export type Plugin={id:string;key:string;name:string;scope:'organization'|'user';version:string;updateState:string;connectionMode:string;privateThreadsOnly:boolean;keyNames:string[];serverKeys:string[]};
export function PluginRow({plugin,sync,approve,rollback}:{plugin:Plugin;sync:()=>void;approve:()=>void;rollback:()=>void}){
 return <div className='row'><span>{plugin.key}</span><span>{plugin.scope}</span><span>{plugin.version}</span><span style={{color:plugin.updateState==='needs-you'?'#f28c28':'#999'}}>{plugin.updateState}</span>
  <span>{plugin.privateThreadsOnly?'private threads only':'all thread visibility'}</span><span>{plugin.connectionMode}</span><small>keys: {plugin.keyNames.join(', ')||'none'}; servers: {plugin.serverKeys.join(', ')}</small>
  <button onClick={sync}>Sync</button>{plugin.updateState==='needs-you'&&<button onClick={approve}>Approve update</button>}<button onClick={rollback}>Roll back</button>
 </div>}
function PluginLifecycle(){const[items,setItems]=useState<Plugin[]>([]);const load=async()=>setItems((await api('/mcp/plugins')).items);useEffect(()=>{void load().catch(()=>{})},[]);
 const act=async(path:string)=>{await api(path,{method:'POST'});await load()};
 return <main><h1>MCP plugins</h1><p>GitHub-hosted Agent Plugins are synced manually; widened scopes or keys need approval before use.</p><div className='list'>{items.map(p=><PluginRow key={p.id} plugin={p} sync={()=>act(`/mcp/plugins/${p.id}/sync`)} approve={()=>act(`/mcp/plugins/${p.id}/approve-update`)} rollback={()=>act(`/mcp/plugins/${p.id}/rollback`)}/>)}</div></main>}
export default {path:'/mcp-plugins',element:<PluginLifecycle/>,nav:'Plugins'}
