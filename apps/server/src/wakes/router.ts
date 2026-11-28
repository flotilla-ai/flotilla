import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { ApiFailure } from '../api-platform/types.js';
import type { ThreadRunner } from '../runner/runner.js';
import { canViewThread } from '../thread-api/access.js';
import { DEFAULT_POLICY, JOB_DEFAULT_SEC, JOB_MAX_SEC, TIMER_MAX_SEC, WAKE_KINDS, type BackgroundJobSpec, type EventResponsePolicy, type JobExecutor, type ThreadPeek, type WaitState, type WakeEventKind, type WakeFrom, type WakeOutcome, type WakeSettingsPatch, type WakeSubscription } from './types.js';

type Row = Record<string, any>;
type GhUser = { login?: string; type?: string };
const id = (p: string) => `${p}_${randomBytes(10).toString('base64url')}`;
const sub = (r: Row): WakeSubscription => ({ id: r.id, threadId: r.thread_id, kind: r.kind, target: r.target, label: r.label, url: r.url, fireAt: r.fire_at?.toISOString() ?? null, state: r.state, payload: r.payload, createdAt: r.created_at.toISOString() });
const text = (p: Row | null) => String(p?.text ?? p?.delta ?? '');

export type WakeRouterDeps = { runner: ThreadRunner; executor?: JobExecutor; usdPerSec?: number; tickMs?: number };

/** Decides whether an outside event starts a turn, waits as context, is held for the owner, or is dropped. */
export class WakeRouter {
  readonly jobs = new Map<string, Promise<void>>();
  constructor(readonly deps: WakeRouterDeps) {}
  get pool(): pg.Pool { return this.deps.runner.pool; }
  private async q(sql: string, args: unknown[] = []): Promise<Row[]> { return (await this.pool.query(sql, args)).rows; }
  private async thread(threadId: string): Promise<Row> { const t = (await this.q('SELECT * FROM threads WHERE id=$1', [threadId]))[0]; if (!t) throw new ApiFailure('NotFound', 'thread not found'); return t; }

  async settings(scope: 'org' | 'user', scopeId: string): Promise<WakeSettingsPatch> {
    const r = (await this.q('SELECT * FROM wake_settings WHERE scope=$1 AND scope_id=$2', [scope, scopeId]))[0];
    return { responses: r?.responses ?? {}, ...(r?.bots ? { bots: r.bots } : {}), ...(r?.allow_bots ? { allowBots: r.allow_bots } : {}), ...(r?.merge_window_days != null ? { mergeWindowDays: r.merge_window_days } : {}) };
  }
  async putSettings(scope: 'org' | 'user', scopeId: string, b: WakeSettingsPatch): Promise<WakeSettingsPatch> {
    const responses = b.responses ?? {};
    if (Object.entries(responses).some(([k, v]) => !WAKE_KINDS.includes(k as WakeEventKind) || !['react', 'context', 'ignore'].includes(v as string))) throw new ApiFailure('ValidationFailed', 'responses map event kinds to react, context or ignore');
    for (const list of [b.bots, b.allowBots]) if (list !== undefined && (!Array.isArray(list) || list.some((x) => typeof x !== 'string'))) throw new ApiFailure('ValidationFailed', 'bot lists are logins');
    if (b.mergeWindowDays !== undefined && !(Number.isInteger(b.mergeWindowDays) && b.mergeWindowDays >= 0 && b.mergeWindowDays <= 365)) throw new ApiFailure('ValidationFailed', 'mergeWindowDays must be 0..365');
    if (b.replaceResponses) await this.q(`INSERT INTO wake_settings (scope,scope_id,responses,bots,allow_bots,merge_window_days) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (scope,scope_id) DO UPDATE SET responses=$3, bots=COALESCE($4,wake_settings.bots), allow_bots=COALESCE($5,wake_settings.allow_bots), merge_window_days=COALESCE($6,wake_settings.merge_window_days)`,
    [scope, scopeId, JSON.stringify(responses), b.bots ? JSON.stringify(b.bots) : null, b.allowBots ? JSON.stringify(b.allowBots) : null, b.mergeWindowDays ?? null]);
    else await this.q(`INSERT INTO wake_settings (scope,scope_id,responses,bots,allow_bots,merge_window_days) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (scope,scope_id) DO UPDATE SET responses=wake_settings.responses||$3, bots=COALESCE($4,wake_settings.bots), allow_bots=COALESCE($5,wake_settings.allow_bots), merge_window_days=COALESCE($6,wake_settings.merge_window_days)`,
    [scope, scopeId, JSON.stringify(responses), b.bots ? JSON.stringify(b.bots) : null, b.allowBots ? JSON.stringify(b.allowBots) : null, b.mergeWindowDays ?? null]);
    return this.settings(scope, scopeId);
  }
  /** Defaults, then org, then the user's own settings, field by field. */
  async policy(userId: string): Promise<EventResponsePolicy> {
    const [org, me] = await Promise.all([this.settings('org', 'org'), this.settings('user', userId)]);
    return { ...DEFAULT_POLICY, ...org, ...me, responses: { ...DEFAULT_POLICY.responses, ...org.responses, ...me.responses } } as EventResponsePolicy;
  }
  private async capped(t: Row): Promise<boolean> {
    const max = t.budget?.maxUsd as number | null;
    if (max != null && (t.spent?.usd ?? 0) >= max) return true;
    return (await this.q(`SELECT 1 FROM approvals WHERE thread_id=$1 AND kind='budget' AND state='open'`, [t.id])).length > 0;
  }

