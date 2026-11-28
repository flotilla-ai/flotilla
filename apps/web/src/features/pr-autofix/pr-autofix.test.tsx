import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {expect,it} from 'vitest';
import feature,{PullsPanel} from './index.js';
it('CAPY-111/112/115/125: pulls page exposes settings, filters, merge menu and blocked reasons',()=>{
 const html=renderToStaticMarkup(<PullsPanel settings={{branchPrefix:'feature',draftDefault:true,openInFlotilla:false}} filter='author:alice' onFilter={()=>{}} captains={[{id:'cap1',title:'Cap',alias:null}]} captain='cap1' onCaptain={()=>{}} rows={[{repo:'acme/api',number:1,title:'Fix API',author:'alice',state:'open',labels:['bug'],draft:false,checksState:'failed',blockedReason:'checks are failing'}]}/>);
 expect(feature.path).toBe('/pulls');expect(html).toContain('feature');expect(html).toContain('draft');expect(html).toContain('Open in Flotilla button off');expect(html).toContain('author:alice');expect(html).toContain('captain filter');expect(html).toContain('All Captains');
 for(const x of ['squash','merge commit','rebase','comment','Update branch','Enable auto-merge','Review','Chat with Flotilla','New thread with PR']) expect(html).toContain(x);
 expect(html).toContain('Blocked: checks are failing');expect(html).toContain('acme/api#1 Fix API');
});
