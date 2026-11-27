import { execFile, spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AgentAdapter, ProcessHandle, ProcessTransport, StartInput } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import { createRunnerQueueRoute } from '../routes/runner-queue.route.js';
import { createThreadComposerRoute } from '../routes/thread-composer.route.js';
import { ApiFailure, apiError } from '../api-platform/types.js';
import { ThreadComposerStore } from './store.js';

const exec = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function*(){let rest='';for await(const c of stream){rest+=c.toString();const p=rest.split('\n');rest=p.pop()!;for(const x of p)yield x;}if(rest)yield rest;})(); }
const localTransport: ProcessTransport = { spawn(argv,opts) { const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:{...process.env,...opts.env},detached:true,stdio:['ignore','pipe','pipe']}); return { stdout:lines(child.stdout!),stderr:lines(child.stderr!),exit:new Promise((r)=>child.once('exit',(code,signal)=>r({code,signal}))),signal:async(sig)=>{if(child.pid)process.kill(-child.pid,sig)} } satisfies ProcessHandle; } };
const driver = { startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => localTransport, copyIn: async () => undefined, copyOut: async () => Buffer.from(''), stop: async () => undefined };
const inputs: StartInput[] = [];
const recording = Object.assign(Object.create(fakeAdapter), { start(input: StartInput) { inputs.push(input); return fakeAdapter.start(input); } }) as AgentAdapter;

let store: ThreadComposerStore; let container = ''; let pool: pg.Pool; let es: EventStore; let runner: ThreadRunner; let api: Hono; let tracker: Server; const reports: any[] = [];
const call = async (method: string, path: string, body?: unknown, user = 'usr_me') => { const r = await api.request(`/api/v1${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: (r.status === 204 ? null : await r.json()) as any }; };
let n = 0;
async function thread(opts: { owner?: string; visibility?: string; title?: string } = {}) {
  const id = `thr_c${++n}`;
  await pool.query(`INSERT INTO threads (id,code,role,owner_id,title,status,engine,budget,spent,visibility) VALUES ($1,$2,'thread',$3,$4,'idle','{"adapter":"fake"}','{"maxUsd":null}','{"usd":0}',$5)`, [id, `FLO-C${n}`, opts.owner ?? 'usr_me', opts.title ?? `Thread ${n}`, opts.visibility ?? 'private']);
  return { id, code: `FLO-C${n}` };
}
const approval = async (threadId: string, kind: string, question: string, detail: unknown) => (await pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state,detail) VALUES ($1,$2,$3,$4,'[{"id":"done","label":"Done"}]',false,'open',$5) RETURNING id`, [`apr_${++n}`, threadId, kind, question, JSON.stringify(detail)])).rows[0].id as string;

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await sleep(250); } }
  await migrate(url); es = new EventStore(url); pool = es.pool;
  runner = new ThreadRunner({ store: es, driver: driver as never, adapters: new Map([['fake', recording]]) });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_me','me@x','admin'),('usr_bob','bob@x','member')`);
  tracker = createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { reports.push(JSON.parse(b)); res.writeHead(201).end('{}'); }); });
  await new Promise<void>((r) => tracker.listen(0, '127.0.0.1', r));
  process.env.FLOTILLA_FEEDBACK_URL = `http://127.0.0.1:${(tracker.address() as { port: number }).port}/issues`;
  api = new Hono(); api.use('*', async (c, next) => { c.set('userId' as never, c.req.header('x-user') as never); await next(); });
  api.onError((err, c) => (err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err))));
  store = new ThreadComposerStore(url, es);
  api.route('/api/v1', createRunnerQueueRoute(runner).app); api.route('/api/v1', createThreadComposerRoute(() => store).app);
}, 30_000);
afterAll(async () => { await runner.drain(); tracker?.close(); await store?.lifecycle.pool.end(); await pool?.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });

