import React,{useEffect,useState} from 'react';import {api} from '../../lib/api.js';
export type WorkspaceInfo={type:'Personal'|'Team';userCount:number;billingAttached:false};
export type ActivityRow={userId:string;email:string;mergedPrs:number;contributedPrs:number;reviewFoundIssues:number;agentHours:number};
export type ActivityReport={workspace:WorkspaceInfo;capyShareOfMergedPrs:number;items:ActivityRow[];privateWorkMetadataOnly:true};
export type MemberUsageRow={userId:string;email:string;usd:number;tokens:number;cacheTokens:number;machineSec:number};
const usd=(x:number)=>`$${(x/1e6).toFixed(2)}`;
export function UsageAnalyticsView({activity,members,sort}:{activity:ActivityReport;members:MemberUsageRow[];sort:'cost'|'tokens'}){
 return <><p>Workspace: {activity.workspace.type} ({activity.workspace.userCount} users); no billing attached.</p>
 <p>Private work is shown as metadata only. Flotilla share of merged PRs: {(activity.capyShareOfMergedPrs*100).toFixed(0)}%.</p>
 <section><h2>Activity</h2><div className='list'>{activity.items.map(r=><div className='row' key={r.userId}><span>{r.email}</span><span>{r.mergedPrs} merged / {r.contributedPrs} contributed PRs</span><span>{r.reviewFoundIssues} review-found issues</span><span>{r.agentHours.toFixed(1)} agent hours</span></div>)}</div></section>
 <section><h2>By member, ranked by {sort}</h2><div className='list'>{members.map(r=><div className='row' key={r.userId}><span>{r.email}</span><span>{usd(r.usd)}</span><span>{r.tokens.toLocaleString('en-US')} tokens</span><span>{r.cacheTokens.toLocaleString('en-US')} cached tokens</span></div>)}</div></section></>}
function UsageAnalytics(){const[activity,setActivity]=useState<ActivityReport|null>(null);const[members,setMembers]=useState<MemberUsageRow[]>([]);const[sort,setSort]=useState<'cost'|'tokens'>('cost');
 useEffect(()=>{api('/usage/activity').then(setActivity).catch(()=>{})},[]);useEffect(()=>{api(`/usage/by-member?sort=${sort}`).then(x=>setMembers(x.items)).catch(()=>{})},[sort]);
 return <main><h1>Usage analytics</h1><button onClick={()=>setSort(sort==='cost'?'tokens':'cost')}>Rank by {sort==='cost'?'tokens':'cost'}</button>{activity&&<UsageAnalyticsView activity={activity} members={members} sort={sort}/>}</main>}
export default {path:'/usage-analytics',element:<UsageAnalytics/>,nav:'Analytics'}
