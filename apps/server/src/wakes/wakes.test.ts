import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { Hono } from 'hono';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeAdapter } from '@flotilla/adapter-fake';
import { migrate } from '../db/migrate.js';
import { EventStore } from '../events/store.js';
import { ThreadRunner } from '../runner/runner.js';
import { createWakesRoute } from '../routes/wakes.route.js';
import { WakeRouter, rsyncArgv } from './router.js';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import type { BackgroundJobSpec, JobExecutor } from './types.js';

const exec = promisify(execFile);
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> { return (async function* () { let rest = ''; for await (const c of stream) { rest += c.toString(); const p = rest.split('\n'); rest = p.pop()!; for (const x of p) yield x; } if (rest) yield rest; })(); }
const localTransport: ProcessTransport = { spawn(argv, opts) { const child = spawn(argv[0], argv.slice(1), { cwd: process.cwd(), env: { ...process.env, ...opts.env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); return { stdout: lines(child.stdout!), stderr: lines(child.stderr!), exit: new Promise((r) => child.once('exit', (code, signal) => r({ code, signal }))), signal: async (sig) => { if (child.pid) process.kill(-child.pid, sig); } } satisfies ProcessHandle; } };
const driver = { startThreadContainer: async () => ({ containerId: 'fake' }), transport: () => localTransport, copyIn: async () => undefined, copyOut: async () => Buffer.from(''), stop: async () => undefined };
let container = ''; let pool: pg.Pool; let runner: ThreadRunner; let router: WakeRouter; let unlisten: () => Promise<void>;
const calls: { spec: BackgroundJobSpec; signal: AbortSignal }[] = [];
let release: (code: number) => void = () => undefined;
const executor: JobExecutor = (_t, spec, signal) => { calls.push({ spec, signal }); return new Promise((res) => { release = (code) => res({ code, output: 'built ok' }); signal.addEventListener('abort', () => res({ code: null, output: 'killed' })); }); };
const asUser = (u: string) => new Hono().use(async (c, next) => { c.set('userId' as never, u as never); await next(); }).onError((e, c) => c.json({ error: (e as Error).message }, (e as { kind?: string }).kind === 'Forbidden' ? 403 : 404)).route('/api/v1', createWakesRoute(router).app);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(sql: string, args: unknown[], n = 1) { for (let i = 0; i < 100; i++) { const r = await pool.query(sql, args); if (r.rows.length >= n) return r.rows; await sleep(100); } return (await pool.query(sql, args)).rows; }
const idle = (id: string) => waitFor(`SELECT 1 FROM runs WHERE thread_id=$1 AND state<>'running' AND state<>'starting' AND NOT EXISTS (SELECT 1 FROM runs r WHERE r.thread_id=$1 AND r.state IN ('running','starting'))`, [id]);
const messages = async (id: string) => (await pool.query(`SELECT payload->>'text' t FROM events WHERE thread_id=$1 AND kind='user.message' ORDER BY seq`, [id])).rows.map((r) => r.t as string);
const thread = async (title: string, owner = 'usr_a', parentId?: string) => { const t = await runner.createThread({ ownerId: owner, title, prompt: 'hello', parentId }); await idle(t.id as string); return t.id as string; };
const pr = (threadId: string, number: number) => pool.query(`INSERT INTO prs (thread_id,repo,number,head_branch) VALUES ($1,'acme/api',$2,'b')`, [threadId, number]);
const userSaid = async (threadId: string, daysAgo: number) => { const [e] = await runner.deps.store.appendEvents(threadId as never, [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: { text: 'hi' } }] as never); await pool.query(`UPDATE events SET at=now()-make_interval(days=>$2) WHERE id=$1`, [e.id, daysAgo]); };

beforeAll(async () => {
  container = (await exec('docker', ['run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16'])).stdout.trim();
  const port = (await exec('docker', ['port', container, '5432/tcp'])).stdout.trim().split(':').pop(); const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < 40; i++) { try { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.end(); break; } catch { await sleep(250); } }
  await migrate(url); const store = new EventStore(url); pool = store.pool;
  runner = new ThreadRunner({ store, driver: driver as never, adapters: new Map([['fake', fakeAdapter]]) });
  router = new WakeRouter({ runner, executor, usdPerSec: 1, tickMs: 20 }); unlisten = await router.listen(url);
  await pool.query(`INSERT INTO users (id,email,role) VALUES ('usr_a','a@x','admin'),('usr_b','b@x','member')`);
}, 60_000);
afterAll(async () => { await unlisten?.(); await runner?.drain(); await pool?.end(); if (container) await exec('docker', ['rm', '-f', container]).catch(() => undefined); });

