import { createHash } from 'node:crypto';
import { fenceUntrusted } from '@flotilla/core/kernel/fenceUntrusted';

export type SearchResult = { url: string; title: string; snippet?: string };
export type SearchProvider = { name: string; search(query: string): Promise<SearchResult[]> };
export type FetchResult = { url: string; finalUrl: string; etag?: string; lastModified?: string; text: string; hash: string; fenced: string; cache: 'hit' | 'miss' | 'revalidated' };
export type FetchedText = { hash: string; text: string; fetchedAt: number; ttlMin: number };
export type FetchGate = { assertAllowed(url: string): Promise<void> };
export type Fetcher = (url: string) => Promise<{ status: number; text: string; etag?: string; lastModified?: string; finalUrl?: string }>;

export class HttpSearchProvider implements SearchProvider {
  constructor(public name: string, private endpoint: string, private fetchJson: (url: string) => Promise<unknown> = async (u) => (await fetch(u)).json()) {}
  async search(query: string): Promise<SearchResult[]> {
    const data = await this.fetchJson(`${this.endpoint}?q=${encodeURIComponent(query)}`) as { results?: Array<string | SearchResult> };
    return (data.results ?? []).map((r) => typeof r === 'string' ? { url: r, title: r } : r);
  }
}

export class MemoryFetchStore {
  private items = new Map<string, FetchedText>();
  get(key: string, now: number): FetchedText | undefined { const hit = this.items.get(key); return hit && now - hit.fetchedAt < hit.ttlMin * 60_000 ? hit : undefined; }
  put(key: string, value: FetchedText): void { this.items.set(key, value); }
  byHash(hash: string): FetchedText | undefined { return [...this.items.values()].find((v) => v.hash === hash); }
  forUrl(url: string, now: number): FetchedText | undefined {
    return [...this.items.entries()].filter(([key]) => key.startsWith(`${url}\n`)).map(([, value]) => value).filter((v) => now - v.fetchedAt < v.ttlMin * 60_000).sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
  }
}

export function readableText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export class ResearchService {
  constructor(private deps: { search: SearchProvider; gate?: FetchGate; fetcher?: Fetcher; store?: MemoryFetchStore; ttlMin?: number; now?: () => number }) {}
  async webSearch(query: string): Promise<SearchResult[]> { return this.deps.search.search(query); }
  async webFetch(url: string): Promise<FetchResult> {
    if (this.deps.gate) await this.deps.gate.assertAllowed(url);
    const store = this.deps.store ?? new MemoryFetchStore();
    const now = (this.deps.now ?? Date.now)();
    const ttlMin = this.deps.ttlMin ?? Number(process.env.FLOTILLA_FETCH_TTL_MIN ?? 30);
    const fetcher = this.deps.fetcher ?? (async (u: string) => { const r = await fetch(u); return { status: r.status, text: await r.text(), etag: r.headers.get('etag') ?? undefined, lastModified: r.headers.get('last-modified') ?? undefined, finalUrl: r.url }; });
    const fresh = store.forUrl(url, now);
    if (fresh) return { url, finalUrl: url, text: fresh.text, hash: fresh.hash, fenced: fenceUntrusted('web.fetch', fresh.text), cache: 'hit' };
    const probe = await fetcher(url);
    if (probe.status >= 400) throw new Error(`fetch failed: ${probe.status}`);
    const key = `${url}\n${probe.etag ?? ''}\n${probe.lastModified ?? ''}`;
    const cached = store.get(key, now);
    if (cached) return { url, finalUrl: probe.finalUrl ?? url, etag: probe.etag, lastModified: probe.lastModified, text: cached.text, hash: cached.hash, fenced: fenceUntrusted('web.fetch', cached.text), cache: 'hit' };
    const text = readableText(probe.text);
    const hash = createHash('sha256').update(text).digest('hex');
    store.put(key, { hash, text, fetchedAt: now, ttlMin });
    return { url, finalUrl: probe.finalUrl ?? url, etag: probe.etag, lastModified: probe.lastModified, text, hash, fenced: fenceUntrusted('web.fetch', text), cache: store.byHash(hash) ? 'miss' : 'miss' };
  }
}
