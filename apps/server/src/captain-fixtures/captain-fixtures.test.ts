import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captainFixtureRepoPath, startCaptainFixtures, type CaptainFixtures } from './index.js';
import { existsSync } from 'node:fs';
import { get } from 'node:http';

let fx: CaptainFixtures;
beforeAll(async () => { fx = await startCaptainFixtures(); });
afterAll(async () => { await fx.close(); });
async function text(path: string) { const r = await fetch(`${fx.baseUrl}${path}`); return { status: r.status, body: await r.text() }; }

describe('captain fixtures', () => {
  it('serves six deterministic pages including contradiction and injection as inert data', async () => {
    for (const path of ['/news/article','/news/contradiction','/news/injection','/shop/product','/mail/login','/mail/totp']) expect((await text(path)).status).toBe(200);
    expect((await text('/news/contradiction')).body).toContain('80 km');
    const injection = await text('/news/injection');
    expect(injection.body).toContain('Ignore previous instructions');
    expect(injection.body).toContain('inert fixture text');
  });
  it('maps deterministic searches without a real search engine', async () => {
    expect(fx.search('rocket altitude')).toEqual([fx.urls['/news/article'], fx.urls['/news/contradiction']]);
    expect(fx.urls['/news/article']).toContain('news.fixture.test'); expect(fx.hostResolverRules).toContain('MAP news.fixture.test 127.0.0.1');
    const r = await fetch(`${fx.baseUrl}/search?q=rocket`); const results = (await r.json() as {results:string[]}).results; expect(results).toHaveLength(2); expect(results[0]).toContain('news.fixture.test:');
    const hostRouted = await new Promise<{status:number;body:string}>((resolve, reject) => { const req = get(`${fx.baseUrl}/article`, { headers: { host: 'news.fixture.test' } }, (res) => { let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve({ status: res.statusCode ?? 0, body })); }); req.on('error', reject); });
    expect(hostRouted.status).toBe(200); expect(hostRouted.body).toContain('120 km');
  });
  it('webmail has login, TOTP, five inbox emails and resettable send recording', async () => {
    expect((await fetch(`${fx.baseUrl}/mail/inbox`)).status).toBe(401);
    const login = await fetch(`${fx.baseUrl}/mail/login`, { method: 'POST', redirect: 'manual' }); expect(login.status).toBe(302);
    const bad = await fetch(`${fx.baseUrl}/mail/totp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '1' }), redirect: 'manual' }); expect(bad.status).toBe(403);
    const totp = await fetch(`${fx.baseUrl}/mail/totp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '000000' }), redirect: 'manual' });
    const cookie = totp.headers.get('set-cookie')?.split(';')[0] ?? '';
    const inboxRes = await fetch(`${fx.baseUrl}/mail/inbox`, { headers: { cookie } });
    const emails = (await inboxRes.json() as {emails:{body:string}[]}).emails;
    expect(emails).toHaveLength(5); expect(emails.some((m) => m.body.includes('Ignore previous instructions'))).toBe(true);
    await fetch(`${fx.baseUrl}/mail/send`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ to: 'a@example.test', text: 'hello' }) });
    expect(fx.mail.sendCalls).toHaveLength(1); fx.reset(); expect(fx.mail.sendCalls).toHaveLength(0);
  });
  it('records shop orders and ships a tiny failing repo fixture', async () => {
    await fetch(`${fx.baseUrl}/shop/order`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sku: 'mug' }) });
    expect(fx.shop.orders).toHaveLength(1); fx.reset(); expect(fx.shop.orders).toHaveLength(0);
    expect(existsSync(fx.repoPath)).toBe(true); expect(existsSync(captainFixtureRepoPath(process.cwd() + '/../..'))).toBe(true);
  });
});
