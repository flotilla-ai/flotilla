import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {expect,it} from 'vitest';import feature,{PluginRow} from './index.js';
it('plugin lifecycle web slice renders sync approval state and secret names only',()=>{
 const p={id:'mpl',key:'github-tools',name:'GitHub',scope:'user' as const,version:'1.0.0',updateState:'needs-you',connectionMode:'each-member',privateThreadsOnly:true,keyNames:['API_KEY'],serverKeys:['github']};
 const html=renderToStaticMarkup(<PluginRow plugin={p} sync={()=>{}} approve={()=>{}} rollback={()=>{}}/>);
 expect(html).toContain('needs-you');expect(html).toContain('Approve update');expect(html).toContain('private threads only');expect(html).toContain('API_KEY');expect(html).not.toContain('secret-value');expect(feature.path).toBe('/mcp-plugins');expect(feature.nav).toBe('Plugins');
});
