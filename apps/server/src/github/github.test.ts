import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitHubClient, checksState, errorSignature } from './client.js';
import { evaluateChecks, verifyWebhook } from './sync.js';
import { createGithubWebhookRoute } from '../routes/github-webhook.route.js';
import { CheckMonitor } from './monitor.js';
import { handleCheckRunWebhook } from './webhook.js';


const api = setupServer();
beforeAll(() => api.listen());
afterAll(() => api.close());
describe('github client and autofix wake logic', () => {
  it('opens or finds a PR without duplicating a raced create', async () => {
    let posts = 0;
    const pr = { number: 7, head: { ref: 'flotilla/FLO-1-x', sha: 'abc' }, base: { ref: 'main' }, html_url: 'https://example/pr/7' };
    api.use(http.get('https://api.github.com/repos/o/r/pulls', () => HttpResponse.json([pr])), http.post('https://api.github.com/repos/o/r/pulls', () => { posts++; return HttpResponse.json(pr); }));
    const gh = new GitHubClient('token');
    expect((await gh.openOrFindPr('o/r', 'flotilla/FLO-1-x', 'main', 't')).number).toBe(7);
    expect(posts).toBe(0);
  });
  it('classifies checks, truncates logs, and applies autofix loop guard', async () => {
    expect(checksState([{ status: 'queued', conclusion: null, name: 'x' }])).toBe('pending');
    expect(checksState([{ status: 'completed', conclusion: 'success', name: 'x' }])).toBe('green');
    const longLog = Array.from({ length: 250 }, (_, i) => `line${i}`).join('\n');
    const wake = evaluateChecks([{ status: 'completed', conclusion: 'failure', name: 'x' }], 'sha', [], longLog);
    expect(wake.kind).toBe('failed');
    if (wake.kind === 'failed') expect(wake.log.split('\n')).toHaveLength(200);
    const third=evaluateChecks([{ status: 'completed', conclusion: 'failure', name: 'x' }], 'sha', [{ attempt: 1, signature: 'a' }, { attempt: 2, signature: 'b' }], 'error c'); expect(third.kind==='failed' ? third.autofix : null).toEqual({stop:'cap'});
    expect(errorSignature('first\nerror in step 123\n')).toBe('error in step #');
  });
  it('verifies webhook HMAC and rejects bad signatures', async () => {
    const secret = 'whsec'; const body = JSON.stringify({ action: 'completed' });
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyWebhook(secret, body, sig)).toBe(true);
    expect(verifyWebhook(secret, body, 'sha256=bad')).toBe(false);
    let seen = 0; const app = new Hono().route('/api/v1/webhooks', createGithubWebhookRoute(secret, async () => { seen++; }).app);
    expect((await app.request('http://x/api/v1/webhooks/github', { method: 'POST', body })).status).toBe(401);
    expect((await app.request('http://x/api/v1/webhooks/github', { method: 'POST', body, headers: { 'x-hub-signature-256': sig } })).status).toBe(202);
    expect(seen).toBe(1);
  });
  it('wakes green once and stops repeated failing signatures', async () => {
    const events: unknown[] = []; const wakes: string[] = [];
    let checks = [{ status: 'completed', conclusion: 'success', name: 'check' }];
    const monitor = new CheckMonitor({
      pool: { query: async () => ({ rows: [] }) } as never,
      store: { appendEvents: async (_id: string, evs: unknown[]) => { events.push(...evs); } } as never,
      clientFor: () => ({ checkRuns: async () => checks, checkLog: async () => 'error same failure' }) as never,
      wake: async (_id: string, text: string) => { wakes.push(text); }
    });
    expect(await monitor.process('o/r', 1, 'thr_1', 'sha')).toBe('green');
    expect(await monitor.process('o/r', 1, 'thr_1', 'sha')).toBe('green');
    expect(wakes).toHaveLength(1);
    checks = [{ status: 'completed', conclusion: 'failure', name: 'check' }];
    expect(await monitor.process('o/r', 1, 'thr_1', 'sha')).toBe('failed');
    expect(await monitor.process('o/r', 1, 'thr_1', 'sha')).toBe('failed');
    expect(wakes).toHaveLength(2);
  });
  it('does not wake an archived thread, but does not consume green/autofix wakes', async () => {
    const wakes: string[] = []; const events: unknown[] = [];
    let archived: Date | null = new Date();
    let checks = [{ status: 'completed', conclusion: 'success', name: 'check' }];
    const monitor = new CheckMonitor({
      pool: { query: async () => ({ rows: [{ archived_at: archived }] }) } as never,
      store: { appendEvents: async (_id: string, evs: unknown[]) => { events.push(...evs); } } as never,
      clientFor: () => ({ checkRuns: async () => checks, checkLog: async () => 'error same failure' }) as never,
      wake: async (_id: string, text: string) => { wakes.push(text); }
    });
    expect(await monitor.process('o/r', 1, 'thr_archived', 'sha')).toBe('green');
    archived = null;
    expect(await monitor.process('o/r', 1, 'thr_archived', 'sha')).toBe('green');
    expect(wakes).toEqual(['CI passed for o/r#1']);
    expect(events).toHaveLength(1);

    archived = new Date(); checks = [{ status: 'completed', conclusion: 'failure', name: 'check' }];
    expect(await monitor.process('o/r', 1, 'thr_archived', 'sha')).toBe('failed');
    expect(monitor.attempts.get('o/r#1') ?? []).toEqual([]);
    archived = null;
    expect(await monitor.process('o/r', 1, 'thr_archived', 'sha')).toBe('failed');
    expect(monitor.attempts.get('o/r#1')).toHaveLength(1);
    expect(wakes.filter((w) => w.includes('Autofix attempt 1'))).toHaveLength(1);
    expect(events).toHaveLength(3);
  });

  it('re-checks archived state after fetching a failing check log', async () => {
    const wakes: string[] = []; let archived: Date | null = null;
    const monitor = new CheckMonitor({
      pool: { query: async () => ({ rows: [{ archived_at: archived }] }) } as never,
      store: { appendEvents: async () => undefined } as never,
      clientFor: () => ({ checkRuns: async () => [{ status: 'completed', conclusion: 'failure', name: 'check' }], checkLog: async () => { archived = new Date(); return 'error same failure'; } }) as never,
      wake: async (_id: string, text: string) => { wakes.push(text); }
    });
    expect(await monitor.process('o/r', 1, 'thr_race', 'sha')).toBe('failed');
    expect(wakes).toEqual([]);
    expect(monitor.attempts.get('o/r#1') ?? []).toEqual([]);
  });

  it('does not duplicate a green wake when webhook and poll processing overlap', async () => {
    const wakes: string[] = [];
    const monitor = new CheckMonitor({
      pool: { query: async () => ({ rows: [{ archived_at: null }] }) } as never,
      store: { appendEvents: async () => undefined } as never,
      clientFor: () => ({ checkRuns: async () => [{ status: 'completed', conclusion: 'success', name: 'check' }] }) as never,
      wake: async (_id: string, text: string) => { await new Promise((r) => setTimeout(r, 1)); wakes.push(text); }
    });
    await Promise.all([monitor.process('o/r', 1, 'thr_race', 'sha'), monitor.process('o/r', 1, 'thr_race', 'sha')]);
    expect(wakes).toEqual(['CI passed for o/r#1']);
  });
  it('routes check_run webhooks to the owning thread', async () => {
    const seen: string[] = [];
    const monitor = { deps: { pool: { query: async () => ({ rows: [{ thread_id: 'thr_owner' }] }) } }, process: async (_r: string, _n: number, thread: string) => { seen.push(thread); return 'green'; } };
    expect(await handleCheckRunWebhook(monitor as never, { repository: { full_name: 'o/r' }, check_run: { head_sha: 'sha', pull_requests: [{ number: 2 }] } })).toBe(true);
    expect(seen).toEqual(['thr_owner']);
  });

});