describe('thread composer', () => {
  it('CAPY-015: request cards say exactly what is needed, open env/desktop inline, and Dismiss can be undone', async () => {
    const t = await thread();
    const merge = await approval(t.id, 'merge', 'Merge?', { pr: { repo: 'flotilla-ai/flotilla', number: 8426 } });
    const env = await approval(t.id, 'environment', 'Need a key', { env: { name: 'STRIPE_KEY' } });
    await approval(t.id, 'machine', 'Desktop', { desktop: { url: 'http://127.0.0.1:6080/vnc.html' } });
    const cards = (await call('GET', `/threads/${t.id}/requests`)).json.items;
    expect(cards.map((c: any) => [c.title, c.inline])).toEqual([
      ['Waiting on you to merge flotilla-ai/flotilla#8426', null],
      ['Waiting on you to set STRIPE_KEY', { kind: 'env', name: 'STRIPE_KEY' }],
      ['Waiting on you to use the desktop', { kind: 'desktop', url: 'http://127.0.0.1:6080/vnc.html' }]
    ]);
    expect((await call('GET', `/threads/${t.id}/requests`, undefined, 'usr_bob')).status).toBe(404);
    expect((await call('POST', `/approvals/${merge}/dismiss`)).status).toBe(200);
    expect((await call('GET', `/threads/${t.id}/requests`)).json.items.map((c: any) => c.id)).not.toContain(merge);
    expect((await call('POST', `/approvals/${merge}/undo`, undefined, 'usr_bob')).status).toBe(404);
    expect((await call('POST', `/approvals/${merge}/undo`)).json).toMatchObject({ id: merge, state: 'open' });
    expect((await call('GET', `/threads/${t.id}/requests`)).json.items.map((c: any) => c.id)).toContain(merge);
    expect((await call('POST', `/approvals/${env}/undo`)).status).toBe(404);
    const updates = (await pool.query(`SELECT payload FROM events WHERE thread_id=$1 AND kind='approval.updated' ORDER BY seq`, [t.id])).rows.map((r) => r.payload.state);
    expect(updates).toEqual(['dismissed', 'open']);
  });

  it('CAPY-016: thread codes resolve for Cmd+K and @-mentions only within threads the viewer may see', async () => {
    const mine = await thread({ title: 'Fix login' }); const shared = await thread({ owner: 'usr_bob', visibility: 'shared', title: 'Shared work' }); const hidden = await thread({ owner: 'usr_bob', title: 'Private bob' });
    expect((await call('GET', `/thread-lookup?q=${mine.code.toLowerCase()}`)).json.items).toEqual([{ id: mine.id, code: mine.code, title: 'Fix login' }]);
    expect((await call('GET', `/thread-lookup?q=${shared.code}`)).json.items.map((x: any) => x.id)).toEqual([shared.id]);
    expect((await call('GET', `/thread-lookup?q=${hidden.code}`)).json.items).toEqual([]);
    expect((await call('GET', '/thread-lookup?q=login')).json.items.map((x: any) => x.code)).toEqual([mine.code]);
  });

  it('CAPY-034: reading place is stored per viewer and survives a closed turn', async () => {
    const t = await thread();
    expect((await call('GET', `/threads/${t.id}/reading-place`)).json).toEqual({ threadId: t.id, seq: null, offset: 0 });
    expect((await call('PUT', `/threads/${t.id}/reading-place`, { seq: 7, offset: 24 })).json).toEqual({ threadId: t.id, seq: 7, offset: 24 });
    await es.appendEvents(t.id as never, [{ runId: null, kind: 'run.ended', source: 'kernel', trust: 'trusted', payload: { state: 'completed' } }] as never);
    expect((await call('GET', `/threads/${t.id}/reading-place`)).json).toEqual({ threadId: t.id, seq: 7, offset: 24 });
    expect((await call('PUT', `/threads/${t.id}/reading-place`, { seq: 'x' })).status).toBe(400);
    expect((await call('GET', `/threads/${t.id}/reading-place`, undefined, 'usr_bob')).status).toBe(404);
  });

  it('CAPY-472: a feedback report waits for owner approval, can be edited, and only then goes to the owner tracker', async () => {
    const t = await thread();
    expect((await call('POST', `/threads/${t.id}/feedback`, { title: 'x', body: 'y' }, 'usr_bob')).status).toBe(404);
    const draft = (await call('POST', `/threads/${t.id}/feedback`, { title: 'Composer drops images', body: 'Steps: paste a PNG' })).json;
    expect(draft).toMatchObject({ title: 'Waiting on you to approve feedback: Composer drops images', inline: { kind: 'feedback', title: 'Composer drops images', body: 'Steps: paste a PNG' } });
    await sleep(100); expect(reports).toEqual([]);
    expect((await call('POST', `/approvals/${draft.id}/feedback`, { optionId: 'send' }, 'usr_bob')).status).toBe(404);
    expect((await call('POST', `/approvals/${draft.id}/feedback`, { optionId: 'send', body: 'Steps: paste a PNG, send' })).json).toMatchObject({ state: 'answered', sent: true });
    expect(reports).toEqual([{ title: 'Composer drops images', body: 'Steps: paste a PNG, send', threadId: t.id, threadCode: t.code }]);
    const other = (await call('POST', `/threads/${t.id}/feedback`, { title: 'Nope', body: 'n' })).json;
    expect((await call('POST', `/approvals/${other.id}/feedback`, { optionId: 'discard' })).json).toMatchObject({ state: 'answered', sent: false });
    expect(reports).toHaveLength(1);
  });

  it('CAPY-032: a thread without a project runs in a bare workspace with no repo checkout', async () => {
    const t = await runner.createThread({ ownerId: 'usr_me', projectId: null, title: 'Scratch', prompt: 'no repo here' });
    for (let i = 0; i < 80; i++) { const s = (await pool.query('SELECT status FROM threads WHERE id=$1', [t.id])).rows[0].status; if (s === 'waiting') break; await sleep(100); }
    expect((await pool.query('SELECT project_id,status,branch FROM threads WHERE id=$1', [t.id])).rows[0]).toEqual({ project_id: null, status: 'waiting', branch: null });
    expect(inputs.at(-1)).toMatchObject({ cwd: '/workspace' });
  });
});
