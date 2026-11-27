import React from 'react';
export type NotificationPrefs={requests:boolean;failures:boolean;sounds:boolean;systemAlerts:boolean;devicePush:boolean;slackDm:boolean};
export const defaultPrefs:NotificationPrefs={requests:true,failures:true,sounds:false,systemAlerts:true,devicePush:false,slackDm:false};
export function badgeTitle(base:string,unread:number):string{return unread>0?`(${unread}) ${base}`:base}
export function Notifications(){return <main><h1>Notifications</h1><p>Notification settings for requests, failures, sounds, system alerts and per-device push.</p>{Object.keys(defaultPrefs).map(k=><label key={k}><input type='checkbox'/> {k}</label>)}<p>Unread notifications are shown in the app title and badge.</p><p>Slack DM delivery requires a connected Slack workspace.</p></main>}
export default {path:'/settings/notifications',element:<Notifications/>};