describe('wake router', () => {
  it('CAPY-038: human reviews/comments wake the thread; bots are ignored unless allow-listed', async () => {
    const t = await thread('review'); await pr(t, 1);
    expect(await router.github('pull_request_review', { action: 'submitted', repository: { full_name: 'acme/api' }, pull_request: { number: 1 }, review: { state: 'changes_requested', body: 'rename it', user: { login: 'maria', type: 'User' } } })).toEqual({ threadId: t, outcome: 'woken' });
    expect((await messages(t)).at(-1)).toContain('Review (changes_requested) from @maria on acme/api#1');
    expect((await router.github('issue_comment', { action: 'created', repository: { full_name: 'acme/api' }, issue: { number: 1, pull_request: {} }, comment: { body: 'lgtm', user: { login: 'coderabbit[bot]', type: 'Bot' } } }))?.outcome).toBe('ignored');
    await router.putSettings('org', 'org', { bots: ['ci-helper'] });
    expect((await router.github('issue_comment', { action: 'created', repository: { full_name: 'acme/api' }, issue: { number: 1, pull_request: {} }, comment: { body: 'x', user: { login: 'ci-helper', type: 'User' } } }))?.outcome).toBe('ignored');
    await router.putSettings('user', 'usr_a', { allowBots: ['coderabbit[bot]'] }); await idle(t);
    expect((await router.github('pull_request_review_comment', { action: 'created', repository: { full_name: 'acme/api' }, pull_request: { number: 1 }, comment: { body: 'nit', user: { login: 'coderabbit[bot]', type: 'Bot' } } }))?.outcome).toBe('woken');
    await idle(t);
  }, 30_000);

  it('CAPY-039: merge/conflict wakes only when someone wrote in the thread within the window (default 3 days)', async () => {
    const t = await thread('merge'); await pr(t, 2);
    expect((await router.policy('usr_b')).mergeWindowDays).toBe(3);
    await pool.query(`UPDATE events SET at=now()-interval '10 days' WHERE thread_id=$1`, [t]);
    expect((await router.github('pull_request', { action: 'closed', repository: { full_name: 'acme/api' }, pull_request: { number: 2, merged: true } }))?.outcome).toBe('ignored');
    await userSaid(t, 2);
    expect((await router.github('pull_request', { action: 'synchronize', repository: { full_name: 'acme/api' }, pull_request: { number: 2, mergeable: false } }))?.outcome).toBe('woken');
    expect((await messages(t)).at(-1)).toBe('acme/api#2 has merge conflicts with its base branch.'); await idle(t);
    await router.putSettings('user', 'usr_a', { mergeWindowDays: 1 });
    expect((await router.github('pull_request', { action: 'closed', repository: { full_name: 'acme/api' }, pull_request: { number: 2, merged: true } }))?.outcome).toBe('ignored');
    await router.putSettings('user', 'usr_a', { mergeWindowDays: 3 });
  }, 30_000);

  it('CAPY-040: subagent completion and blocking wake the parent', async () => {
    const parent = await thread('parent'); const child = await thread('child', 'usr_a', parent);
    const rows = await waitFor(`SELECT payload->>'text' t FROM events WHERE thread_id=$1 AND kind='user.message' AND payload->>'text' LIKE 'Subagent%finished%'`, [parent]);
    expect(rows[0].t).toMatch(/^Subagent FLO-\w+ finished:/); await idle(parent);
    await runner.message(child, '/plan design it'); await waitFor(`SELECT 1 FROM approvals WHERE thread_id=$1 AND state='open'`, [child]);
    expect((await waitFor(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='user.message' AND payload->>'text' LIKE 'Subagent%is blocked%'`, [parent])).length).toBe(1);
    await idle(parent);
    const captain = await thread('captain'); await pool.query(`UPDATE threads SET role='captain' WHERE id=$1`, [captain]);
    await thread('crew', 'usr_a', captain); await sleep(300);
    expect((await messages(captain)).some((m) => m.startsWith('Subagent'))).toBe(false);
  }, 30_000);

  it('CAPY-041: timers up to 7 days fire from the DB sweep; capped threads never wake', async () => {
    const t = await thread('timer'); const now = new Date();
    expect(() => router.timer(t, 7 * 24 * 3600 + 1, 'too long')).toThrow(/7 days/);
    const w = await router.timer(t, 60, 'check deploy', now);
    expect(await router.sweep(new Date(now.getTime() + 30_000))).toEqual([]);
    expect(await router.sweep(new Date(now.getTime() + 61_000))).toEqual([w.id]);
    expect((await messages(t)).at(-1)).toBe('Timer fired: check deploy');
    const initialRuns = (await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [t])).rows[0].n;
    await waitFor('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [t], initialRuns + 1); await idle(t);
    await pool.query('UPDATE threads SET archived_at=now() WHERE id=$1', [t]); const runs = (await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [t])).rows[0].n;
    await router.timer(t, 1, 'dormant', now); await router.sweep(new Date(now.getTime() + 5_000)); await sleep(200);
    expect((await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [t])).rows[0].n).toBe(runs);
    const capped = await thread('capped'); await pool.query(`UPDATE threads SET budget=jsonb_set(budget,'{maxUsd}','5'), spent=jsonb_set(spent,'{usd}','5') WHERE id=$1`, [capped]);
    const before = (await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [capped])).rows[0].n;
    const cw = await router.timer(capped, 1, 'nope', now);
    expect(await router.sweep(new Date(now.getTime() + 5_000))).toEqual([]);
    expect((await pool.query('SELECT state FROM wake_watches WHERE id=$1', [cw.id])).rows[0].state).toBe('active');
    expect((await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [capped])).rows[0].n).toBe(before);
  }, 30_000);

  it('CAPY-043: per-event React / Keep as context / Ignore with org default and personal override', async () => {
    const t = await thread('policy'); await pr(t, 3);
    await router.putSettings('org', 'org', { responses: { comment: 'ignore' } });
    expect((await router.policy('usr_b')).responses.comment).toBe('ignore');
    await expect(router.putSettings('org', 'org', { responses: { comment: 'loud' as never } })).rejects.toThrow(/react, context or ignore/);
    const comment = { action: 'created', repository: { full_name: 'acme/api' }, issue: { number: 3, pull_request: {} }, comment: { body: 'fyi the API moved', user: { login: 'sam', type: 'User' } } };
    expect((await router.github('issue_comment', comment))?.outcome).toBe('ignored');
    await router.putSettings('user', 'usr_a', { responses: { comment: 'context' } });
    expect((await router.policy('usr_a')).responses).toMatchObject({ comment: 'context', review: 'react' });
    const n = (await messages(t)).length;
    expect((await router.github('issue_comment', comment))?.outcome).toBe('context');
    expect((await messages(t)).length).toBe(n);
    await router.github('pull_request_review', { action: 'submitted', repository: { full_name: 'acme/api' }, pull_request: { number: 3 }, review: { state: 'approved', body: 'ship', user: { login: 'sam', type: 'User' } } });
    expect((await messages(t)).at(-1)).toMatch(/^Context: Comment from @sam on acme\/api#3:\nfyi the API moved\nReview \(approved\)/);
    await router.putSettings('org', 'org', { responses: { comment: 'react' } }); await router.putSettings('user', 'usr_a', { responses: { comment: 'react' } }); await idle(t);
  }, 30_000);

  it('CAPY-044/045: waiting state names the event with a click-through; activity lists watches and Stop watching ends them', async () => {
    const t = await thread('wait');
    const w = await router.watchPr(t, 'acme/api', 212);
    expect(await router.waiting(t)).toMatchObject({ waiting: true, label: 'Waiting on api#212 checks', href: 'https://github.com/acme/api/pull/212/checks' });
    expect((await router.watches('usr_a')).map((x) => x.id)).toContain(w.id);
    expect((await router.watches('usr_b')).map((x) => x.id)).not.toContain(w.id);
    await expect(router.stop(w.id, 'usr_b')).rejects.toThrow(/not found/);
    await pr(t, 212); await router.github('issue_comment', { action: 'created', repository: { full_name: 'acme/api' }, issue: { number: 212, pull_request: {} }, comment: { body: 'hi', user: { login: 'sam', type: 'User' } } });
    expect((await router.waiting(t)).waiting).toBe(true); await idle(t);
    await router.checksDone({ action: 'completed', repository: { full_name: 'acme/api' }, check_run: { pull_requests: [{ number: 212 }] } });
    expect((await router.waiting(t)).waiting).toBe(false);
    const w2 = await router.watchPr(t, 'acme/api', 212); await router.stop(w2.id, 'usr_a');
    expect(await router.waiting(t)).toMatchObject({ waiting: false, label: null });
  });

  it('CAPY-046: background command defaults to 30 min, max 6 h, keeps the machine awake and wakes on exit or timeout', async () => {
    const t = await thread('job');
    await expect(router.startJob(t, { kind: 'command', argv: ['make'], timeoutSec: 6 * 3600 + 1 })).rejects.toThrow(/21600/);
    const w = await router.startJob(t, { kind: 'command', argv: ['make', 'build'] });
    expect(w.payload).toMatchObject({ timeoutSec: 1800, keepAwake: true });
    expect(await router.keepAwake(t)).toBe(true);
    release(0); await router.jobs.get(w.id);
    expect(await router.keepAwake(t)).toBe(false);
    expect((await messages(t)).at(-1)).toBe('Background command ended (exit 0):\nbuilt ok'); await idle(t);
    const slow = await router.startJob(t, { kind: 'command', argv: ['sleep', '99'], timeoutSec: 0.1 }); await router.jobs.get(slow.id);
    expect((await messages(t)).at(-1)).toMatch(/^Background command ended \(timeout\)/); await idle(t);
    const pricey = await router.startJob(t, { kind: 'command', argv: ['sleep', '99'], maxUsd: 0.05 }); await router.jobs.get(pricey.id);
    expect((await messages(t)).at(-1)).toMatch(/\(cap\)/); await idle(t);
  }, 30_000);

  it('CAPY-047: /plan writes a spec and stops for approval with no vendor plan mode', async () => {
    const t = await thread('plan'); await runner.message(t, '/plan add wakes');
    const a = await waitFor(`SELECT * FROM approvals WHERE thread_id=$1 AND state='open'`, [t]);
    expect(a[0].blocking).toBe(true); const runs = (await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [t])).rows[0].n;
    await router.timer(t, 1, ''); await router.sweep(new Date(Date.now() + 2000)); await sleep(300);
    expect((await pool.query('SELECT count(*)::int n FROM runs WHERE thread_id=$1', [t])).rows[0].n).toBe(runs);
  }, 30_000);

  it('CAPY-048: peek reads another thread history/status/PRs, searches and saves to a file without waking it', async () => {
    const t = await thread('peeked'); await pr(t, 48);
    const woke = async () => (await pool.query(`SELECT (SELECT count(*) FROM events WHERE thread_id=$1 AND kind IN ('user.message','run.started'))::int + (SELECT count(*) FROM thread_inbox WHERE thread_id=$1)::int n`, [t])).rows[0].n; const before = await woke();
    const p = await router.peek(t, 'usr_a', { q: 'hello', save: true });
    expect(p.thread.status).toBeTruthy(); expect(p.prs).toEqual([{ repo: 'acme/api', number: 48 }]); expect(p.history.every((h) => h.text.toLowerCase().includes('hello'))).toBe(true);
    expect((await pool.query('SELECT name, convert_from(data,\'UTF8\') d FROM api_files WHERE id=$1', [p.fileId])).rows[0].name).toMatch(/-history\.md$/);
    expect(await woke()).toBe(before);
    await expect(router.peek(t, 'usr_b')).rejects.toThrow(/not found/);
  });

  it('CAPY-049: cross-thread message arrives as a steer and the reply wakes the sender once', async () => {
    const a = await thread('sender'); const b = await thread('receiver');
    const r = await router.send(a, b, 'what port does the API use?', 'usr_a');
    expect(r.outcome).toBe('woken'); expect((await messages(b)).at(-1)).toMatch(/^Message from FLO-\w+:\nwhat port/);
    expect((await pool.query(`SELECT payload->>'mode' m FROM events WHERE thread_id=$1 AND kind='user.message' ORDER BY seq DESC LIMIT 1`, [b])).rows[0].m).toBe('steer');
    const rows = await waitFor(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='user.message' AND payload->>'text' LIKE 'Reply from%'`, [a]);
    expect(rows.length).toBe(1); await idle(a);
    expect((await pool.query('SELECT state FROM wake_watches WHERE id=$1', [r.watch.id])).rows[0].state).toBe('fired');
    const priv = await thread('private', 'usr_b'); await pool.query(`UPDATE threads SET visibility='shared' WHERE id=$1`, [priv]);
    await router.send(a, priv, 'secret?', 'usr_a'); await pool.query(`UPDATE threads SET visibility='private' WHERE id=$1`, [priv]); await idle(priv); await sleep(300);
    expect((await messages(a)).filter((m) => m.startsWith('Reply from')).length).toBe(1); await idle(a);
  }, 30_000);

  it('CAPY-050: messages to a held thread wait until the owner allows them', async () => {
    const mine = await thread('mine', 'usr_b'); const theirs = await thread('their', 'usr_a');
    expect(await (await asUser('usr_b').request(`/api/v1/threads/${mine}/hold`, { method: 'PUT', body: '{"hold":true}' })).json()).toEqual({ hold: true });
    await pool.query(`UPDATE threads SET visibility='shared' WHERE id=$1`, [mine]);
    const n = (await messages(mine)).length;
    expect((await router.deliver(mine, 'thread-message', 'please rebase', { userId: 'usr_a', threadId: theirs })).valueOf()).toBe('held');
    expect((await messages(mine)).length).toBe(n);
    const [item] = await router.held(mine); expect(item.text).toBe('please rebase');
    await expect(router.release(item.id, 'usr_a', true)).rejects.toThrow(/not found/);
    expect(await router.release(item.id, 'usr_b', true)).toEqual({ id: item.id, state: 'delivered' });
    expect((await messages(mine)).at(-1)).toBe('please rebase'); await idle(mine);
  }, 30_000);

  it('CAPY-051: background transfer runs rsync over ssh through the job executor', async () => {
    const t = await thread('xfer'); calls.length = 0;
    const w = await router.startJob(t, { kind: 'transfer', argv: rsyncArgv('/workspace/out/', 'me@laptop:~/out/') });
    expect(calls[0].spec.argv).toEqual(['rsync', '-a', '--partial', '-e', 'ssh -o BatchMode=yes', '/workspace/out/', 'me@laptop:~/out/']);
    release(0); await router.jobs.get(w.id); expect((await messages(t)).at(-1)).toMatch(/^Background transfer ended \(exit 0\)/); await idle(t);
  }, 30_000);

  it('routes: owner-only waiting, admin-only org settings, personal settings', async () => {
    const t = await thread('route'); const as = asUser;
    expect((await as('usr_a').request(`/api/v1/threads/${t}/waiting`)).status).toBe(200);
    expect((await as('usr_b').request(`/api/v1/threads/${t}/waiting`)).status).toBe(404);
    expect((await as('usr_b').request('/api/v1/wake-settings/org', { method: 'PUT', body: '{"mergeWindowDays":5}' })).status).toBe(403);
    expect((await as('usr_b').request('/api/v1/wake-settings/me', { method: 'PUT', body: '{"mergeWindowDays":5}' })).status).toBe(200);
    expect(await (await as('usr_b').request('/api/v1/wake-settings/me/effective')).json()).toMatchObject({ mergeWindowDays: 5 });
  });
});
