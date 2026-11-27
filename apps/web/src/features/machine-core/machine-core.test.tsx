import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import feature,{MachinePanel,type Limits} from './index.js';
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
});
