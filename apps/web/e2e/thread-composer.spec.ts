import {expect,test,type Page} from '@playwright/test';
type Call={method:string;path:string;body:any};
const long='x '.repeat(400);
const events=[{seq:1,kind:'user.message',payload:{text:'first ask'}},{seq:2,kind:'run.started',payload:{}},{seq:3,kind:'agent.tool_call',payload:{name:'bash'}},{seq:4,kind:'agent.tool_result',payload:{}},
 {seq:5,kind:'agent.message',payload:{text:`Intro\n## Plan\nDo a\n## Risks\n${long}`}},{seq:6,kind:'run.ended',payload:{state:'completed'}},{seq:7,kind:'user.message',payload:{text:'second ask'}},{seq:8,kind:'agent.message',payload:{text:long}}];
async function mock(page:Page,extra:Record<string,(c:Call)=>any>={}){
 const calls:Call[]=[];
 await page.route('**/api/v1/**',async r=>{const u=new URL(r.request().url());const path=u.pathname.replace('/api/v1','')+u.search;const method=r.request().method();let body:any=null;try{body=r.request().postDataJSON()}catch{body=r.request().postData()}
  const c={method,path,body};calls.push(c);const key=`${method} ${path.split('?')[0]}`;
  if(extra[key])return r.fulfill({json:extra[key](c)});
  if(path.endsWith('/stream'))return r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:'\n'});
  const fixed:Record<string,any>={'GET /threads/thr_1':{id:'thr_1',title:'T',spent:{usd:0},engine:{}},'GET /threads/thr_1/messages':events,'GET /threads/thr_1/requests':{items:[]},'GET /threads/thr_1/reading-place':{threadId:'thr_1',seq:null,offset:0},'GET /projects':[],
   'POST /files':{fileId:'fil_1',uploadUrl:'http://127.0.0.1:8080/api/v1/uploads/fil_1?token=t',method:'PUT',headers:{'content-type':'text/plain'}}};
  return fixed[key]!==undefined?r.fulfill({json:fixed[key]}):r.fulfill({status:202});
 });
 return calls;
}
const posts=(calls:Call[],m:string,p:string)=>calls.filter(c=>c.method===m&&c.path===p).map(c=>c.body);

test('CAPY-007 + CAPY-012: send key remaps per browser; attached files upload and go to the inbox by file id',async({page})=>{
 const calls=await mock(page);await page.goto('/#/threads/thr_1');
 const box=page.getByLabel('message');await box.fill('line one');await box.press('Shift+Enter');await box.pressSequentially('line two');await box.press('Enter');
 await expect.poll(()=>posts(calls,'POST','/threads/thr_1/message')).toEqual([{text:'line one\nline two'}]);
 await page.getByLabel('send key').selectOption('mod+enter');await page.reload();await expect(page.getByLabel('send key')).toHaveValue('mod+enter');
 await box.fill('a');await box.press('Enter');await box.pressSequentially('b');await expect(box).toHaveValue('a\nb');
 await page.getByLabel('attach').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('hello agent')});await expect(page.getByText('notes.txt')).toBeVisible();
 await box.press('Control+Enter');
 await expect.poll(()=>posts(calls,'POST','/threads/thr_1/inbox')).toEqual([{text:'a\nb',mode:'queue',attachments:['fil_1']}]);
 expect(posts(calls,'POST','/files')).toEqual([{name:'notes.txt',contentType:'text/plain',size:11}]);expect(posts(calls,'PUT','/uploads/fil_1?token=t')).toEqual(['hello agent']);
});

test('CAPY-027 + CAPY-033 + CAPY-034: sections with Reply, folded work, message ticks, and reading place',async({page})=>{
 const calls=await mock(page,{'GET /threads/thr_1/reading-place':()=>({threadId:'thr_1',seq:7,offset:0})});await page.setViewportSize({width:900,height:400});await page.goto('/#/threads/thr_1');
 await expect(page.getByRole('heading',{name:'Plan'})).toBeAttached();await expect(page.getByText('Worked · 1 tool call')).toBeAttached();await expect(page.getByText('agent.tool_result')).toBeHidden();
 await expect(page.getByText('second ask')).toBeInViewport();
 await page.getByRole('button',{name:'Jump to ask 1'}).click();await expect(page.getByText('first ask')).toBeInViewport();
 await expect.poll(()=>posts(calls,'PUT','/threads/thr_1/reading-place').at(-1)).toMatchObject({seq:1});
 await page.getByRole('button',{name:'Reply'}).nth(1).click();await expect(page.getByLabel('message')).toHaveValue('> **Plan**\n> Do a\n\n');
});

