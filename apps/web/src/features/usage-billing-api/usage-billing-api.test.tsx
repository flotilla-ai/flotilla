import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import feature,{UsageView,type Report,type Totals} from './index.js';
const t=(usd:number,machineSec=0):Totals=>({usd,inputTokens:1000,outputTokens:500,cacheTokens:0,machineSec});
const report:Report={window:'month',from:'2026-11-01T00:00:00.000Z',to:'2026-12-01T00:00:00.000Z',scope:'org',totals:t(520_000,1200),
  byMember:[{key:'usr_a',label:'admin@x',totals:t(320_000)}],byModel:[{key:'claude-opus',label:'claude-opus',totals:t(300_000)}],
  byThread:[{key:'thr_1',label:'Fix login',totals:t(200_000)}],byItem:[{key:'machine',label:'machine',totals:t(20_000,1200)},{key:'key',label:'key',totals:t(500_000)}]};
describe('usage web',()=>{
  it('CAPY-352: usage page shows the window, spend and tokens by member, model, thread and billing item, plus budget windows',()=>{
    const html=renderToStaticMarkup(<UsageView report={report} windows={[{scope:'global',scopeId:'global',window:'month',maxUsd:500_000,spent:520_000,reserved:0,remaining:0,state:'hit'}]}/>);
    for(const s of ['Whole org, 2026-11-01 to 2026-12-01: $0.52, 1,500 tokens','By member','admin@x','By model','claude-opus','By thread','Fix login','By billing item','20.0 machine min','Org this month','$0.52 spent of $0.50, $0.00 left','Cap reached'])expect(html).toContain(s);
    expect(html).toContain('class="row needs"');
    expect(feature).toMatchObject({path:'/usage',nav:'Usage'});
  });
});
