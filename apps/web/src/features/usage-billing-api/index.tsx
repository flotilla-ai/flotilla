import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
export type Totals={usd:number;inputTokens:number;outputTokens:number;cacheTokens:number;machineSec:number};
export type UsageRow={key:string;label:string;totals:Totals};
export type Report={window:string;from:string;to:string;scope:'org'|'member';totals:Totals;byMember:UsageRow[];byModel:UsageRow[];byThread:UsageRow[];byItem:UsageRow[]};
export type Window={scope:string;scopeId:string;window:'month'|'lifetime';maxUsd:number|null;spent:number;reserved:number;remaining:number|null;state:'ok'|'warn'|'hit'};
export const usd=(micro:number)=>`$${(micro/1e6).toFixed(2)}`;
const tokens=(t:Totals)=>`${(t.inputTokens+t.outputTokens+t.cacheTokens).toLocaleString('en-US')} tokens`;
export function Budgets({windows}:{windows:Window[]}){return <div className='list'>{windows.map(w=><div className={w.state==='hit'?'row needs':'row'} key={`${w.scope}:${w.scopeId}`}>
  <span>{w.scope==='global'?'Org':`Project ${w.scopeId}`} {w.window==='month'?'this month':'lifetime'}</span><span>{usd(w.spent)} spent{w.maxUsd===null?' (no cap)':` of ${usd(w.maxUsd)}, ${usd(w.remaining??0)} left`}</span>{w.state==='hit'&&<span>Cap reached: new runs wait for an admin</span>}</div>)}</div>}
function Table({title,rows}:{title:string;rows:UsageRow[]}){return <section><h2>{title}</h2><div className='list'>{rows.map(r=><div className='row' key={r.key}><span>{r.label}</span><span>{usd(r.totals.usd)}</span><span>{tokens(r.totals)}</span>{r.totals.machineSec>0&&<span>{(r.totals.machineSec/60).toFixed(1)} machine min</span>}</div>)}</div></section>}
export function UsageView({report,windows}:{report:Report;windows:Window[]}){return <>
  <p>{report.scope==='org'?'Whole org':'Your usage'}, {report.from.slice(0,10)} to {report.to.slice(0,10)}: {usd(report.totals.usd)}, {tokens(report.totals)}</p>
  <Budgets windows={windows}/><Table title='By member' rows={report.byMember}/><Table title='By model' rows={report.byModel}/><Table title='By thread' rows={report.byThread}/><Table title='By billing item' rows={report.byItem}/></>}
function Usage(){const[report,setReport]=useState<Report|null>(null);const[windows,setWindows]=useState<Window[]>([]);
  useEffect(()=>{api('/usage').then(setReport).catch(()=>{});api('/usage/balance').then(b=>setWindows(b.windows)).catch(()=>{})},[]);
  return <main><h1>Usage</h1>{report&&<UsageView report={report} windows={windows}/>}</main>}
export default {path:'/usage',element:<Usage/>,nav:'Usage'}
