import {expect,test} from '@playwright/test';
test('needs-you approval actions post expected answers',async({page})=>{
 const posts:any[]=[];
 await page.route('**/api/v1/approvals**',async r=>{
  if(r.request().method()==='GET')return r.fulfill({json:[{id:'apr_1',threadId:'thr_1',kind:'budget',question:'Raise budget?',state:'open'}]});
  posts.push(await r.request().postDataJSON());return r.fulfill({json:{id:'apr_1'}});
 });
 await page.goto('/#/needs-you');await expect(page.getByText('Raise budget?')).toBeVisible();
 await page.getByRole('button',{name:'Raise'}).click();expect(posts[0]).toEqual({optionId:'raise',value:200000});
});
test('new thread posts engine and micro-USD cap',async({page})=>{
 const posts:any[]=[];
 await page.route('**/api/v1/projects',r=>r.fulfill({json:[{id:'prj_1',name:'Repo',trust:'untrusted'}]}));
 await page.route('**/api/v1/threads',async r=>{posts.push(await r.request().postDataJSON());return r.fulfill({status:201,json:{id:'thr_new'}})});
 await page.goto('/#/new');await page.getByLabel('title').fill('T');await page.getByLabel('brief').fill('Do it');await page.getByLabel('budget').fill('0.05');await page.getByRole('button',{name:'Create'}).click();
 expect(posts[0]).toMatchObject({projectId:'prj_1',title:'T',prompt:'Do it',engine:'fake',maxUsd:50000});
});
test('interrupt posts interrupt then follow-up message',async({page})=>{
 const calls:string[]=[];const posts:any[]=[];
 for(const path of ['**/api/v1/threads/thr_1','**/api/v1/threads/thr_1/messages','**/api/v1/threads/thr_1/stream'])await page.route(path,r=>r.fulfill(path.endsWith('stream')?{status:200,headers:{'content-type':'text/event-stream'},body:'\n'}:{json:path.endsWith('messages')?[]:{id:'thr_1',title:'T',spent:{usd:0},engine:{}}}));
 await page.route('**/api/v1/threads/thr_1/interrupt',r=>{calls.push('interrupt');return r.fulfill({status:202})});
 await page.route('**/api/v1/threads/thr_1/message',async r=>{calls.push('message');posts.push(await r.request().postDataJSON());return r.fulfill({status:202})});
 await page.goto('/#/threads/thr_1');await page.getByLabel('message').fill('follow up');await page.getByRole('button',{name:'Interrupt'}).click();
 await expect.poll(()=>calls).toEqual(['interrupt','message']);expect(posts[0]).toEqual({text:'follow up'});
});
test('project trust requires typed confirmation',async({page})=>{
 const patches:any[]=[];
 await page.route('**/api/v1/projects',r=>r.fulfill({json:[{id:'prj_1',name:'Repo',trust:'untrusted'}]}));
 await page.route('**/api/v1/projects/prj_1',async r=>{patches.push(await r.request().postDataJSON());return r.fulfill({json:{id:'prj_1',name:'Repo',trust:'trusted'}})});
 await page.goto('/#/projects');await expect(page.getByText(/never mounted/)).toBeVisible();await expect(page.getByRole('button',{name:'Trust'})).toBeDisabled();await page.getByLabel('confirm Repo').fill('private-and-mine');await page.getByRole('button',{name:'Trust'}).click();
 expect(patches[0]).toEqual({trust:'trusted',confirm:'private-and-mine'});
});
