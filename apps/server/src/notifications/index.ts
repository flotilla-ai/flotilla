import crypto from 'node:crypto';
import type pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';

type Row = Record<string, any>;
export interface NotificationSettings { requests: boolean; failures: boolean; sounds: boolean; systemAlerts: boolean; devicePush: boolean; slackDm: boolean }
export interface PushSubscription { endpoint: string; keys?: Record<string,string> }
export interface AppNotification { id: string; userId: string; kind: 'mention'|'failure'|'request'|'pr-followup'; body: string; read: boolean; createdAt: string }
export interface FollowupDraft { kind:'pr-followup'; sentence:string }

const defaults: NotificationSettings = { requests:true, failures:true, sounds:false, systemAlerts:true, devicePush:false, slackDm:false };
const bool=(v:unknown)=>typeof v==='boolean'?v:undefined;
export function normalizeSettings(input: Record<string,unknown>): NotificationSettings {
  return { requests:bool(input.requests)??defaults.requests, failures:bool(input.failures)??defaults.failures, sounds:bool(input.sounds)??defaults.sounds, systemAlerts:bool(input.systemAlerts)??defaults.systemAlerts, devicePush:bool(input.devicePush)??defaults.devicePush, slackDm:bool(input.slackDm)??defaults.slackDm };
}
export function mentionsIn(body:string): string[] { return [...new Set([...body.matchAll(/@([A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+)?)/g)].map((m)=>m[1].toLowerCase()))] }
export function prFollowupSentence(input:{merged?:boolean;closed?:boolean;number:number;repo:string}): string {
  if (input.merged) return `${input.repo}#${input.number} merged. Flotilla will watch the resulting checks and stop following the closed PR.`;
  if (input.closed) return `${input.repo}#${input.number} was closed without merging. Flotilla will stop following it unless you reopen the work.`;
  throw new ApiFailure('ValidationFailed','PR follow-up requires merged or closed state');
}
export class NotificationCenter {
  constructor(readonly pool:pg.Pool) {}
  private async q(sql:string,args:unknown[]=[]) { return (await this.pool.query(sql,args)).rows as Row[] }
  async settings(userId:string):Promise<NotificationSettings> {
    const [r]=await this.q('SELECT * FROM notification_settings WHERE user_id=$1',[userId]);
    return r?{requests:r.requests,failures:r.failures,sounds:r.sounds,systemAlerts:r.system_alerts,devicePush:r.device_push,slackDm:r.slack_dm}:defaults;
  }
  async saveSettings(userId:string,input:Record<string,unknown>):Promise<NotificationSettings> {
    const n=normalizeSettings(input);
    await this.q(`INSERT INTO notification_settings(user_id,requests,failures,sounds,system_alerts,device_push,slack_dm) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(user_id) DO UPDATE SET requests=$2,failures=$3,sounds=$4,system_alerts=$5,device_push=$6,slack_dm=$7,updated_at=now()`,[userId,n.requests,n.failures,n.sounds,n.systemAlerts,n.devicePush,n.slackDm]);
    return n;
  }
  async subscribe(userId:string,input:PushSubscription):Promise<{id:string}> {
    if (!input.endpoint?.startsWith('https://')) throw new ApiFailure('ValidationFailed','push endpoint must be HTTPS');
    const existing=(await this.q('SELECT id,user_id FROM push_subscriptions WHERE endpoint=$1',[input.endpoint]))[0];
    if(existing&&existing.user_id!==userId)throw new ApiFailure('Conflict','push endpoint is already registered');
    if(existing){await this.q('UPDATE push_subscriptions SET keys=$2 WHERE id=$1',[existing.id,JSON.stringify(input.keys??{})]);return{id:existing.id}}
    const id=`ps_${crypto.randomBytes(8).toString('hex')}`;
    try{await this.q('INSERT INTO push_subscriptions(id,user_id,endpoint,keys) VALUES($1,$2,$3,$4)',[id,userId,input.endpoint,JSON.stringify(input.keys??{})])}catch(err){if((err as {code?:string}).code==='23505')throw new ApiFailure('Conflict','push endpoint is already registered');throw err}
    return { id };
  }
  private async insert(userId:string,kind:AppNotification['kind'],body:string,payload:Record<string,unknown>={}):Promise<AppNotification> {
    const settings=await this.settings(userId);
    if ((kind==='failure'&&!settings.failures)||(kind==='request'&&!settings.requests)) throw new ApiFailure('ValidationFailed',`${kind} notifications are disabled`);
    const id=`ntf_${crypto.randomBytes(8).toString('hex')}`;
    await this.q('INSERT INTO notifications(id,user_id,kind,body,payload) VALUES($1,$2,$3,$4,$5)',[id,userId,kind,body,JSON.stringify(payload)]);
    return { id,userId,kind,body,read:false,createdAt:new Date().toISOString() };
  }
  async notifyFailure(userId:string,body:string,payload:Record<string,unknown>={}) { return this.insert(userId,'failure',body,payload) }
  async notifyRequest(userId:string,body:string,payload:Record<string,unknown>={}) { return this.insert(userId,'request',body,payload) }
  async notifyMentions(actorUserId:string,body:string,threadId?:string):Promise<AppNotification[]> {
    const names=mentionsIn(body); if(!names.length) return [];
    const clauses=names.map((_,i)=>`lower(email)=$${i+1} OR lower(split_part(email,'@',1))=$${i+1}`).join(' OR ');
    const users=await this.q(`SELECT id FROM users WHERE id<>$${names.length+1} AND (${clauses})`,[...names,actorUserId]);
    const out:AppNotification[]=[];
    for(const u of users) out.push(await this.insert(u.id,'mention',body,{actorUserId,threadId}));
    return out;
  }
  async list(userId:string,unread=false):Promise<AppNotification[]> {
    const rows=await this.q(`SELECT * FROM notifications WHERE user_id=$1 ${unread?'AND read_at IS NULL':''} ORDER BY created_at DESC LIMIT 100`,[userId]);
    return rows.map((r)=>({id:r.id,userId:r.user_id,kind:r.kind,body:r.body,read:!!r.read_at,createdAt:new Date(r.created_at).toISOString()}));
  }
  async unreadCount(userId:string):Promise<number> { return Number((await this.q('SELECT count(*)::int n FROM notifications WHERE user_id=$1 AND read_at IS NULL',[userId]))[0]?.n??0) }
  async markRead(userId:string,id:string):Promise<void> { await this.q('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND id=$2',[userId,id]) }
}
