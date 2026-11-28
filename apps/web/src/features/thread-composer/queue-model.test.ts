import {describe,expect,it} from 'vitest';
import {alreadyRead,compactBody,meterView,queueFold,stateLabel,switcherLabel,versionGroups,type InboxItem} from './queue-model.js';
const item=(id:string,state:InboxItem['state']='pending'):InboxItem=>({id,text:id,state,mode:'queue'});
describe('composer queue helpers',()=>{
 it('CAPY-468: two or more queued messages fold behind a count; one does not',()=>{
  expect(queueFold({items:[item('a')],queuedCount:1,folded:false})).toEqual({folded:false,label:'1 queued'});
  expect(queueFold({items:[item('a'),item('b'),item('c')],queuedCount:3,folded:true})).toEqual({folded:true,label:'3 queued'});
 });
 it('CAPY-467: a message whose file is still uploading is labelled waiting for upload',()=>{
  expect(stateLabel(item('a','waiting_upload'))).toBe('waiting for upload');expect(stateLabel(item('a'))).toBe('queued');
 });
 it('CAPY-009: only a 409 counts as already read by the agent',()=>{
  expect(alreadyRead(new Error('409'))).toBe(true);expect(alreadyRead(new Error('500'))).toBe(false);expect(alreadyRead('409')).toBe(false);
 });
 it('CAPY-010: versions of a sent message share one slot with an n/total switcher',()=>{
  const ev=(seq:number,payload:any,kind='user.message')=>({seq,kind,payload});
  const g=versionGroups([ev(1,{text:'plain'}),ev(2,{text:'v1',inboxId:'inb_1'}),ev(3,{text:'reply'},'agent.message'),ev(4,{text:'v2',inboxId:'inb_2',rootId:'inb_1',version:2}),ev(5,{text:'other',inboxId:'inb_3'})]);
  expect([...g.hidden]).toEqual([2]);expect(g.shown.get(4)!.map(v=>v.text)).toEqual(['v1','v2']);expect(g.shown.get(5)!.map(v=>v.inboxId)).toEqual(['inb_3']);expect(g.shown.has(1)).toBe(false);
  expect(switcherLabel(0,2)).toBe('1/2');expect(switcherLabel(1,2)).toBe('2/2');
 });
 it('CAPY-026: context meter shows used over limit and Compact at is editable only with compaction',()=>{
  expect(meterView({usedTokens:12000,compactAt:0.8,compactSupported:true},200000)).toEqual({label:'12,000 / 200,000 tokens',ratio:0.06,compactPercent:80,editable:true});
  expect(meterView({usedTokens:5,compactAt:0.5,compactSupported:false})).toEqual({label:'5 tokens',ratio:null,compactPercent:50,editable:false});
  expect(compactBody(65)).toEqual({compactAt:0.65});expect(compactBody(0)).toEqual({compactAt:0.01});expect(compactBody(250)).toEqual({compactAt:1});
 });
});
