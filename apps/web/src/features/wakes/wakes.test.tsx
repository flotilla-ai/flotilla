import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import feature,{WatchList} from './index.js';
describe('wakes activity',()=>{
 it('CAPY-044/045: names the awaited event with a click-through and offers Stop watching',()=>{
  const html=renderToStaticMarkup(<WatchList watches={[{id:'wch_1',threadId:'thr_1',threadTitle:'Fix login',kind:'pr',label:'Waiting on api#212 checks',url:'https://github.com/acme/api/pull/212/checks'}]} stop={()=>{}}/>);
  expect(html).toContain('<a href="https://github.com/acme/api/pull/212/checks">Waiting on api#212 checks</a>');
  expect(html).toContain('<a href="#/threads/thr_1">Fix login</a>');expect(html).toContain('Stop watching');
  expect(renderToStaticMarkup(<WatchList watches={[]} stop={()=>{}}/>)).toContain('Nothing is being watched.');
  expect(feature.path).toBe('/watches');
 });
});
