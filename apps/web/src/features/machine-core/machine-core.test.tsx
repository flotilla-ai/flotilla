import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import feature,{MachinePanel,MachineUxPanel,type Limits} from './index.js';
const limits:Limits={ramMb:16384,serviceRamMb:8192,kernel:{netfilter:['no iptables/nftables rules (CAP_NET_ADMIN dropped)']},sizes:[{size:'small',memMb:2048,cpus:1,microUsdPerHour:20000,allowed:true},{size:'big-guy',memMb:16384,cpus:8,microUsdPerHour:160000,allowed:false}]};
const noop=()=>{};
describe('machine settings',()=>{
 it('CAPY-201/202/204/205/209: size picker gates by plan, shows $/h, RAM limits and kernel limits',()=>{
  const html=renderToStaticMarkup(<MachinePanel limits={limits} size='small' state={null} setSize={noop} wake={noop} keepAwake={noop}/>);
  expect(html).toContain('small · 2 GB · 1 CPU · $0.020/h');expect(html).toMatch(/<option value="big-guy" disabled="">big-guy · 16 GB · 8 CPU · \$0\.160\/h \(bigger plan\)/);
  expect(html).toContain('Concurrent RAM limit 16384 MB (8192 MB for API service users)');expect(html).toContain('No /dev/kvm, kernel modules or no iptables');
  expect(feature.path).toBe('/machine');
 });
 it('CAPY-211/212/213: sleeping machine shows Wake + deletion date; kept-awake machine shows cancel',()=>{
  const asleep=renderToStaticMarkup(<MachinePanel limits={limits} size='small' state={{state:'sleeping',size:'small',keepAwakeUntil:null,deleteAt:'2026-12-11T00:00:00.000Z'}} setSize={noop} wake={noop} keepAwake={noop}/>);
  expect(asleep).toContain('Wake machine');expect(asleep).toContain('Keep awake 4 h');expect(asleep).toContain('Deleted 2026-12-11 unless woken');
  const kept=renderToStaticMarkup(<MachinePanel limits={limits} size='small' state={{state:'awake',size:'small',keepAwakeUntil:'2026-11-27T04:00:00.000Z',deleteAt:null}} setSize={noop} wake={noop} keepAwake={noop}/>);
  expect(kept).not.toContain('Wake machine');expect(kept).toContain('Kept awake until 04:00 UTC');expect(kept).toContain('Cancel keep awake');
 });
 it('CAPY-215/478/479: + menu exposes web shell without SSH, sleeping files and background command state',()=>{
  const html=renderToStaticMarkup(<MachineUxPanel network={{mode:'private',access:'private per-thread Docker network'}} files={[{path:'repo/package.json',size:42}]} commands={[{id:'bg_1',command:'sleep 10',state:'running',exitCode:null,output:''}]} result='moved to background: bg_1' error='' onNetwork={noop} onFiles={noop} onShell={noop} onDesktop={noop}/>);
  expect(html).toContain('<summary>+</summary>');expect(html).toContain('New shell');expect(html).toContain('Open desktop');expect(html).toContain('no SSH');
  expect(html).toContain('private per-thread Docker network');expect(html).toContain('repo/package.json · 42 B');expect(html).toContain('sleep 10');expect(html).toContain('moved to background: bg_1');
 });
});
