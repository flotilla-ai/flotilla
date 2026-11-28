import {expect,test,type Page} from '@playwright/test';
type Call={method:string;path:string;body:any};
const item=(id:string,text:string,state='pending')=>({id,text,state,mode:'queue'});
async function mock(page:Page,extra:Record<string,(c:Call)=>any>){
 const calls:Call[]=[];
 await page.route('**/api/v1/**',async r=>{const u=new URL(r.request().url());const path=u.pathname.replace('/api/v1','')+u.search;const method=r.request().method();let body:any=null;try{body=r.request().postDataJSON()}catch{body=r.request().postData()}
  const c={method,path,body};calls.push(c);const key=`${method} ${path.split('?')[0]}`;
  if(path.endsWith('/stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:'\n'});
  const fixed:Record<string,any>={'GET /threads/thr_1':{id:'thr_1',title:'T',spent:{usd:0},engine:{contextWindow:200000}},'GET /threads/thr_1/messages':[],'GET /threads/thr_1/requests':{items:[]},'GET /threads/thr_1/reading-place':{threadId:'thr_1',seq:null,offset:0},'GET /threads/thr_1/inbox':{items:[],queuedCount:0,folded:false}};
  const out=extra[key]?extra[key](c):fixed[key];
  if(out&&typeof out.status==='number'&&out.fail)return r.fulfill({status:out.status,json:{error:'conflict'}});
  return out!==undefined?r.fulfill({json:out}):r.fulfill({status:202});
 });
 return calls;
}
const sent=(calls:Call[],m:string,p:string)=>calls.filter(c=>c.method===m&&c.path===p).map(c=>c.body);

test('CAPY-009 + CAPY-468: queued messages fold behind a count and can be edited, sent now, discarded or returned; a 409 removes the controls',async({page})=>{
 let items=[item('inb_a','first queued'),item('inb_b','second queued'),item('inb_c','third queued')];
 const view=()=>({items,queuedCount:items.length,folded:items.length>=2});
 const calls=await mock(page,{'GET /threads/thr_1/inbox':view,
  'PATCH /threads/thr_1/inbox/inb_a':c=>{items=items.map(i=>i.id==='inb_a'?{...i,text:c.body.text}:i);return {item:items[0]}},
  'DELETE /threads/thr_1/inbox/inb_b':()=>{items=items.filter(i=>i.id!=='inb_b');return {item:{}}},
  'DELETE /threads/thr_1/inbox/inb_c':()=>{items=items.filter(i=>i.id!=='inb_c');return {item:{}}},
  'POST /threads/thr_1/inbox/inb_a/send':()=>{items=[];return {status:409,fail:true}}});
 await page.goto('/#/threads/thr_1');
 const queue=page.getByLabel('queue');await expect(queue.getByText('3 queued')).toBeVisible();await expect(queue.getByText('first queued')).toBeHidden();
 await queue.getByText('3 queued').click();await page.screenshot({path:'test-results/unblock-02-queue.png'});
 const row=(t:string)=>queue.getByRole('article').filter({hasText:t});
 for(const b of ['Edit','Send now','Discard','Return to composer'])await expect(row('first queued').getByRole('button',{name:b})).toBeVisible();
 await row('first queued').getByRole('button',{name:'Edit'}).click();await page.getByLabel('edit queued message').fill('first edited');await queue.getByRole('button',{name:'Save'}).click();
 await expect(row('first edited')).toBeVisible();expect(sent(calls,'PATCH','/threads/thr_1/inbox/inb_a')).toEqual([{text:'first edited'}]);
 await row('second queued').getByRole('button',{name:'Discard'}).click();await expect(queue.getByText('2 queued')).toBeVisible();expect(sent(calls,'DELETE','/threads/thr_1/inbox/inb_b')).toHaveLength(1);
 await row('third queued').getByRole('button',{name:'Return to composer'}).click();await expect(page.getByLabel('message')).toHaveValue('third queued');
 await expect(queue.getByText('queued',{exact:false}).first()).toBeVisible();await expect(queue.locator('summary')).toHaveCount(0);
 await row('first edited').getByRole('button',{name:'Send now'}).click();
 await expect(queue.getByRole('status')).toHaveText('The agent already read this message.');await expect(queue.getByRole('button',{name:'Edit'})).toHaveCount(0);await expect(queue.getByRole('article')).toHaveCount(0);
});

test('CAPY-010: a sent message can be edited into a new version with a 1/2 switcher',async({page})=>{
 let events:any[]=[{seq:1,kind:'user.message',payload:{text:'make it blue',inboxId:'inb_1'}},{seq:2,kind:'agent.message',payload:{text:'done'}}];
 const calls=await mock(page,{'GET /threads/thr_1/messages':()=>events,'POST /threads/thr_1/inbox/inb_1/versions':c=>{events=[...events,{seq:3,kind:'user.message',payload:{text:c.body.text,inboxId:'inb_2',rootId:'inb_1',version:2}}];return {item:{id:'inb_2'}}}});
 await page.goto('/#/threads/thr_1');
 const msg=page.getByRole('article').filter({hasText:'make it'});await expect(msg.getByLabel('version',{exact:true})).toHaveCount(0);
 await msg.getByRole('button',{name:'Edit'}).click();await page.getByLabel('edit sent message').fill('make it green');await page.getByRole('button',{name:'Save as new version'}).click();
 await expect.poll(()=>sent(calls,'POST','/threads/thr_1/inbox/inb_1/versions')).toEqual([{text:'make it green'}]);
 await page.reload();const v=page.getByRole('article').filter({has:page.getByLabel('version',{exact:true})});
 await expect(v.getByLabel('version',{exact:true})).toHaveText('2/2');await expect(v.getByText('make it green')).toBeVisible();await expect(page.getByText('make it blue')).toHaveCount(0);
 await v.getByRole('button',{name:'previous version'}).click();await expect(v.getByLabel('version',{exact:true})).toHaveText('1/2');await expect(v.getByText('make it blue')).toBeVisible();
 await page.screenshot({path:'test-results/unblock-02-versions.png'});
});

test('CAPY-026: the composer shows a context meter and Compact at, disabled when the adapter lacks compaction',async({page})=>{
 let ctx={usedTokens:12000,compactAt:0.8,compactSupported:true};
 const calls=await mock(page,{'GET /threads/thr_1/context':()=>ctx,'PATCH /threads/thr_1/context':c=>(ctx={...ctx,compactAt:c.body.compactAt})});
 await page.goto('/#/threads/thr_1');
 await expect(page.getByLabel('context',{exact:true})).toContainText('Context 12,000 / 200,000 tokens');await expect(page.getByLabel('context used')).toHaveAttribute('value','0.06');
 const input=page.getByLabel('compact at');await expect(input).toHaveValue('80');await expect(input).toBeEnabled();await input.fill('65');await input.blur();
 await expect.poll(()=>sent(calls,'PATCH','/threads/thr_1/context')).toEqual([{compactAt:0.65}]);await page.screenshot({path:'test-results/unblock-02-context.png'});
 ctx={usedTokens:5,compactAt:0.8,compactSupported:false};await page.reload();await expect(page.getByLabel('compact at')).toBeDisabled();
});

test('CAPY-467: a message sent while its file is still uploading waits for the upload and survives a reload',async({page})=>{
 let items:any[]=[];let uploaded=false;let release=()=>{};const gate=new Promise<void>(r=>{release=r});
 const calls=await mock(page,{'POST /files':()=>({fileId:'fil_1',uploadUrl:'http://127.0.0.1:8080/api/v1/uploads/fil_1?token=t',method:'PUT',headers:{'content-type':'text/plain'}}),
  'POST /threads/thr_1/inbox':c=>{items=[item('inb_u',c.body.text,'waiting_upload')];return {id:'inb_u'}},
  'GET /threads/thr_1/inbox':()=>{if(uploaded)items=[];return {items,queuedCount:items.length,folded:false}}});
 await page.route('**/api/v1/uploads/**',async r=>{await gate;uploaded=true;await r.fulfill({status:200,body:''})});
 await page.goto('/#/threads/thr_1');
 await page.getByLabel('attach').setInputFiles({name:'big.txt',mimeType:'text/plain',buffer:Buffer.from('bytes')});await expect(page.getByText('big.txt')).toBeVisible();
 await page.getByLabel('message').fill('use this file');await page.getByRole('button',{name:'Queue'}).click();
 await expect.poll(()=>sent(calls,'POST','/threads/thr_1/inbox')).toEqual([{text:'use this file',mode:'queue',attachments:['fil_1']}]);expect(uploaded).toBe(false);
 const queue=page.getByLabel('queue');await expect(queue.getByText('waiting for upload')).toBeVisible();
 await page.reload();await expect(queue.getByText('use this file')).toBeVisible();await expect(queue.getByText('waiting for upload')).toBeVisible();await page.screenshot({path:'test-results/unblock-02-upload.png'});
 uploaded=true;release();await page.reload();await expect(queue.getByText('waiting for upload')).toHaveCount(0);
});