  async deliver(threadId: string, kind: WakeEventKind, body: string, from: WakeFrom, mode: 'queue' | 'steer' = 'queue'): Promise<WakeOutcome> {
    const t = await this.thread(threadId);
    const response = (await this.policy(t.owner_id)).responses[kind];
    if (response === 'ignore') return 'ignored';
    const row = (state: string) => this.q('INSERT INTO wake_inbox (id,thread_id,kind,text,from_user,from_thread,state) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id('wak'), threadId, kind, body, from.userId, from.threadId ?? null, state]);
    if (t.hold_incoming && from.userId !== t.owner_id) {
      await row('held');
      await this.deps.runner.deps.store.appendEvents(threadId as never, [{ runId: null, kind: 'wake.held', source: 'kernel', trust: 'trusted', payload: { kind, fromThread: from.threadId ?? null } }] as never);
      return 'held';
    }
    if (response === 'context' || (t.archived_at && from.userId !== t.owner_id)) { await row('context'); return 'context'; }
    if (kind === 'timer' && await this.capped(t)) return 'capped';
    const ctx = await this.q(`UPDATE wake_inbox SET state='delivered' WHERE thread_id=$1 AND state='context' RETURNING text, created_at`, [threadId]);
    const prefix = ctx.sort((a, b) => a.created_at - b.created_at).map((c) => `Context: ${c.text}\n`).join('');
    await this.deps.runner.message(threadId, `${prefix}${body}`, mode);
    return 'woken';
  }

  /** GitHub review / comment / merge / conflict webhooks for a PR a thread owns. */
  async github(event: string, b: Row): Promise<{ threadId: string; outcome: WakeOutcome } | null> {
    const repo = b.repository?.full_name as string | undefined; const pr = b.pull_request ?? (b.issue?.pull_request ? b.issue : null);
    if (!repo || !pr?.number) return null;
    const owner = (await this.q('SELECT thread_id FROM prs WHERE repo=$1 AND number=$2', [repo, pr.number]))[0]?.thread_id as string | undefined;
    if (!owner) return null;
    const t = await this.thread(owner); const p = await this.policy(t.owner_id); const ref = `${repo}#${pr.number}`;
    const human = (u: GhUser | undefined) => !!u?.login && (p.allowBots.includes(u.login) || !(u.type === 'Bot' || u.login.endsWith('[bot]') || p.bots.includes(u.login)));
    let kind: WakeEventKind; let body: string; let actor: GhUser | undefined;
    if (event === 'pull_request_review' && b.action === 'submitted') { kind = 'review'; actor = b.review?.user; body = `Review (${b.review?.state}) from @${actor?.login} on ${ref}:\n${b.review?.body ?? ''}`; }
    else if ((event === 'pull_request_review_comment' || event === 'issue_comment') && b.action === 'created') { kind = 'comment'; actor = b.comment?.user; body = `Comment from @${actor?.login} on ${ref}:\n${b.comment?.body ?? ''}`; }
    else if (event === 'pull_request' && b.action === 'closed' && pr.merged) { kind = 'merge'; body = `${ref} was merged.`; }
    else if (event === 'pull_request' && (pr.mergeable === false || pr.mergeable_state === 'dirty')) { kind = 'conflict'; body = `${ref} has merge conflicts with its base branch.`; }
    else return null;
    if ((kind === 'review' || kind === 'comment') && !human(actor)) return { threadId: owner, outcome: 'ignored' };
    if (kind === 'merge' || kind === 'conflict') {
      const recent = await this.q(`SELECT 1 FROM events WHERE thread_id=$1 AND kind='user.message' AND source='user' AND at > now() - make_interval(days => $2) LIMIT 1`, [owner, p.mergeWindowDays]);
      if (!recent.length) return { threadId: owner, outcome: 'ignored' };
    }
    await this.q(`UPDATE wake_watches SET state='fired' WHERE thread_id=$1 AND kind='pr' AND target=$2 AND state='active' AND payload->>'what'<>'checks'`, [owner, ref]);
    return { threadId: owner, outcome: await this.deliver(owner, kind, body, { userId: null }) };
  }

  /** Subagent finished/blocked wakes its parent; a reply from a messaged thread wakes the sender once. */
  async onEvent(threadId: string, seq: number): Promise<void> {
    const e = (await this.q('SELECT kind, run_id, payload FROM events WHERE thread_id=$1 AND seq=$2', [threadId, seq]))[0];
    if (!e || (e.kind !== 'run.ended' && e.kind !== 'approval.requested')) return;
    const t = await this.thread(threadId);
    const said = (await this.q(`SELECT string_agg(payload->>'text', '' ORDER BY seq) s FROM events WHERE thread_id=$1 AND kind='agent.delta' AND run_id=$2`, [threadId, e.run_id]))[0]?.s ?? '';
    if (e.kind === 'run.ended' && e.payload.state === 'completed' && !t.plan_mode) {
      const parent = t.parent_id && !t.crew_of ? (await this.q(`SELECT id FROM threads WHERE id=$1 AND role<>'captain'`, [t.parent_id]))[0]?.id as string | undefined : undefined;
      if (parent) await this.deliver(parent, 'agent', `Subagent ${t.code} finished:\n${said}`, { userId: t.owner_id, threadId });
      const watchers = await this.q(`UPDATE wake_watches SET state='fired' WHERE kind='thread' AND target=$1 AND state='active' AND created_at <= (SELECT started_at FROM runs WHERE id=$2) RETURNING thread_id, (SELECT owner_id FROM threads o WHERE o.id=wake_watches.thread_id) owner`, [threadId, e.run_id]);
      for (const w of watchers) if (await canViewThread(this.pool, threadId, w.owner)) await this.deliver(w.thread_id, 'thread-message', `Reply from ${t.code}:\n${said}`, { userId: t.owner_id, threadId });
    }
    if (e.kind === 'approval.requested' && t.parent_id && !t.crew_of && (await this.q(`SELECT 1 FROM threads WHERE id=$1 AND role<>'captain'`, [t.parent_id])).length) {
      const q = (await this.q('SELECT question FROM approvals WHERE id=$1', [e.payload.approvalId]))[0]?.question ?? 'needs a decision';
      await this.deliver(t.parent_id, 'agent', `Subagent ${t.code} is blocked: ${q}`, { userId: t.owner_id, threadId });
    }
  }
  async listen(url: string): Promise<() => Promise<void>> {
    const client = new pg.Client({ connectionString: url }); await client.connect(); let chain = Promise.resolve();
    client.on('notification', (m) => { try { const n = JSON.parse(m.payload ?? ''); chain = chain.then(() => this.onEvent(n.threadId, n.seq)).catch((err) => console.error('wakes', err)); } catch { /* not ours */ } });
    await client.query('LISTEN flotilla_events');
    return async () => { await chain; await client.end(); };
  }

  async watch(threadId: string, w: { kind: WakeSubscription['kind']; target: string; label: string; url?: string | null; fireAt?: Date | null; payload?: Row }): Promise<WakeSubscription> {
    return sub((await this.q('INSERT INTO wake_watches (id,thread_id,kind,target,label,url,fire_at,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [id('wch'), threadId, w.kind, w.target, w.label, w.url ?? null, w.fireAt ?? null, JSON.stringify(w.payload ?? {})]))[0]);
  }
  watchPr(threadId: string, repo: string, number: number, what = 'checks') {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !(Number.isInteger(number) && number > 0)) throw new ApiFailure('ValidationFailed', 'repo owner/name and PR number required');
    return this.watch(threadId, { kind: 'pr', target: `${repo}#${number}`, label: `Waiting on ${repo.split('/')[1]}#${number} ${what}`, url: `https://github.com/${repo}/pull/${number}${what === 'checks' ? '/checks' : ''}`, payload: { what } });
  }
  /** A completed check run ends "checks" watches; the CI monitor sends the wake itself. */
  async checksDone(b: Row): Promise<void> {
    const repo = b.repository?.full_name; const n = b.check_run?.pull_requests?.[0]?.number;
    if (b.action === 'completed' && repo && n) await this.q(`UPDATE wake_watches SET state='fired' WHERE kind='pr' AND target=$1 AND state='active' AND payload->>'what'='checks'`, [`${repo}#${n}`]);
  }
  timer(threadId: string, inSec: number, note: string, now = new Date()) {
    if (!(Number.isFinite(inSec) && inSec > 0 && inSec <= TIMER_MAX_SEC)) throw new ApiFailure('ValidationFailed', `timers run 1 s to 7 days (${TIMER_MAX_SEC} s)`);
    const at = new Date(now.getTime() + inSec * 1000);
    return this.watch(threadId, { kind: 'timer', target: at.toISOString(), label: `Waiting until ${at.toISOString()}${note ? `: ${note}` : ''}`, fireAt: at, payload: { note } });
  }
  /** Due timers fire unless the thread is capped; capped timers stay active so the thread never wakes and spends. */
  async sweep(now = new Date()): Promise<string[]> {
    const fired: string[] = [];
    for (const w of await this.q(`SELECT * FROM wake_watches WHERE kind='timer' AND state='active' AND fire_at <= $1 ORDER BY fire_at`, [now])) {
      if (await this.capped(await this.thread(w.thread_id))) continue;
      const claimed = await this.q(`UPDATE wake_watches SET state='fired' WHERE id=$1 AND state='active' RETURNING id`, [w.id]);
      if (claimed.length && (await this.deliver(w.thread_id, 'timer', `Timer fired${w.payload.note ? `: ${w.payload.note}` : ''}`, { userId: null })) !== 'capped') fired.push(w.id);
    }
    return fired;
  }
  async waiting(threadId: string): Promise<WaitState> {
    const watches = (await this.q(`SELECT * FROM wake_watches WHERE thread_id=$1 AND state='active' ORDER BY created_at`, [threadId])).map(sub);
    return { threadId, waiting: watches.length > 0, label: watches[0]?.label ?? null, href: watches[0]?.url ?? `#/threads/${threadId}`, watches };
  }
  async watches(userId: string): Promise<(WakeSubscription & { threadTitle: string })[]> {
    return (await this.q(`SELECT w.*, t.title FROM wake_watches w JOIN threads t ON t.id=w.thread_id WHERE t.owner_id=$1 AND w.state='active' ORDER BY w.created_at`, [userId])).map((r) => ({ ...sub(r), threadTitle: r.title }));
  }
  async stop(watchId: string, userId: string): Promise<WakeSubscription> {
    const r = (await this.q(`UPDATE wake_watches w SET state='stopped' FROM threads t WHERE w.id=$1 AND t.id=w.thread_id AND t.owner_id=$2 AND w.state='active' RETURNING w.*`, [watchId, userId]))[0];
    if (!r) throw new ApiFailure('NotFound', 'watch not found');
    this.aborts.get(watchId)?.abort('stopped');
    return sub(r);
  }

  /** Read-only view of another thread: no event, no inbox item, no run. */
  async peek(threadId: string, userId: string, opts: { q?: string; save?: boolean } = {}): Promise<ThreadPeek> {
    if (!(await canViewThread(this.pool, threadId, userId))) throw new ApiFailure('NotFound', 'thread not found');
    const t = await this.thread(threadId);
    const rows = await this.q(`SELECT seq, kind, payload, at FROM events WHERE thread_id=$1 AND kind IN ('user.message','agent.message','agent.delta') ORDER BY seq`, [threadId]);
    const history = rows.map((r) => ({ seq: r.seq, kind: r.kind, text: text(r.payload), at: r.at.toISOString() })).filter((h) => !opts.q || h.text.toLowerCase().includes(opts.q.toLowerCase()));
    const out: ThreadPeek = { thread: { id: t.id, code: t.code, title: t.title, status: t.status }, prs: (await this.q('SELECT repo, number FROM prs WHERE thread_id=$1', [threadId])) as never, history };
    if (opts.save) {
      const data = Buffer.from(`# ${t.code} ${t.title}\n\n${history.map((h) => `- ${h.kind}: ${h.text}`).join('\n')}\n`);
      out.fileId = id('file');
      await this.q(`INSERT INTO api_files (id,owner_id,name,content_type,size,upload_token_hash,upload_expires_at,data,uploaded_at) VALUES ($1,$2,$3,'text/markdown',$4,'',now(),$5,now())`, [out.fileId, userId, `${t.code}-history.md`, data.length, data]);
    }
    return out;
  }
  /** Explicit cross-thread message: arrives as a steer; the reply wakes the sender once. */
  async send(fromId: string, toId: string, body: string, userId: string): Promise<{ outcome: WakeOutcome; watch: WakeSubscription }> {
    const from = await this.deps.runner.assertOwner(fromId, userId);
    if (fromId === toId || !(await canViewThread(this.pool, toId, userId))) throw new ApiFailure('NotFound', 'thread not found');
    const to = await this.thread(toId);
    const watch = await this.watch(fromId, { kind: 'thread', target: toId, label: `Waiting on a reply from ${to.code}`, url: `#/threads/${toId}` });
    return { outcome: await this.deliver(toId, 'thread-message', `Message from ${from.code}:\n${body}`, { userId, threadId: fromId }, 'steer'), watch };
  }
  held(threadId: string) { return this.q(`SELECT id, kind, text, from_user "fromUser", from_thread "fromThread", created_at "createdAt" FROM wake_inbox WHERE thread_id=$1 AND state='held' ORDER BY created_at`, [threadId]); }
  async release(itemId: string, userId: string, allow: boolean): Promise<Row> {
    const r = (await this.q(`UPDATE wake_inbox w SET state=$3 FROM threads t WHERE w.id=$1 AND t.id=w.thread_id AND t.owner_id=$2 AND w.state='held' RETURNING w.*`, [itemId, userId, allow ? 'delivered' : 'declined']))[0];
    if (!r) throw new ApiFailure('NotFound', 'held message not found');
    if (allow) await this.deps.runner.message(r.thread_id, r.text, 'queue');
    return { id: r.id, state: r.state };
  }

  readonly aborts = new Map<string, AbortController>();
  /** Background command or file transfer with a hard timeout and $ cap; the thread waits on it and wakes when it ends. */
  async startJob(threadId: string, spec: BackgroundJobSpec): Promise<WakeSubscription> {
    const timeoutSec = spec.timeoutSec ?? JOB_DEFAULT_SEC;
    if (!(timeoutSec > 0 && timeoutSec <= JOB_MAX_SEC)) throw new ApiFailure('ValidationFailed', `timeoutSec must be 1..${JOB_MAX_SEC}`);
    if (!Array.isArray(spec.argv) || !spec.argv.length || spec.argv.some((a) => typeof a !== 'string')) throw new ApiFailure('ValidationFailed', 'argv required');
    if (!this.deps.executor) throw new ApiFailure('Conflict', 'no machine executor is configured for background jobs');
    const w = await this.watch(threadId, { kind: 'job', target: spec.kind, label: spec.label ?? `Waiting on ${spec.kind}: ${spec.argv.join(' ').slice(0, 60)}`, payload: { ...spec, timeoutSec, keepAwake: true } });
    const ac = new AbortController(); this.aborts.set(w.id, ac); const started = Date.now();
    const timeout = setTimeout(() => ac.abort('timeout'), timeoutSec * 1000);
    const cap = setInterval(() => { if (spec.maxUsd != null && ((Date.now() - started) / 1000) * (this.deps.usdPerSec ?? 0) >= spec.maxUsd) ac.abort('cap'); }, this.deps.tickMs ?? 1000);
    const job = this.deps.executor(threadId, spec, ac.signal).catch((err) => ({ code: null, output: String(err) })).then(async (res) => {
      clearTimeout(timeout); clearInterval(cap); this.aborts.delete(w.id);
      const reason = ac.signal.aborted ? String(ac.signal.reason) : 'exit';
      const done = await this.q(`UPDATE wake_watches SET state=CASE WHEN state='active' THEN 'fired' ELSE state END, payload=payload||$2 WHERE id=$1 RETURNING state`, [w.id, JSON.stringify({ keepAwake: false, reason, code: res.code })]);
      if (done[0]?.state === 'fired') await this.deliver(threadId, 'job', `Background ${spec.kind} ended (${reason === 'exit' ? `exit ${res.code}` : reason}):\n${res.output.slice(-2000)}`, { userId: null });
    }).finally(() => this.jobs.delete(w.id));
    this.jobs.set(w.id, job);
    return w;
  }
  /** Any thread with a running job keeps its machine awake. */
  async keepAwake(threadId: string): Promise<boolean> { return (await this.q(`SELECT 1 FROM wake_watches WHERE thread_id=$1 AND kind='job' AND state='active' AND (payload->>'keepAwake')::boolean`, [threadId])).length > 0; }
}

export const rsyncArgv = (src: string, dst: string) => ['rsync', '-a', '--partial', '-e', 'ssh -o BatchMode=yes', src, dst];
