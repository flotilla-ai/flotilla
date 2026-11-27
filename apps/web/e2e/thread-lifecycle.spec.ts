import {expect,test,type Page} from '@playwright/test';
const row=(id:string,title:string)=>({id,title,status:'idle',pinned:false,tags:[],folder:null,unread:true,mentions:1,archivedAt:null});
const views:Record<string,any>={thr_1:{title:'Mine',ownerId:'usr_me',visibility:'private',member:null},thr_2:{title:'Theirs',ownerId:'usr_bob',visibility:'shared',member:null}};
async function inbox(page:Page){
 const posts:any[]=[];const puts:any[]=[];
 await page.route('**/api/v1/auth/me',r=>r.fulfill({json:{userId:'usr_me',csrfToken:'c'}}));
 await page.route('**/api/v1/me/threads**',r=>r.fulfill({json:{items:[row('thr_1','Mine'),row('thr_2','Theirs')]}}));
 await page.route('**/api/v1/thread-settings/*',async r=>{if(r.request().method()==='PUT')puts.push({url:r.request().url(),body:r.request().postDataJSON()});return r.fulfill({json:r.request().postDataJSON()??{titleInstructions:'',regenerateWhen:null,autoArchiveDays:null}})});
 await page.route('**/api/v1/threads/*/lifecycle',async r=>{const id=r.request().url().split('/').at(-2)!;if(r.request().method()==='POST')posts.push({id,...r.request().postDataJSON()});return r.fulfill({json:views[id]})});
 page.on('dialog',d=>void d.accept(d.message().startsWith('Transfer')?'usr_bob':'Renamed'));
 await page.goto('/#/inbox');return {posts,puts};
}
test('CAPY-017/024 owner renames, regenerates, shares and transfers',async({page})=>{
 const {posts}=await inbox(page);await page.getByText('Mine').click();
 for(const name of ['Rename','Regenerate title','Share','Transfer'])await page.getByRole('button',{name,exact:true}).click();
 await expect.poll(()=>posts).toEqual([{id:'thr_1',action:'rename',title:'Renamed'},{id:'thr_1',action:'regenerate-title'},{id:'thr_1',action:'visibility',visibility:'shared'},{id:'thr_1',action:'transfer',toUserId:'usr_bob'}]);
 await expect(page.getByRole('button',{name:'Take over'})).toHaveCount(0);
});
test('CAPY-022/023 collaborator joins, subscribes and takes over a shared thread',async({page})=>{
 const {posts}=await inbox(page);await page.getByText('Theirs').click();
 for(const name of ['Join','Subscribe','Take over'])await page.getByRole('button',{name,exact:true}).click();
 await expect.poll(()=>posts.map(p=>p.action)).toEqual(['join','subscribe','takeover']);
 await expect(page.getByRole('button',{name:'Transfer'})).toHaveCount(0);
});
test('CAPY-017/473 org title instructions, regenerate-when and auto-archive settings',async({page})=>{
 const {puts}=await inbox(page);await page.getByLabel('settings scope').selectOption('org');
 await page.getByLabel('title instructions').fill('Prefix with team');await page.getByLabel('regenerate title').selectOption('each-message');await page.getByLabel('auto-archive days').fill('14');
 await page.getByRole('button',{name:'Save settings'}).click();
 await expect.poll(()=>puts).toEqual([{url:expect.stringContaining('/thread-settings/org'),body:{titleInstructions:'Prefix with team',regenerateWhen:'each-message',autoArchiveDays:14}}]);
});
test('CAPY-018/019/020/021/474/475 bulk range archive+undo, delete, mark all read, mention badge, cost',async({page})=>{
 const bulk:any[]=[];let readAll=0;
 await page.route('**/api/v1/threads/bulk',async r=>{bulk.push(r.request().postDataJSON());return r.fulfill({json:{results:[]}})});
 await page.route('**/api/v1/threads/read-all',r=>{readAll++;return r.fulfill({json:{marked:2}})});
 await page.route('**/api/v1/threads/*/cost',r=>r.fulfill({json:{total:{usd:1500},byKind:{input:10,output:20,cache:5},byModel:[{model:'fake-1',usd:1500}]}}));
 await inbox(page);await expect(page.getByText('@1').first()).toBeVisible();
 await page.getByText('Mine').click();await page.getByText('Theirs').click({modifiers:['Shift']});
 await page.getByRole('button',{name:'Archive',exact:true}).click();await page.getByRole('button',{name:'Undo archive'}).click();
 await page.getByText('Mine').click();await page.getByRole('button',{name:'Delete'}).click();
 await page.getByRole('button',{name:'Mark all read'}).click();await page.getByRole('button',{name:'Cost'}).first().click();
 await expect(page.getByText('tokens in 10 · out 20 · cache 5')).toBeVisible();
 await expect.poll(()=>bulk).toEqual([{action:'archive',threadIds:['thr_1','thr_2']},{action:'unarchive',threadIds:['thr_1','thr_2']},{action:'delete',threadIds:['thr_1']}]);expect(readAll).toBe(1);
});
