import { Hono } from 'hono';
import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import { addCrew, archiveCrew, promoteCaptain } from '../captain-create-crew/index.js';
import { CAPTAIN_PHOTO_LIBRARY, CaptainMachineApiStore } from '../captain-machine-api/index.js';
import { defaultRunner } from './threads.route.js';

function userId(c: unknown): string { return (c as { get(key: string): string }).get('userId'); }
async function jsonBody(c: { req: { json(): Promise<any> } }): Promise<Record<string, any>> {
  const b = await c.req.json().catch(() => null);
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ApiFailure('ValidationFailed', 'a JSON object body is required');
  return b as Record<string, any>;
}
const zero = { usd: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0 };
const budget = { maxUsd: null, maxTokens: null, maxWallSec: null, scope: 'captain-subtree', onHit: 'pause-and-ask', warnAt: 0.8 };
async function limitedBody(raw: Request, maxBytes: number): Promise<Buffer> {
  const stream = raw.body;
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new ApiFailure('PayloadTooLarge', 'photo exceeds 1 MiB'); }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks);
}
type CreateThread = (input: { ownerId: string; projectId?: string | null; title: string; prompt: string; engine?: unknown; maxUsd?: number | null; draft?: boolean }) => Promise<Record<string, any>>;

/** Captain CRUD, profile/photo/placement and crew REST endpoints. */
export function createCaptainsRoute(pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla' }), createThread: CreateThread = (input) => defaultRunner().createThread(input as never) as Promise<Record<string, any>>, message: (threadId: string, text: string, userId: string) => Promise<unknown> = (threadId, text, user) => defaultRunner().message(threadId, text, 'queue', user)) {
  const app = new Hono(); const api = new CaptainMachineApiStore(pool);
  const crewStarts = new Map<string, Promise<unknown>>();
  const serializeCrewStart = async <T>(captainId: string, fn: () => Promise<T>): Promise<T> => {
    const prior = crewStarts.get(captainId) ?? Promise.resolve();
    const run = prior.catch(() => undefined).then(fn);
    crewStarts.set(captainId, run.catch(() => undefined));
    return run;
  };
  app.get('/photo-library', (c) => c.json({ items: CAPTAIN_PHOTO_LIBRARY }));
  app.get('/', async (c) => c.json({ items: await api.list(userId(c)) }));
  app.post('/', async (c) => {
    const b = await jsonBody(c);
    if (b.projectId && !(await pool.query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [b.projectId, userId(c)])).rows[0]) return c.json({ error: 'project not found' }, 404);
    const maxConcurrentCrew = b.maxConcurrentCrew == null ? 5 : Number(b.maxConcurrentCrew);
    if (!Number.isInteger(maxConcurrentCrew) || maxConcurrentCrew < 1 || maxConcurrentCrew > 5) throw new ApiFailure('ValidationFailed', 'maxConcurrentCrew must be an integer from 1 to 5');
    const rows = await pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ('thr_'||gen_random_uuid(),'FLO-'||upper(substr(gen_random_uuid()::text,1,4)),$1,'captain',$2,$3,'idle',$4,$5,$6) RETURNING *`, [b.projectId ?? null, userId(c), b.title ?? 'Captain', JSON.stringify(b.engine ?? { adapter: 'fake' }), JSON.stringify(b.budget ?? budget), JSON.stringify(zero)]);
    const t = rows.rows[0];
    await pool.query('INSERT INTO captains (thread_id,purpose,crew_runs_on,max_concurrent_crew,drive_root,digest_md,hook_bundle,wake_policy) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [t.id, String(b.purpose ?? b.title ?? 'Captain'), 'pool', maxConcurrentCrew, null, '', null, JSON.stringify({ heartbeatSec: [600, 7200], coalesceSec: 30 })]);
    void message(String(t.id), String(b.purpose ?? b.title ?? 'Captain'), userId(c)).catch(() => undefined);
    return c.json({ ...t, captain: { purpose: b.purpose ?? b.title ?? 'Captain', crewRunsOn: 'pool', maxConcurrentCrew: maxConcurrentCrew, digestMd: '' } }, 201);
  });
  app.post('/promote', async (c) => { const b = await jsonBody(c); return c.json(await promoteCaptain(pool, userId(c), String(b.threadId ?? '')), 201); });
  app.get('/:id', async (c) => {
    const r = await api.owned(userId(c), c.req.param('id')).catch(() => null);
    return r ? c.json({ ...r, captain: { purpose: r.purpose, crewRunsOn: r.crew_runs_on, maxConcurrentCrew: r.max_concurrent_crew, driveRoot: r.drive_root, digestMd: r.digest_md, hookBundle: r.hook_bundle, wakePolicy: r.wake_policy, alias: r.alias ?? null, photo: r.photo } }) : c.json({ error: 'not found' }, 404);
  });
  app.get('/:id/crew', async (c) => c.json({ items: await api.crew(userId(c), c.req.param('id')) }));
  app.post('/:id/crew-thread', async (c) => {
    const captain = await api.owned(userId(c), c.req.param('id'));
    const b = await jsonBody(c);
    if (!b.title || !b.prompt) throw new ApiFailure('ValidationFailed', 'title and prompt are required');
    const requestedInput = b.maxUsd ?? b.budget;
    if (requestedInput !== undefined && requestedInput !== null && (!Number.isFinite(Number(requestedInput)) || Number(requestedInput) < 0)) throw new ApiFailure('ValidationFailed', 'maxUsd must be a non-negative number');
    return serializeCrewStart(captain.id, async () => {
      const active = Number((await pool.query(`SELECT count(*)::int n FROM threads WHERE crew_of=$1 AND status IN ('queued','working','paused')`, [captain.id])).rows[0]?.n ?? 0);
      const maxCrew = Number(captain.max_concurrent_crew ?? 5);
      if (active >= maxCrew) throw new ApiFailure('Conflict', 'Captain crew concurrency limit reached');
      const policy = (captain.budget ?? {}) as Record<string, unknown>; const spent = (captain.spent ?? {}) as Record<string, unknown>;
      let maxUsd: number | null = requestedInput == null ? null : Number(requestedInput);
      if (policy.maxUsd != null) {
        const remaining = Math.max(0, Number(policy.maxUsd) - Number(spent.usd ?? 0));
        maxUsd = maxUsd == null ? remaining : Math.min(maxUsd, remaining);
        if (maxUsd <= 0) throw new ApiFailure('Conflict', 'Captain subtree budget exhausted');
      }
      const thread = await createThread({ ownerId: userId(c), projectId: captain.project_id ?? null, title: String(b.title), prompt: String(b.prompt), engine: b.engine, maxUsd, draft: true });
      const membership = await addCrew(pool, userId(c), c.req.param('id'), String(thread.id));
      await message(String(thread.id), String(b.prompt), userId(c));
      return c.json({ thread: { ...thread, crew_of: captain.id }, membership }, 201);
    });
  });
  app.post('/:id/crew/:threadId', async (c) => { const m = await addCrew(pool, userId(c), c.req.param('id'), c.req.param('threadId')); return c.json(m, m.existing ? 200 : 201); });
  app.post('/:id/crew/:threadId/archive', async (c) => { await archiveCrew(pool, userId(c), c.req.param('id'), c.req.param('threadId')); return c.json({ archived: true }); });
  app.delete('/:id/crew/:threadId', async (c) => {
    const r = await pool.query('UPDATE threads SET crew_of=null WHERE id=$1 AND crew_of=$2 AND EXISTS (SELECT 1 FROM threads captain WHERE captain.id=$2 AND captain.owner_id=$3)', [c.req.param('threadId'), c.req.param('id'), userId(c)]);
    if (!r.rowCount) throw new ApiFailure('NotFound', 'crew membership not found');
    return c.body(null, 204);
  });
  app.get('/:id/digest', async (c) => c.json(await api.digest(userId(c), c.req.param('id'))));
  app.get('/:id/profile', async (c) => c.json(await api.profile(userId(c), c.req.param('id'))));
  app.patch('/:id/profile', async (c) => c.json(await api.updateProfile(userId(c), c.req.param('id'), await jsonBody(c))));
  app.put('/:id/photo', async (c) => {
    await api.owned(userId(c), c.req.param('id'));
    return c.json(await api.uploadPhoto(userId(c), c.req.param('id'), c.req.header('content-type')?.split(';')[0] ?? '', await limitedBody(c.req.raw, 1024 * 1024)));
  });
  app.get('/:id/photo', async (c) => {
    const photo = await api.photo(userId(c), c.req.param('id'));
    if (!photo) throw new ApiFailure('NotFound', 'photo not found');
    return c.body(new Uint8Array(photo.content), 200, { 'content-type': photo.contentType, 'x-content-type-options': 'nosniff' });
  });
  app.put('/:id/photo/library', async (c) => c.json(await api.setLibraryPhoto(userId(c), c.req.param('id'), String((await jsonBody(c)).libraryId ?? ''))));
  app.get('/:id/placement', async (c) => c.json(await api.placement(userId(c), c.req.param('id'))));
  app.put('/:id/placement', async (c) => c.json(await api.setPlacement(userId(c), c.req.param('id'), await jsonBody(c))));
  return { basePath: '/api/v1/captains', app, public: false };
}
export default createCaptainsRoute();