test('CAPY-015 + CAPY-472: request cards are exact, open env/desktop/feedback inline, and Dismiss has Undo',async({page})=>{
 let open=[{id:'apr_m',title:'Waiting on you to merge acme/app#12',inline:null},{id:'apr_e',title:'Waiting on you to set STRIPE_KEY',inline:{kind:'env',name:'STRIPE_KEY'}},{id:'apr_d',title:'Waiting on you to use the desktop',inline:{kind:'desktop',url:'about:blank#vnc'}},{id:'apr_f',title:'Waiting on you to approve feedback: Drops images',inline:{kind:'feedback',title:'Drops images',body:'Steps'}}];
 const calls=await mock(page,{'GET /threads/thr_1/requests':()=>({items:open}),'POST /approvals/apr_m/undo':()=>({id:'apr_m'}),'POST /approvals/apr_f/feedback':()=>({sent:true})});await page.goto('/#/threads/thr_1');
 await expect(page.getByText('Waiting on you to merge acme/app#12')).toBeVisible();await expect(page.locator('iframe[title=desktop]')).toHaveAttribute('src','about:blank#vnc');
 await page.getByLabel('STRIPE_KEY').fill('sk_test_fake');await page.getByRole('button',{name:'Save'}).click();
 await expect.poll(()=>posts(calls,'PUT','/me/environment-variables')).toEqual([{variables:[{name:'STRIPE_KEY',value:'sk_test_fake'}]}]);await expect.poll(()=>posts(calls,'POST','/approvals/apr_e/answer')).toEqual([{optionId:'done'}]);
 await page.getByLabel('feedback report').fill('Steps: paste PNG');await page.getByRole('button',{name:'Send report'}).click();
 await expect.poll(()=>posts(calls,'POST','/approvals/apr_f/feedback')).toEqual([{optionId:'send',body:'Steps: paste PNG'}]);
 await page.getByRole('article').filter({hasText:'merge acme'}).getByRole('button',{name:'Dismiss'}).click();await expect(page.getByText('Waiting on you to merge acme/app#12')).toBeHidden();
 open=[open[0]];await page.getByRole('button',{name:'Undo'}).click();await expect(page.getByText('Waiting on you to merge acme/app#12')).toBeVisible();
 expect(calls.filter(c=>c.path.startsWith('/approvals/apr_m')).map(c=>c.path)).toEqual(['/approvals/apr_m/dismiss','/approvals/apr_m/undo']);
});

test('CAPY-472: /feedback in the composer drafts a report for owner approval instead of sending it',async({page})=>{
 const calls=await mock(page,{'POST /threads/thr_1/feedback':()=>({id:'apr_f'})});await page.goto('/#/threads/thr_1');
 await page.getByLabel('message').fill('/feedback Composer drops images\nSteps: paste a PNG');await page.getByRole('button',{name:'Queue'}).click();
 await expect.poll(()=>posts(calls,'POST','/threads/thr_1/feedback')).toEqual([{title:'Composer drops images',body:'Steps: paste a PNG'}]);expect(posts(calls,'POST','/threads/thr_1/message')).toEqual([]);
});

test('CAPY-016: Cmd+K jumps to a thread by code and @ inserts a thread code',async({page})=>{
 const calls=await mock(page,{'GET /threads/lookup':c=>({items:c.path.includes('FLO')||c.path.includes('flo')?[{id:'thr_9',code:'FLO-9A',title:'Fix login'}]:[]})});await page.goto('/#/threads/thr_1');
 await page.getByLabel('message').pressSequentially('see @FLO');await page.getByRole('button',{name:'@FLO-9A Fix login'}).click();await expect(page.getByLabel('message')).toHaveValue('see @FLO-9A ');
 await page.keyboard.press('Control+k');await page.getByLabel('go to thread').fill('flo-9a');await page.getByRole('button',{name:'FLO-9A Fix login'}).click();await expect(page).toHaveURL(/#\/threads\/thr_9$/);
 expect(calls.some(c=>c.path==='/threads/lookup?q=flo-9a')).toBe(true);
});

test('CAPY-471 + CAPY-032: ?prompt= deep link pre-fills the composer and creates a no-project thread',async({page})=>{
 const calls=await mock(page,{'POST /threads':()=>({id:'thr_new'})});await page.goto('/#/compose?prompt=Fix%20the%20login%0Aplease');
 await expect(page.getByLabel('message')).toHaveValue('Fix the login\nplease');await expect(page.getByLabel('project')).toHaveValue('');
 await page.getByRole('button',{name:'Queue'}).click();
 await expect.poll(()=>posts(calls,'POST','/threads')).toEqual([{projectId:null,title:'Fix the login',prompt:'Fix the login\nplease',engine:'fake'}]);await expect(page).toHaveURL(/#\/threads\/thr_new$/);
});
