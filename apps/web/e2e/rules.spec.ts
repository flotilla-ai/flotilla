import {expect,test} from '@playwright/test';
const ctx={runId:'run_1',createdAt:'2026-01-01T00:00:00Z',budget:{maxTokens:8000,usedTokens:150},ignored:[{path:'.cursorrules',reason:'deprecated'}],layers:[{kind:'kernel',source:'flotilla-kernel',tokens:120,fullTokens:120,truncated:false},{kind:'repo-root',source:'AGENTS.md',tokens:30,fullTokens:900,truncated:true}]};
test('CAPY-292 context breakdown per layer; CAPY-294 Memory/Captain experiments; CAPY-284 personal instructions; CAPY-289 guidance',async({page})=>{
 const puts:any[]=[];let exp={org:{memory:null,captain:null},user:{memory:null,captain:null},effective:{memory:false,captain:false}};
 await page.route('**/api/v1/rules/instructions',r=>r.fulfill({json:{org:{text:'org text',updatedAt:null},user:{text:'',updatedAt:null}}}));
 await page.route('**/api/v1/rules/instructions/me',r=>{puts.push(r.request().postDataJSON());return r.fulfill({json:{text:'be terse',updatedAt:null}})});
 await page.route('**/api/v1/rules/guidance',r=>r.fulfill({json:{whereToPut:[{layer:'user',put:'Personal style'}],antiPatterns:['Secrets in rules'],migration:[{from:'Cursor',steps:'move .cursorrules'}]}}));
 await page.route('**/api/v1/experiments',r=>{if(r.request().method()==='PUT'){const b=r.request().postDataJSON();exp={...exp,user:{...exp.user,memory:b.memory}, effective:{...exp.effective,memory:b.memory}}}return r.fulfill({json:exp})});
 await page.route('**/api/v1/memory',r=>r.fulfill({json:{items:[]}}));
 await page.route('**/api/v1/threads/thr_1/context',r=>r.fulfill({json:ctx}));
 await page.goto('/#/rules');
 await page.getByLabel('personal instructions').fill('be terse');await page.getByRole('button',{name:'Save personal'}).click();expect(puts).toEqual([{text:'be terse'}]);
 await expect(page.getByText('Personal style')).toBeVisible();await expect(page.getByText('Secrets in rules')).toBeVisible();
 const memory=page.getByLabel('Memory for me');await expect(memory).not.toBeChecked();await memory.click();await expect(memory).toBeChecked();await expect(page.getByLabel('Captain for me')).toBeVisible();
 await page.getByLabel('thread id').fill('thr_1');
 const table=page.getByRole('table',{name:'context breakdown'});
 await expect(table.getByRole('row')).toHaveCount(3);await expect(table.getByText('flotilla-kernel')).toBeVisible();await expect(table.getByText('30 of 900 (truncated)')).toBeVisible();
 await expect(page.getByText('150 of 8000 tokens')).toBeVisible();await expect(page.getByText('.cursorrules deprecated')).toBeVisible();
});
