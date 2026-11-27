import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import feature,{PreviewPorts} from './index.js';
describe('previews in-app browser',()=>{
 it('CAPY-221: suggests listening ports, lists reserved ports and shows the open preview in-app',()=>{
  const html=renderToStaticMarkup(<PreviewPorts data={{previews:[{port:5173,url:'http://flo.test:8081/p/FLO-9/5173/',localUrl:'http://flt-FLO-9:5173',access:'private'}],suggestions:[3000],reserved:[3128,3129,8080,8081,8082]}} open='http://flo.test:8081/p/FLO-9/5173/?token=one' expose={()=>{}} view={()=>{}}/>);
  expect(html).toContain('Open 3000');expect(html).not.toContain('Open 8080');
  expect(html).toContain('Reserved, never previewed: 3128, 3129, 8080, 8081, 8082');
  expect(html).toMatch(/<iframe title="preview" src="http:\/\/flo\.test:8081\/p\/FLO-9\/5173\/\?token=one"/);
  expect(feature.path).toBe('/previews');
 });
});
