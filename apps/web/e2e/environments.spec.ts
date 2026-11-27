import {expect,test} from '@playwright/test';
const spec={setup:{initialize:{script:'pnpm i',timeoutSec:900},refresh:{script:'',timeoutSec:300}},startup:[{name:'web',command:'pnpm dev',readinessPort:5173,preview:true}],commands:[{name:'test',command:'pnpm test',description:'run tests'}]};
test('CAPY-189 + menu lists services, commands and terminals with status dots; CAPY-183 saves a new version',async({page})=>{
 const puts:any[]=[];const runs:string[]=[];let commandState='idle';
 await page.route('**/api/v1/projects/prj_1/environment',r=>{if(r.request().method()==='PUT')puts.push(r.request().postDataJSON());return r.fulfill({json:{version:puts.length+1,spec}})});
 await page.route('**/api/v1/projects/prj_1/environment/versions',r=>r.fulfill({json:{items:[...(puts.length?[{version:2,source:'user',note:'',spec,verification:null}]:[]),{version:1,source:'agent',note:'agent setup',spec,verification:{state:'passed'}}]}}));
 await page.route('**/api/v1/threads/thr_1/environment',r=>r.fulfill({json:{services:[{name:'web',state:'ready',readinessPort:5173,preview:true},{name:'db',state:'failed',readinessPort:5432,preview:false}],commands:[{name:'test',state:commandState,description:'run tests'}],terminals:[]}}));
 await page.route('**/api/v1/threads/thr_1/environment/commands/*',r=>{runs.push(r.request().url().split('/').at(-1)!);commandState='passed';return r.fulfill({json:{state:'passed',exitCode:0,output:'ok'}})});
 await page.goto('/#/environments');await page.getByLabel('project id').fill('prj_1');
 await expect(page.getByText('v1 agent agent setup passed')).toBeVisible();
 await page.getByRole('button',{name:'Save environment'}).click();await expect(page.getByText('v2 user')).toBeVisible();expect(puts).toEqual([{spec}]);
 await page.getByLabel('thread id').fill('thr_1');await page.getByRole('button',{name:'environment menu'}).click();
 const menu=page.getByRole('menu');
 for(const t of ['Services','Commands','Terminals','web','db','preview'])await expect(menu.getByText(t,{exact:true}).first()).toBeVisible();
 await expect(menu.getByLabel('status ready')).toHaveCount(1);await expect(menu.getByLabel('status failed')).toHaveCount(1);await expect(menu.getByLabel('status idle')).toHaveCount(1);
 expect(await menu.getByLabel('status failed').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(242, 140, 40)');
 await menu.getByRole('menuitem',{name:'test'}).click();await expect(menu.getByLabel('status passed')).toHaveCount(1);expect(runs).toEqual(['test']);
});
