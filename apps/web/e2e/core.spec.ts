import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('**/api/v1/threads',r=>r.fulfill({json:[{id:'thr_1',title:'Seeded',status:'working',spent:{usd:1234},engine:{connectionId:null}}]}));
 await page.route('**/api/v1/threads/thr_1',r=>r.fulfill({json:{id:'thr_1',title:'Seeded',status:'working',spent:{usd:1234},engine:{connectionId:null}}}));
 await page.route('**/api/v1/threads/thr_1/messages',r=>r.fulfill({json:[{seq:1,kind:'user.message',payload:{text:'one'}},{seq:2,kind:'agent.delta',payload:{text:'two'}},{seq:3,kind:'run.ended',payload:{state:'completed'}}]}));
 await page.route('**/api/v1/threads/thr_1/stream',r=>r.fulfill({status:200,headers:{'content-type':'text/event-stream'},body:'\n'}));
});
test('thread list, ordered seeded events, and cost meter render',async({page})=>{
 await page.goto('/#/threads');await expect(page.getByText('Seeded')).toBeVisible();await page.getByText('Seeded').click();
 await expect(page.getByText('one')).toBeVisible();await expect(page.getByText('two')).toBeVisible();await expect(page.getByText('$0.001')).toBeVisible();
});
test('logged out API redirects to login',async({page})=>{
 await page.unroute('**/api/v1/threads');await page.route('**/api/v1/threads',r=>r.fulfill({status:401,json:{error:'auth'}}));
 await page.goto('/#/threads');await expect(page).toHaveURL(/#\/login/);
});
