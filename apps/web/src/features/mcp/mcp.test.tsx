import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import feature,{ReviewCard,ServerRow,type Server} from './index.js';
const noop=()=>{};
const base:Server={id:'mcp_1',key:'linear',name:'linear',transport:'http',url:'https://mcp.linear.app/mcp',command:null,status:'untested',toolPrefix:'mcp__linear__',lastTest:null,auth:{kind:'none'}};
describe('mcp settings',()=>{
 it('CAPY-310: status, Test button, failing step and the 403 checklist',()=>{
  const html=renderToStaticMarkup(<ServerRow server={{...base,status:'failing',lastTest:{ok:false,failingStep:'initialize',httpStatus:403,checklist:['Reconnect or rotate the key, then press Test again'],tools:[],steps:[{name:'initialize',ok:false,detail:'HTTP 403: key [REDACTED:header:X-Api-Key]'}]}}} test={noop} connect={noop} cancel={noop}/>);
  expect(html).toContain('failing');expect(html).toContain('>Test</button>');expect(html).toContain('Failed at initialize: HTTP 403: key [REDACTED:header:X-Api-Key]');expect(html).toContain('aria-label="403 checklist"');
  expect(renderToStaticMarkup(<ServerRow server={{...base,status:'ok',lastTest:{ok:true,failingStep:null,httpStatus:200,checklist:[],tools:['search'],steps:[]}}} test={noop} connect={noop} cancel={noop}/>)).toContain('mcp__linear__search');
 });
 it('CAPY-520: a pending sign-in shows Finish in your browser with Cancel',()=>{
  const html=renderToStaticMarkup(<ServerRow server={{...base,status:'pending-browser',auth:{kind:'oauth',connection:'pending',flowId:'mfl_1'}}} test={noop} connect={noop} cancel={noop}/>);
  expect(html).toContain('Finish in your browser');expect(html).toContain('>Cancel</button>');
  expect(renderToStaticMarkup(<ServerRow server={{...base,status:'needs-auth',auth:{kind:'oauth',connection:'none',flowId:null}}} test={noop} connect={noop} cancel={noop}/>)).toContain('>Connect</button>');
 });
 it('CAPY-308/519: the Review card approves or declines in one click',()=>{
  const html=renderToStaticMarkup(<ReviewCard card={{id:'apr_1',kind:'mcp',question:'Rename MCP server a to b?',state:'open'}} answer={noop}/>);
  expect(html).toContain('Rename MCP server a to b?');expect(html).toContain('>Approve</button>');expect(html).toContain('>Decline</button>');expect(feature.path).toBe('/mcp');
 });
});
