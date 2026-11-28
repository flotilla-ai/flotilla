import { Hono, type Context } from 'hono';
import { HttpSearchProvider, MemoryFetchStore, ResearchService } from '../research/index.js';

const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
const sharedStore = new MemoryFetchStore();

/** Research MCP-facing seam. Live providers are configuration-only; tests use local fixture providers. */
export function createResearchRoute(service: ResearchService | (() => ResearchService) = () => new ResearchService({ search: new HttpSearchProvider(process.env.FLOTILLA_SEARCH_PROVIDER ?? 'fixture', process.env.FLOTILLA_SEARCH_ENDPOINT ?? 'http://127.0.0.1/search'), store: sharedStore })) {
  const svc = () => typeof service === 'function' ? service() : service;
  const app = new Hono();
  app.post('/research/search', async (c) => c.json({ results: await svc().webSearch(String((await body(c)).query ?? '')) }));
  app.post('/research/fetch', async (c) => c.json(await svc().webFetch(String((await body(c)).url ?? ''))));
  return { basePath: '/api/v1', app, public: false };
}
export default createResearchRoute();
