import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {describe,expect,it} from 'vitest';
import {ModelTable,PolicyForm,RunOutCard,type Policy} from './index.js';
type El={type:unknown;props:Record<string,any>};
const find=(el:unknown,pred:(e:El)=>boolean):El[]=>{if(!el||typeof el!=='object')return[];const e=el as El;if(Array.isArray(el))return el.flatMap(x=>find(x,pred));if(typeof e.type==='function')return find((e.type as (p:unknown)=>unknown)(e.props),pred);return[...(pred(e)?[e]:[]),...find(e.props?.children,pred)]};

describe('model policy web',()=>{
  it('CAPY-333: the run-out card offers Wait and Use <next connection>, and each button answers the card',()=>{
    const card={id:'apr_1',question:'claude-code:opus ran out on its connection; wait for it to reset or use Anthropic key',options:[{id:'wait',label:'Wait'},{id:'use',label:'Use Anthropic key'}]};
    const html=renderToStaticMarkup(<RunOutCard card={card} onAnswer={()=>{}}/>);
    expect(html).toContain('class="needs"');expect(html).toContain('<button>Wait</button>');expect(html).toContain('<button>Use Anthropic key</button>');
    const answered:string[]=[];for(const b of find(<RunOutCard card={card} onAnswer={o=>answered.push(o)}/>,e=>e.type==='button'))b.props.onClick();
    expect(answered).toEqual(['wait','use']);
  });
  it('CAPY-333/335: policy form sets run-out, never-free and excluded adapters',()=>{
    const policy:Policy={runOut:'ask',neverFree:false,excludedAdapters:[],background:null};const out:Policy[]=[];
    const html=renderToStaticMarkup(<PolicyForm policy={policy} adapters={['codex']} onChange={()=>{}}/>);
    for(const l of ['Ask me','Ask before free models','Keep going','Never use free models','Exclude codex models'])expect(html).toContain(l);
    const el=<PolicyForm policy={policy} adapters={['codex']} onChange={p=>out.push(p)}/>;
    find(el,e=>e.type==='select')[0].props.onChange({target:{value:'keep-going'}});
    find(el,e=>e.props?.['aria-label']==='never-free')[0].props.onChange({target:{checked:true}});
    find(el,e=>e.props?.['aria-label']==='exclude-codex')[0].props.onChange({target:{checked:true}});
    expect(out).toEqual([{...policy,runOut:'keep-going'},{...policy,neverFree:true},{...policy,excludedAdapters:['codex']}]);
  });
  it('CAPY-336/337/484: model table shows one row per model, its context window and the connection run order',()=>{
    const html=renderToStaticMarkup(<ModelTable rows={[{id:'codex:gpt-6',adapter:'codex',displayName:'GPT-6',contextWindow:1_050_000,connections:[{id:'a',label:'Codex sub',badge:'subscription'},{id:'b',label:'Codex key',badge:'key'}]}]}/>);
    expect(html).toContain('1,050,000 tokens');expect(html).toContain('Codex sub → Codex key');
  });
});
