import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { fakeAdapter } from '@flotilla/adapter-fake';
import type { AdapterCapabilities, AdapterEvent, AgentAdapter, ProcessHandle, ProcessTransport, StartInput } from '@flotilla/core/types';
import { onAfterRun, ThreadRunner } from './runner.js';
import { PLAN_PROMPT } from './runner-queue.js';
import { createRunnerQueueRoute } from '../routes/runner-queue.route.js';
import { ApiFailure, apiError } from '../api-platform/types.js';

const exec = promisify(execFile);
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function*(){let rest='';for await(const c of stream){rest+=c.toString();const p=rest.split('\n');rest=p.pop()!;for(const x of p)yield x;}if(rest)yield rest;})(); }
const localTransport: ProcessTransport = { spawn(argv,opts) { const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:{...process.env,...opts.env},detached:true,stdio:['ignore','pipe','pipe']}); return { stdout:lines(child.stdout!),stderr:lines(child.stderr!),exit:new Promise((r)=>child.once('exit',(code,signal)=>r({code,signal}))),signal:async(sig)=>{if(child.pid)process.kill(-child.pid,sig)} } satisfies ProcessHandle; } };
const copied: string[] = [];
const driver = { startThreadContainer: async()=>({containerId:'fake'}), transport:()=>localTransport, copyIn:async(_id: string, dir: string, tar: Buffer)=>{ copied.push(`${dir}/${tar.subarray(0, 100).toString().replace(/\0.*$/s, '')}`); }, copyOut:async()=>Buffer.from(''), stop:async()=>undefined };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Scripted fixture adapter: every start is recorded; `hold` runs wait until steered, cancelled or released. */
function scripted(caps: Partial<AdapterCapabilities & { compaction: boolean }>, events: (n: number, input: StartInput) => AdapterEvent[], hold = false) {
  const a = {
    starts: [] as string[], inputs: [] as StartInput[], steered: [] as string[], release: () => {},
    manifest: { ...fakeAdapter.manifest, capabilities: { ...fakeAdapter.manifest.capabilities, ...caps } },
    probe: fakeAdapter.probe.bind(fakeAdapter),
    start(input: StartInput): AsyncIterable<AdapterEvent> {
      a.starts.push(input.prompt); a.inputs.push(input); const n = a.starts.length;
      return (async function*() { yield { t: 'session', adapterSessionId: `s${n}` } as AdapterEvent; for (const e of events(n, input)) yield e; if (hold) await new Promise<void>((r) => { a.release = r; }); yield { t: 'done', stopReason: 'end_turn' } as AdapterEvent; })();
    },
    resume(input: StartInput) { return a.start(input); },
    async cancel() { a.release(); },
    ...(caps.steerMidTurn ? { async steer(_s: string, text: string) { a.steered.push(text); a.release(); return 'delivered' as const; } } : {})
  };
  return a as typeof a & AgentAdapter;
}
const steerer = scripted({ steerMidTurn: true }, () => [], true);
const holder = scripted({}, () => [], true);
const flaky = scripted({}, (n) => n === 1 ? [{ t: 'done', stopReason: 'error', error: 'API overloaded (529)' }] : [{ t: 'text', delta: 'ok' }]);
const coder = scripted({ compaction: true }, () => [{ t: 'tool_call', id: 'c1', name: 'codemode', input: { program: 'read()' } }, { t: 'tool_call', id: 'c2', name: 'read_file', input: { path: 'a' }, parentId: 'c1' } as AdapterEvent, { t: 'tool_result', id: 'c2', ok: true, output: 'x', parentId: 'c1' } as AdapterEvent, { t: 'usage', inputTokens: 1200, outputTokens: 300, cumulative: true }], true);
const plain = scripted({}, () => []);
const adapters = new Map<string, AgentAdapter>([['fake', fakeAdapter], ['plain', plain], ['steerer', steerer], ['holder', holder], ['flaky', flaky], ['coder', coder]]);
const engine = (adapter: string) => ({ adapter, model: null, effort: null, connectionId: null }) as never;

