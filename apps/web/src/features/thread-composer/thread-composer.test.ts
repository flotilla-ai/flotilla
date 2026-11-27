import {describe,expect,it} from 'vitest';
import {deepLinkPrompt,fold,keyAction,loadKeymap,mentionQuery,quote,saveKeymap,sections} from './thread-composer.js';
const mem=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>void m.set(k,v)}};
describe('thread composer helpers',()=>{
 it('CAPY-007: send key is remappable per browser and the other Enter inserts a newline',()=>{
  const s=mem();expect(loadKeymap(s)).toEqual({send:'enter'});
  expect(keyAction({send:'enter'},{key:'Enter'})).toBe('send');expect(keyAction({send:'enter'},{key:'Enter',shiftKey:true})).toBe('newline');
  saveKeymap(s,{send:'mod+enter'});expect(loadKeymap(s)).toEqual({send:'mod+enter'});
  expect(keyAction({send:'mod+enter'},{key:'Enter'})).toBe('newline');expect(keyAction({send:'mod+enter'},{key:'Enter',metaKey:true})).toBe('send');expect(keyAction({send:'mod+enter'},{key:'Enter',ctrlKey:true})).toBe('send');
  expect(keyAction({send:'enter'},{key:'a'})).toBeNull();s.setItem('flotilla.composer.keymap','junk');expect(loadKeymap(s)).toEqual({send:'enter'});
 });
 it('CAPY-027: replies split into sections, Reply quotes one, and work between messages folds into one line',()=>{
  expect(sections(5,'Intro line\n## Plan\nDo a\nDo b\n## Risks\nNone')).toEqual([{seq:5,index:0,heading:null,text:'Intro line'},{seq:5,index:1,heading:'Plan',text:'Do a\nDo b'},{seq:5,index:2,heading:'Risks',text:'None'}]);
  expect(sections(1,'just text')).toEqual([{seq:1,index:0,heading:null,text:'just text'}]);
  expect(quote({seq:5,index:1,heading:'Plan',text:'Do a\nDo b'})).toBe('> **Plan**\n> Do a\n> Do b\n\n');
  const ev=(seq:number,kind:string,payload:any={})=>({seq,kind,payload});
  expect(fold([ev(1,'user.message',{text:'go'}),ev(2,'run.started'),ev(3,'agent.tool_call',{name:'bash'}),ev(4,'agent.tool_result'),ev(5,'agent.tool_call',{name:'edit'}),ev(6,'agent.message',{text:'done'}),ev(7,'run.ended')]).map(x=>x.kind==='work'?`work:${x.label}`:x.event.kind))
   .toEqual(['user.message','work:Worked · 2 tool calls','agent.message','work:Worked · 0 tool calls']);
 });
 it('CAPY-016: @-mention query is the token under the caret',()=>{
  expect(mentionQuery('see @FLO-1',10)).toBe('FLO-1');expect(mentionQuery('see @FLO-1 now',4)).toBeNull();expect(mentionQuery('mail a@b',8)).toBeNull();
 });
 it('CAPY-471: ?prompt= deep link pre-fills the composer',()=>{
  expect(deepLinkPrompt('#/compose?prompt=Fix%20the%20login%0Anow','')).toBe('Fix the login\nnow');expect(deepLinkPrompt('#/compose','?prompt=hi')).toBe('hi');expect(deepLinkPrompt('#/compose','')).toBe('');
 });
 it('CAPY-027: streamed agent.delta chunks merge into one sectioned reply',()=>{
  const f=fold([{seq:1,kind:'agent.delta',payload:{text:'# A\none'}},{seq:2,kind:'agent.delta',payload:{text:'\n# B\ntwo'}},{seq:3,kind:'run.ended',payload:{}},{seq:4,kind:'agent.delta',payload:{text:'x'}}]);
  expect(f.map(x=>x.kind)).toEqual(['event','work','event']);
  const e=f[0].kind==='event'?f[0].event:null;expect(sections(e!.seq,e!.payload.text).map(s=>s.heading)).toEqual(['A','B']);
 });
 it('CAPY-027: # comments inside fenced code are not section headings',()=>{
  const s=sections(1,'# Fix\n```sh\n# install\npnpm i\n```\n# Done\nok');
  expect(s.map(x=>x.heading)).toEqual(['Fix','Done']);expect(s[0].text).toBe('```sh\n# install\npnpm i\n```');
 });
 it('CAPY-027: only a matching closing fence ends a code block',()=>{
  const s=sections(1,'# A\n````md\n```\n# inner\n```\n````\n# B\n```js``` inline\n# C\nend');
  expect(s.map(x=>x.heading)).toEqual(['A','B','C']);
 });
 it('CAPY-027: fences nested in list items and CRLF replies still delimit code',()=>{
  expect(sections(1,'# A\n- step\n    ```sh\n    # c\n    ```\n# B\nok').map(x=>x.heading)).toEqual(['A','B']);
  expect(sections(1,'# A\r\n```sh\r\n# c\r\n```\r\n# B\r\nok').map(x=>x.heading)).toEqual(['A','B']);
 });
});
