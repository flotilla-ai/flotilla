import { Hono, type Context } from 'hono';
import { rulesStore } from '../rules/store.js';
import { RULES_GUIDANCE } from '../rules/types.js';

const userId = (c: Context) => c.get('userId') as string;
const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Org/personal/project instructions, guidance, per-thread context breakdown, experiments and Memory. */
export function createRulesRoute(store = () => rulesStore()) {
  const app = new Hono();
  app.get('/rules/instructions', async (c) => c.json({ org: await store().instructions('org', 'org'), user: await store().instructions('user', userId(c)) }));
  app.put('/rules/instructions/org', async (c) => c.json(await store().putInstructions(userId(c), 'org', 'org', (await body(c)).text)));
  app.put('/rules/instructions/me', async (c) => c.json(await store().putInstructions(userId(c), 'user', userId(c), (await body(c)).text)));
  app.get('/projects/:id/rules', async (c) => c.json(await store().instructions('project', await store().ownedProject(userId(c), c.req.param('id')))));
  app.put('/projects/:id/rules', async (c) => c.json(await store().putInstructions(userId(c), 'project', await store().ownedProject(userId(c), c.req.param('id')), (await body(c)).text)));
  app.get('/rules/guidance', (c) => c.json(RULES_GUIDANCE));
  app.get('/threads/:id/context', async (c) => c.json(await store().context(userId(c), c.req.param('id'))));
  app.get('/experiments', async (c) => c.json(await store().experiments(userId(c))));
  app.put('/experiments', async (c) => c.json(await store().setExperiments(userId(c), await body(c))));
  app.get('/memory', async (c) => c.json({ items: await store().memory(userId(c)) }));
  app.post('/memory', async (c) => c.json(await store().teach(userId(c), await body(c)), 201));
  app.delete('/memory/:id', async (c) => { await store().forget(userId(c), c.req.param('id')); return c.body(null, 204); });
  return { basePath: '/api/v1', app, public: false };
}
export default createRulesRoute();