let container = ''; let url = ''; let pool: pg.Pool; let runner: ThreadRunner; let api: Hono;
const call = async (method: string, path: string, body?: unknown, user = 'usr_q') => { const r = await api.request(`/api/v1${path}`, { method, headers: { 'content-type': 'application/json', 'x-user': user }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: (r.status === 204 ? null : await r.json()) as any }; };
beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await sleep(250); } }
  await migrate(url); const store = new EventStore(url); pool = store.pool; runner = new ThreadRunner({ store, driver: driver as never, adapters, resolveEngine: async (_u, e) => { if (e.connectionId === 'con_other') throw new ApiFailure('NotFound', 'connection not found'); return { adapter: e.adapter as string, model: (e.model as string | null) ?? null, effort: e.effort ?? null, connectionId: (e.connectionId as string | null) ?? null }; } });
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_q','q@x','admin'),('usr_o','o@x','member')`);
  api = new Hono(); api.use('*', async (c, next) => { c.set('userId' as never, c.req.header('x-user') as never); await next(); }); api.onError((err, c) => (err instanceof ApiFailure ? apiError(c, err.kind, err.message) : apiError(c, 'Internal', String(err)))); api.route('/api/v1', createRunnerQueueRoute(runner).app);
}, 30_000);
afterAll(async () => { for (const a of [steerer, holder, coder]) a.release(); await runner.drain(); await pool.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });
async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> { let v = await fn(); for (let i = 0; i < 80 && !ok(v); i++) { await sleep(100); v = await fn(); } return v; }
const live = (id: string) => until(async () => runner.running.has(id), Boolean);
const runs = (id: string) => pool.query('SELECT state,ended_at,error FROM runs WHERE thread_id=$1 ORDER BY ordinal', [id]).then((r) => r.rows);
const kinds = (id: string, kind: string) => pool.query('SELECT payload FROM events WHERE thread_id=$1 AND kind=$2 ORDER BY seq', [id, kind]).then((r) => r.rows.map((x) => x.payload));
const make = (adapter: string, prompt = 'go', maxUsd: number | null = null) => runner.createThread({ ownerId: 'usr_q', title: adapter, prompt, engine: engine(adapter), maxUsd }) as Promise<{ id: string }>;

