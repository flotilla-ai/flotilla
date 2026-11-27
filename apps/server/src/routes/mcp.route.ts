import { Hono, type Context } from 'hono';
import { ApiFailure } from '../api-platform/types.js';
import { mcpStore } from '../mcp/store.js';
import { parseServerInput } from '../mcp/types.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** MCP registry: servers, import, OAuth sign-in, Test, and the agent's in-thread proposals. No route returns a configured value. */
export function createMcpRoute(store = () => mcpStore()) {
  const app = new Hono();
  app.get('/mcp/servers', async (c) => c.json({ items: await store().list(userId(c)) }));
  app.post('/mcp/servers', async (c) => c.json(await store().create(userId(c), parseServerInput(await body(c))), 201));
  app.post('/mcp/import', async (c) => {
    const b = await body(c);
    if (typeof b.text !== 'string' || !b.text.trim()) throw new ApiFailure('ValidationFailed', 'text must be Claude Code JSON, Codex TOML, a URL or a command line');
    return c.json(await store().importText(userId(c), b.text, typeof b.projectId === 'string' ? b.projectId : null), 201);
  });
  app.get('/mcp/servers/:id', async (c) => c.json(await store().get(userId(c), c.req.param('id'))));
  app.patch('/mcp/servers/:id', async (c) => c.json(await store().update(userId(c), c.req.param('id'), await body(c))));
  app.delete('/mcp/servers/:id', async (c) => { await store().remove(userId(c), c.req.param('id')); return c.body(null, 204); });
  app.post('/mcp/servers/:id/test', async (c) => c.json(await store().test(userId(c), c.req.param('id'))));
  app.post('/mcp/servers/:id/oauth/start', async (c) => c.json(await store().startOAuth(userId(c), c.req.param('id'))));
  app.post('/mcp/oauth/flows/:id/cancel', async (c) => c.json(await store().cancelOAuth(userId(c), c.req.param('id'))));
  app.get('/mcp/oauth/callback', async (c) => {
    const { state, code } = c.req.query();
    if (!state || !code) throw new ApiFailure('ValidationFailed', 'state and code are required');
    const server = await store().finishOAuth(userId(c), state, code);
    return c.html(`<p>${server.key} is connected. You can close this tab.</p>`);
  });
  app.post('/threads/:id/mcp/proposals', async (c) => c.json(await store().propose(userId(c), c.req.param('id'), await body(c)), 201));
  return { basePath: '/api/v1', app, public: false };
}
export default createMcpRoute();
