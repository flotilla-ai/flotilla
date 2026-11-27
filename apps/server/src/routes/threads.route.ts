import { Hono } from 'hono';
import Docker from 'dockerode';
import { fakeAdapter } from '@flotilla/adapter-fake';
import { EventStore } from '../events/store.js';
import { DockerMachineDriver } from '../machines/dockerDriver.js';
import { ThreadRunner } from '../runner/runner.js';
import { parseVariables, secretsStore } from '../secrets/store.js';
import { modelsCatalogStore, withConnectionKeys } from '../models-catalog/store.js';

let singleton: ThreadRunner | null = null;
export function defaultRunner(): ThreadRunner {
  singleton ??= new ThreadRunner({ store: new EventStore(process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'), driver: new DockerMachineDriver(new Docker()), adapters: new Map([['fake', fakeAdapter]]), vault: withConnectionKeys(secretsStore()), resolveEngine: (user, engine) => modelsCatalogStore().resolve(user, engine) });
  return singleton;
}
function userId(c: unknown): string { return (c as { get(key: string): string }).get('userId'); }
export function createThreadsRoute(runner = defaultRunner()) {
  const app = new Hono();
  app.post('/threads', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!body.title || !body.prompt) return c.json({ error: 'title and prompt required' }, 400);
    const env = parseVariables(body.environmentVariables);
    const resolved = body.engine === undefined ? undefined : await modelsCatalogStore().resolve(userId(c), body.engine);
    const engine = resolved && { adapter: resolved.adapter, model: resolved.model, effort: resolved.effort, connectionId: resolved.connectionId };
    const row = await runner.createThread({ ownerId: userId(c), projectId: body.projectId ?? null, title: body.title, prompt: body.prompt, engine, maxUsd: body.maxUsd ?? null, requestId: body.requestId, env });
    return c.json(row, 201);
  });
  app.post('/threads/:id/message', async (c) => { const body = await c.req.json().catch(() => ({})); await runner.message(c.req.param('id'), body.text ?? '', body.mode ?? 'queue', userId(c)); return c.body(null, 202); });
  app.post('/threads/:id/interrupt', async (c) => { await runner.interrupt(c.req.param('id'), userId(c)); return c.body(null, 202); });
  app.post('/threads/:id/stop', async (c) => { await runner.stop(c.req.param('id'), userId(c)); return c.body(null, 202); });
  app.post('/approvals/:id/answer', async (c) => { const body = await c.req.json().catch(() => ({})); const row = await runner.answerApproval(c.req.param('id'), body.optionId ?? '', body.value, userId(c)); return row ? c.json(row) : c.json({ error: 'not found' }, 404); });
  return { basePath: '/api/v1', app, public: false };
}
export default createThreadsRoute();