describe('runner queue', () => {
  it('CAPY-004: steer reaches a steer-capable agent mid-turn; without the capability it falls back to the queue', async () => {
    const t = await make('steerer'); await live(t.id); await sleep(100);
    const steered = await call('POST', `/threads/${t.id}/inbox`, { text: 'nudge', mode: 'steer' });
    expect(steered.status).toBe(202); expect(steered.json.item.state).toBe('delivered'); expect(steerer.steered).toEqual(['nudge']);
    const h = await make('holder'); await live(h.id); await sleep(100);
    const queued = await call('POST', `/threads/${h.id}/inbox`, { text: 'later', mode: 'steer' });
    expect(queued.json.item.state).toBe('pending');
    holder.release(); await until(async () => holder.starts, (s) => s.includes('later'));
    expect(holder.starts.slice(-1)).toEqual(['later']); holder.release();
  }, 20_000);

  it('CAPY-009/468/603/604: queued messages fold behind a count, can be edited, discarded back to the composer, or sent now', async () => {
    const t = await make('holder'); await live(t.id); await sleep(100);
    const ids: string[] = [];
    for (const text of ['a', 'b', 'c']) ids.push((await call('POST', `/threads/${t.id}/inbox`, { text })).json.item.id);
    const view = await call('GET', `/threads/${t.id}/inbox`);
    expect(view.json.queuedCount).toBe(3); expect(view.json.folded).toBe(true);
    expect((await call('PATCH', `/threads/${t.id}/inbox/${ids[0]}`, { text: 'a2' })).json.item.text).toBe('a2');
    const discarded = await call('DELETE', `/threads/${t.id}/inbox/${ids[1]}`);
    expect(discarded.json.item).toMatchObject({ state: 'cancelled', text: 'b' });
    expect((await call('GET', `/threads/${t.id}/inbox`, undefined, 'usr_o')).status).toBe(404);
    const before = holder.starts.length;
    expect((await call('POST', `/threads/${t.id}/inbox/${ids[2]}/send`)).status).toBe(202);
    await until(async () => holder.starts.length, (n) => n > before); expect(holder.starts[before]).toBe('c');
    holder.release(); await until(async () => holder.starts.length, (n) => n > before + 1); expect(holder.starts[before + 1]).toBe('a2');
    expect((await call('PATCH', `/threads/${t.id}/inbox/${ids[2]}`, { text: 'late' })).status).toBe(409);
    holder.release(); await runner.stop(t.id);
  }, 20_000);

  it('CAPY-010/601: editing a sent message creates a new version the thread continues from', async () => {
    const t = await make('fake', 'first'); await until(() => runs(t.id), (r) => r[0]?.state === 'completed');
    const sent = (await pool.query('SELECT id FROM thread_inbox WHERE thread_id=$1', [t.id])).rows[0].id as string;
    const v2 = await call('POST', `/threads/${t.id}/inbox/${sent}/versions`, { text: 'first, edited' });
    expect(v2.status).toBe(201); expect(v2.json.item).toMatchObject({ rootId: sent, version: 2 });
    await until(() => runs(t.id), (r) => r.length === 2 && r[1].state === 'completed');
    const versions = await call('GET', `/threads/${t.id}/inbox/${sent}/versions`);
    expect(versions.json.items.map((v: { version: number; text: string; state: string }) => [v.version, v.text, v.state])).toEqual([[1, 'first', 'delivered'], [2, 'first, edited', 'delivered']]);
    expect((await kinds(t.id, 'user.message')).at(-1)).toMatchObject({ text: 'first, edited', version: 2, fork: 'new-session' });
  }, 20_000);

  it('CAPY-465: /plan explores first, holds changes and further messages until the plan is approved', async () => {
    const hooked: string[] = []; const off = onAfterRun(async ({ thread }) => { hooked.push(thread.id as string); });
    const t = await make('holder', '/plan add a cache'); await live(t.id);
    expect(holder.starts.at(-1)).toBe(`${PLAN_PROMPT}add a cache`); holder.release();
    const [gate] = await until(() => pool.query(`SELECT * FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`, [t.id]).then((r) => r.rows), (r) => r.length > 0);
    expect(hooked).not.toContain(t.id);
    expect((await pool.query('SELECT status,plan_mode FROM threads WHERE id=$1', [t.id])).rows[0]).toEqual({ status: 'paused', plan_mode: true });
    await call('POST', `/threads/${t.id}/inbox`, { text: 'also docs' }); await sleep(300);
    expect(runner.running.has(t.id)).toBe(false);
    await pool.query(`INSERT INTO api_files (id,owner_id,name,content_type,size,upload_token_hash,upload_expires_at,uploaded_at,data) VALUES ('fil_plan','usr_q','p.md','text/plain',1,'h',now()+interval '1 hour',now(),'\\x00')`);
    await pool.query(`UPDATE thread_inbox SET attachments='["fil_plan"]' WHERE thread_id=$1 AND plan`, [t.id]);
    const n = holder.starts.length; await runner.answerApproval(gate.id, 'approve', undefined, 'usr_q');
    expect((await pool.query(`SELECT attachments FROM thread_inbox WHERE thread_id=$1 AND text LIKE 'Plan approved%'`, [t.id])).rows[0].attachments).toEqual(['fil_plan']);
    await until(async () => holder.starts.length, (x) => x > n);
    expect(holder.starts[n]).toMatch(/^Plan approved/); expect(holder.starts[n]).toContain('Request:\nadd a cache'); holder.release();
    await until(async () => holder.starts.length, (x) => x > n + 1); expect(holder.starts[n + 1]).toBe('also docs'); holder.release();
    await until(async () => hooked.includes(t.id), Boolean); off(); await runner.stop(t.id);
  }, 20_000);

  it('CAPY-466: /btw opens a side thread', async () => {
    const t = await make('fake');
    const r = await call('POST', `/threads/${t.id}/inbox`, { text: '/btw what is FLO?' });
    expect(r.json.sideThreadId).toMatch(/^thr_/);
    expect((await pool.query('SELECT parent_id,title FROM threads WHERE id=$1', [r.json.sideThreadId])).rows[0]).toEqual({ parent_id: t.id, title: 'btw: what is FLO?' });
    expect(await kinds(t.id, 'thread.side')).toEqual([{ threadId: r.json.sideThreadId }]);
  }, 20_000);

  it('CAPY-467: a message sent while its file uploads waits durably and goes out after upload, even after a restart', async () => {
    const t = await make('plain'); await until(() => runs(t.id), (r) => r[0]?.state === 'completed');
    await pool.query(`INSERT INTO api_files (id,owner_id,name,content_type,size,upload_token_hash,upload_expires_at) VALUES ('fil_up','usr_q','a.png','image/png',1,'h',now()+interval '1 hour'),('fil_o','usr_o','b.png','image/png',1,'h',now()+interval '1 hour')`);
    expect((await call('POST', `/threads/${t.id}/inbox`, { text: 'see file', attachments: ['fil_o'] })).status).toBe(400);
    const long = `${'x'.repeat(120)}.txt`;
    await pool.query(`INSERT INTO api_files (id,owner_id,name,content_type,size,upload_token_hash,upload_expires_at,uploaded_at,data) VALUES ('fil_long','usr_q',$1,'text/plain',1,'h',now()+interval '1 hour',now(),'\\x00')`, [long]);
    const r = await call('POST', `/threads/${t.id}/inbox`, { text: 'see file', attachments: ['fil_up', 'fil_long'] });
    expect(r.json.item.state).toBe('waiting_upload'); await sleep(300); expect((await runs(t.id)).length).toBe(1);
    await pool.query(`UPDATE api_files SET uploaded_at=now(), data='\\x00' WHERE id='fil_up'`);
    const restarted = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters });
    await restarted.resumePending();
    await until(() => runs(t.id), (x) => x.length === 2 && x[1].state === 'completed');
    expect((await pool.query('SELECT state FROM thread_inbox WHERE id=$1', [r.json.item.id])).rows[0].state).toBe('delivered');
    expect(copied).toContain('/run/flotilla/attachments/fil_up-a.png');
    const sent = plain.inputs.at(-1)!.attachments as string[];
    expect(sent[0]).toBe('/run/flotilla/attachments/fil_up-a.png'); expect(sent[1]).toMatch(/^\/run\/flotilla\/attachments\/fil_long-x+\.txt$/);
    expect(sent.every((p) => copied.includes(p) && p.length - '/run/'.length <= 100)).toBe(true); expect(plain.starts.at(-1)).toContain('Attached files:\n- /run/flotilla/attachments/fil_up-a.png');
    await restarted.drain(); await restarted.pool.end();
  }, 20_000);

  it('CAPY-469: a provider error is classified and Retry re-sends the last message, optionally on another model', async () => {
    const t = await make('flaky', 'do it'); const [failed] = await until(() => runs(t.id), (r) => r[0]?.state === 'failed');
    expect(failed.error).toMatchObject({ kind: 'overloaded', retryable: true });
    expect((await kinds(t.id, 'run.ended'))[0].error.kind).toBe('overloaded');
    await pool.query(`UPDATE threads SET engine=engine || '{"effort":"high"}' WHERE id=$1`, [t.id]);
    expect((await call('POST', `/threads/${t.id}/retry`, { connectionId: 'con_other' })).status).toBe(404);
    const r = await call('POST', `/threads/${t.id}/retry`, { model: 'other-model', connectionId: 'con_own' });
    expect(r.status).toBe(202);
    await until(() => runs(t.id), (x) => x[1]?.state === 'completed');
    expect(flaky.starts).toEqual(['do it', 'do it']); expect(flaky.inputs.map((i) => i.model)).toEqual([null, 'other-model']);
    expect((await pool.query('SELECT engine FROM threads WHERE id=$1', [t.id])).rows[0].engine).toMatchObject({ model: 'other-model', connectionId: 'con_own', effort: null });
    await pool.query(`UPDATE threads SET engine=engine || '{"effort":"high"}' WHERE id=$1`, [t.id]); await pool.query(`UPDATE runs SET state='failed' WHERE thread_id=$1 AND ordinal=2`, [t.id]);
    expect((await call('POST', `/threads/${t.id}/retry`, { model: 'other-model', connectionId: 'con_two' })).status).toBe(202);
    await until(() => runs(t.id), (x) => x[2]?.state === 'completed');
    expect((await pool.query('SELECT engine FROM threads WHERE id=$1', [t.id])).rows[0].engine).toMatchObject({ model: 'other-model', connectionId: 'con_two', effort: 'high' });
    expect((await call('POST', `/threads/${t.id}/retry`, {})).status).toBe(409);
  }, 20_000);

  it('CAPY-470: request cards support Later and Dismiss server-side; a Captain dismisses all crew questions', async () => {
    const cap = await make('fake'); const crew = await make('fake');
    await pool.query('UPDATE threads SET crew_of=$1 WHERE id=$2', [cap.id, crew.id]);
    await pool.query(`INSERT INTO approvals (id,thread_id,captain_id,kind,question,options,blocking,state) VALUES ('apr_1',$1,$2,'conversation','q1','[]',false,'open'),('apr_2',$1,$2,'decision','q2','[]',false,'open'),('apr_3',$1,$2,'decision','q3','[]',false,'open')`, [crew.id, cap.id]);
    const later = await call('POST', '/approvals/apr_1/later', { minutes: 30 });
    expect(later.json.state).toBe('open'); expect(Date.parse(later.json.snoozedUntil)).toBeGreaterThan(Date.now() + 29 * 60_000);
    expect((await call('POST', '/approvals/apr_2/dismiss', undefined, 'usr_o')).status).toBe(404);
    expect((await call('POST', '/approvals/apr_2/dismiss')).json.state).toBe('dismissed');
    expect((await call('POST', `/captains/${cap.id}/approvals/dismiss`)).json.dismissed).toBe(2);
    expect((await pool.query(`SELECT count(*)::int n FROM approvals WHERE captain_id=$1 AND state='open'`, [cap.id])).rows[0].n).toBe(0);
    expect((await kinds(crew.id, 'approval.updated')).length).toBe(4);
  }, 20_000);

  it('CAPY-476/026: codemode inner tool calls stream live with their parent; the context meter and Compact at follow adapter capability', async () => {
    const t = await make('coder'); await until(() => kinds(t.id, 'agent.tool_result'), (r) => r.length > 0);
    expect(runner.running.has(t.id)).toBe(true);
    expect((await kinds(t.id, 'agent.tool_call')).map((e) => [e.id, e.parentId ?? null])).toEqual([['c1', null], ['c2', 'c1']]);
    expect((await kinds(t.id, 'agent.tool_result'))[0]).toMatchObject({ id: 'c2', parentId: 'c1' });
    coder.release(); await until(() => runs(t.id), (r) => r[0]?.state === 'completed');
    expect((await call('GET', `/threads/${t.id}/context`)).json).toEqual({ usedTokens: 1500, compactAt: 0.8, compactSupported: true });
    expect((await call('PATCH', `/threads/${t.id}/context`, { compactAt: 0.6 })).json.compactAt).toBe(0.6);
    const f = await make('fake');
    expect((await call('GET', `/threads/${f.id}/context`)).json).toMatchObject({ compactSupported: false, compactAt: 0.8 });
    expect((await call('PATCH', `/threads/${f.id}/context`, { compactAt: 0.6 })).status).toBe(409);
  }, 20_000);

  it('a run started over the cap ends as paused_budget instead of staying starting', async () => {
    const t = await make('fake', 'go', 1000); await until(() => pool.query(`SELECT 1 FROM approvals WHERE thread_id=$1 AND kind='budget'`, [t.id]).then((r) => r.rows), (r) => r.length > 0);
    await until(async () => runner.running.has(t.id), (v) => !v);
    await runner.message(t.id, 'more', 'queue', 'usr_q');
    const r = await until(() => runs(t.id), (x) => x.length === 2 && x[1].state !== 'starting');
    expect(r[1].state).toBe('paused_budget'); expect(r[1].ended_at).not.toBeNull();
  }, 20_000);

  it('/btw from a Captain or kernel message is plain text, not a new side thread', async () => {
    const t = await make('plain'); await until(() => runs(t.id), (r) => r[0]?.state === 'completed');
    expect((await runner.message(t.id, '/btw spawn more', 'queue')).sideThreadId).toBeUndefined();
    expect((await pool.query('SELECT 1 FROM threads WHERE parent_id=$1', [t.id])).rows).toHaveLength(0);
    await until(() => runs(t.id), (x) => x[1]?.state === 'completed'); expect(plain.starts.at(-1)).toBe('/btw spawn more');
  }, 20_000);

  it('a message claimed by a run that died with its process is re-queued on startup', async () => {
    for (const a of [steerer, holder, coder]) a.release(); await runner.drain();
    const t = await make('plain'); await until(() => runs(t.id), (r) => r[0]?.state === 'completed');
    await pool.query(`INSERT INTO runs (id,thread_id,ordinal,trigger,state,usage) VALUES ('run_dead',$1,99,'{}','running','{}')`, [t.id]);
    const { item } = await runner.message(t.id, 'lost?', 'queue', 'usr_q'); await runner.drain();
    await pool.query(`UPDATE runs SET ended_at=NULL WHERE id='run_dead'`); await pool.query(`UPDATE thread_inbox SET state='delivered',run_id='run_dead' WHERE id=$1`, [item!.id]);
    const restarted = new ThreadRunner({ store: new EventStore(url), driver: driver as never, adapters });
    await restarted.recoverClaimed(); await restarted.drain();
    expect((await pool.query(`SELECT state,ended_at FROM runs WHERE id='run_dead'`)).rows[0]).toMatchObject({ state: 'failed', ended_at: expect.any(Date) });
    expect((await pool.query('SELECT state,run_id FROM thread_inbox WHERE id=$1', [item!.id])).rows[0].run_id).not.toBe('run_dead');
    expect(plain.starts.filter((p) => p === 'lost?').length).toBe(2);
    await restarted.pool.end();
  }, 20_000);
});
