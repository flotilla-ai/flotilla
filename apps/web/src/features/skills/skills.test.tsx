import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import feature,{SkillList} from './index.js';
const md=(n:string)=>({'SKILL.md':`---\nname: ${n}\ndescription: d\n---\n`});
describe('skills page',()=>{
 it('CAPY-300: shows Loaded, Not loaded (with reason) and Replaced by markers with a turn on/off control',()=>{
  const html=renderToStaticMarkup(<SkillList items={[
   {id:'a',name:'deploy',description:'Deploy the app.',source:{kind:'repo'},origin:'repo',files:md('deploy'),load:{state:'loaded'}},
   {id:'b',name:'deploy',description:'Drive deploy.',source:{kind:'drive'},origin:'',files:md('deploy'),load:{state:'replaced',by:'repo'}},
   {id:'c',name:'broken',description:'',source:{kind:'repo'},origin:'repo',files:{},load:{state:'not-loaded',reason:'SKILL.md has no frontmatter'}},
   {id:'d',name:'gh-stack',description:'Stack PRs.',source:{kind:'builtin'},origin:'flotilla',files:md('gh-stack'),load:{state:'not-loaded',reason:'turned off'}}
  ]} toggle={()=>{}}/>);
  expect(html).toContain('Loaded');expect(html).toContain('Replaced by repo');
  expect(html).toContain('Not loaded: SKILL.md has no frontmatter');expect(html).toContain('Not loaded: turned off');
  expect(html).toContain('Turn off');expect(html).toContain('Turn on');
  expect(feature.path).toBe('/skills');expect(feature.nav).toBe('Skills');
 });
});
