import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCaptainFixtures, type CaptainFixtures } from '../captain-fixtures/index.js';
import { createHttpGate, HttpSearchProvider, MemoryFetchStore, ResearchService, readableText } from './index.js';

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
    expect(second.etag).toBe('e1'); expect(second.finalUrl).toBe(first.finalUrl);
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
    expect(readableText('<html><script>x</script><main>Hello <b title="2 > 1">world</b>&nbsp;again</main></html>')).toBe('Hello world again');
    await expect(createHttpGate(async () => ['10.0.0.1']).assertAllowed('https://internal.test/')).rejects.toThrow('private');
    await expect(createHttpGate(async () => ['93.184.216.34']).assertAllowed('https://example.test/')).resolves.toBeUndefined();
    await expect(createHttpGate().assertAllowed('https://[2606:4700:4700::1111]/')).resolves.toBeUndefined();
    expect(readableText('<p>a</p><!--open<!--open<p>secret</p>')).toBe('a');
    expect(readableText('<p title="x <!-- y">visible</p> tail')).toBe('visible tail');
    await expect(createHttpGate().assertAllowed('https://[::ffff:127.0.0.1]/')).rejects.toThrow('private');
    await expect(createHttpGate().assertAllowed('https://[::ffff:7f00:1]/')).rejects.toThrow('private');
  });

  it('does not cache redirect bodies as fetched pages', async () => {
    const svc = new ResearchService({ search: new HttpSearchProvider('fixture', `${fx.baseUrl}/search`), fetcher: async () => ({ status: 302, text: '' }) });
    await expect(svc.webFetch('https://example.test/redirect')).rejects.toThrow('302');
  });
});
