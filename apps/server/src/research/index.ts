import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fenceUntrusted } from '@flotilla/core/kernel/fenceUntrusted';

export type SearchResult = { url: string; title: string; snippet?: string };
export type SearchProvider = { name: string; search(query: string): Promise<SearchResult[]> };
export type FetchResult = { url: string; finalUrl: string; etag?: string; lastModified?: string; text: string; hash: string; fenced: string; cache: 'hit' | 'miss' | 'revalidated' };
export type FetchedText = { hash: string; text: string; fetchedAt: number; ttlMin: number; finalUrl?: string; etag?: string; lastModified?: string };
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
  constructor(private maxEntries = 200) {}
  get(key: string, now: number): FetchedText | undefined { const hit = this.items.get(key); return hit && now - hit.fetchedAt < hit.ttlMin * 60_000 ? hit : undefined; }
  put(key: string, value: FetchedText): void {
    this.items.set(key, value);
    const now = value.fetchedAt;
    for (const [k, v] of this.items) if (now - v.fetchedAt >= v.ttlMin * 60_000) this.items.delete(k);
    while (this.items.size > this.maxEntries) this.items.delete(this.items.keys().next().value as string);
  }
  byHash(hash: string): FetchedText | undefined { return [...this.items.values()].find((v) => v.hash === hash); }
  forUrl(url: string, now: number): FetchedText | undefined {
    return [...this.items.entries()].filter(([key]) => key.startsWith(`${url}\n`)).map(([, value]) => value).filter((v) => now - v.fetchedAt < v.ttlMin * 60_000).sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
  }
}

export function readableText(html: string): string {
  const withoutBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutBlocks.replace(/<!--[\s\S]*?-->|<(?:[^<>"']|"[^"]*"|'[^']*')*>/g, ' ');
  return withoutTags.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const x = ip.toLowerCase(); return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80:');
}

/** SSRF-safe default gate: public http(s) only, no private/link-local DNS results. Redirects are not followed by the default fetcher. */
export function createHttpGate(resolve: (host: string) => Promise<string[]> = async (host) => (await lookup(host, { all: true })).map((x) => x.address)): FetchGate {
  return { async assertAllowed(raw) {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('unsupported url scheme');
    if (u.username || u.password) throw new Error('url credentials refused');
    if (isIP(u.hostname)) { if (privateIp(u.hostname)) throw new Error('private destination refused'); return; }
    const ips = await resolve(u.hostname).catch(() => []);
    if (!ips.length || ips.some(privateIp)) throw new Error('private destination refused');
  } };
}

export class ResearchService {
  constructor(private deps: { search: SearchProvider; gate?: FetchGate; fetcher?: Fetcher; store?: MemoryFetchStore; ttlMin?: number; now?: () => number }) {}
  async webSearch(query: string): Promise<SearchResult[]> { return this.deps.search.search(query); }
  async webFetch(url: string): Promise<FetchResult> {
    if (this.deps.gate) await this.deps.gate.assertAllowed(url);
    const store = this.deps.store ?? new MemoryFetchStore();
    const now = (this.deps.now ?? Date.now)();
    const ttlMin = this.deps.ttlMin ?? Number(process.env.FLOTILLA_FETCH_TTL_MIN ?? 30);
    const fetcher = this.deps.fetcher ?? (async (u: string) => { const r = await fetch(u, { redirect: 'manual' }); return { status: r.status, text: await r.text(), etag: r.headers.get('etag') ?? undefined, lastModified: r.headers.get('last-modified') ?? undefined, finalUrl: r.url }; });
    const fresh = store.forUrl(url, now);
    if (fresh) return { url, finalUrl: fresh.finalUrl ?? url, etag: fresh.etag, lastModified: fresh.lastModified, text: fresh.text, hash: fresh.hash, fenced: fenceUntrusted('web.fetch', fresh.text), cache: 'hit' };
    const probe = await fetcher(url);
    if (probe.status >= 400) throw new Error(`fetch failed: ${probe.status}`);
    const key = `${url}\n${probe.etag ?? ''}\n${probe.lastModified ?? ''}`;
    const cached = store.get(key, now);
    if (cached) return { url, finalUrl: probe.finalUrl ?? url, etag: probe.etag, lastModified: probe.lastModified, text: cached.text, hash: cached.hash, fenced: fenceUntrusted('web.fetch', cached.text), cache: 'hit' };
    const text = readableText(probe.text);
    const hash = createHash('sha256').update(text).digest('hex');
    store.put(key, { hash, text, fetchedAt: now, ttlMin, finalUrl: probe.finalUrl ?? url, etag: probe.etag, lastModified: probe.lastModified });
    return { url, finalUrl: probe.finalUrl ?? url, etag: probe.etag, lastModified: probe.lastModified, text, hash, fenced: fenceUntrusted('web.fetch', text), cache: store.byHash(hash) ? 'miss' : 'miss' };
  }
}
