import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCaptainFixtures, type CaptainFixtures } from '../captain-fixtures/index.js';
import { HttpSearchProvider, MemoryFetchStore, ResearchService, readableText } from './index.js';

let fx: CaptainFixtures;
beforeAll(async () => { fx = await startCaptainFixtures(); });
afterAll(async () => { await fx.close(); });

describe('research search/fetch', () => {
  it('web.search uses the provider interface with fixture results', async () => {
    const svc = new ResearchService({ search: new HttpSearchProvider('fixture', `${fx.baseUrl}/search`) });
    const out = await svc.webSearch('rocket altitude');
    expect(out).toHaveLength(2); expect(out[0].url).toContain('news.fixture.test');
  });
  it('web.fetch extracts readable text fences it stores by hash and uses TTL cache', async () => {
    let calls = 0; const store = new MemoryFetchStore();
    const html = await (await fetch(fx.pages['/news/article'])).text();
    const svc = new ResearchService({ search: new HttpSearchProvider('fixture', `${fx.baseUrl}/search`), store, ttlMin: 30, fetcher: async () => { calls++; return { status: 200, text: html, etag: 'e1' }; } });
    const first = await svc.webFetch(fx.pages['/news/article']);
    const second = await svc.webFetch(fx.pages['/news/article']);
    expect(calls).toBe(1); expect(second.cache).toBe('hit'); expect(second.hash).toBe(first.hash);
    expect(first.text).toContain('120 km'); expect(first.fenced).toContain('<untrusted source="web.fetch"');
    expect(first.fenced).toMatch(/<\/untrusted id="[^"]+">$/);
  });
  it('changed ETag stores the same hash as a new cache generation and injection stays fenced data', async () => {
    let etag = 'e1'; let now = 1_000; const store = new MemoryFetchStore();
    const injection = await (await fetch(fx.pages['/news/injection'])).text();
    const svc = new ResearchService({ search: new HttpSearchProvider('fixture', `${fx.baseUrl}/search`), store, now: () => now, fetcher: async () => ({ status: 200, text: injection, etag }) });
    const a = await svc.webFetch(fx.pages['/news/injection']); etag = 'e2'; now += 31 * 60_000; const b = await svc.webFetch(fx.pages['/news/injection']);
    expect(b.hash).toBe(a.hash); expect(b.cache).toBe('miss');
    expect(b.text).toContain('Ignore previous instructions');
    const nonce = /id="([^"]+)"/.exec(b.fenced)?.[1] ?? 'missing';
    expect((b.fenced.match(new RegExp(`</untrusted id="${nonce}">`, 'g')) ?? [])).toHaveLength(1);
  });
  it('goes through the gate abstraction before fetching', async () => {
    const order: string[] = [];
    const svc = new ResearchService({ search: new HttpSearchProvider('fixture', `${fx.baseUrl}/search`), gate: { assertAllowed: async () => { order.push('gate'); } }, fetcher: async () => { order.push('fetch'); return { status: 200, text: '<p>x</p>' }; } });
    await svc.webFetch('https://example.test/'); expect(order).toEqual(['gate', 'fetch']);
    expect(readableText('<html><script>x</script><main>Hello <b>world</b></main></html>')).toBe('Hello world');
  });
});
