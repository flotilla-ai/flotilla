import { randomBytes } from 'node:crypto';
import type { AdapterEvent, CostTotals, Thread } from '@flotilla/core/types';
import { meter, budgetZero, inRunFence } from '@flotilla/core/kernel/budget';
import { placeholderPriceTable } from '@flotilla/core/kernel/priceTable';
import { createDeltaScrubber, scrub } from '@flotilla/core/kernel/scrub';
import { EventStore } from '../events/store.js';
import type { GitDriver } from '../git/mirror.js';
import { seedWorkspace } from '../git/mirror.js';
import type { AgentAdapter } from '@flotilla/core/types';
import { getRunTokenService } from '../captain/tools/registry.js';
import { captainMcpTar, tarFile } from '../captain/tools/mcpConfig.js';
import { secretsTar, type SecretsStore } from '../secrets/store.js';
import type { EnvVarMutation, PreparedSecrets } from '../secrets/types.js';
import { ApiFailure } from '../api-platform/types.js';
import { DELIVERY_MODES, PLAN_PROMPT, RunnerQueue, adapterError, parseCommand, type AdapterError, type ContextMeter, type DeliveryMode, type ThreadInboxItem } from './runner-queue.js';

type Driver = GitDriver & { startThreadContainer(input: Record<string, unknown>): Promise<{ containerId: string }>; stop(id: string): Promise<void> };
type Row = Record<string, unknown>;
const zero = budgetZero;
const add = (a: CostTotals, b: CostTotals): CostTotals => ({ usd: a.usd+b.usd, inputTokens: a.inputTokens+b.inputTokens, outputTokens: a.outputTokens+b.outputTokens, cacheTokens: a.cacheTokens+b.cacheTokens, machineSec: a.machineSec+b.machineSec });
const id = (p: string) => `${p}_${randomBytes(10).toString('base64url')}`;
const budget = (maxUsd: number | null = null) => ({ maxUsd, maxTokens: null, maxWallSec: null, scope: 'thread' as const, onHit: 'pause-and-ask' as const, warnAt: 0.8 });
export type RunnerDeps = { store: EventStore; driver: Driver; adapters: Map<string, AgentAdapter>; secrets?: Record<string,string>; projectFor?(row: Row): Row; vault?: Pick<SecretsStore, 'mutate' | 'prepare'>; resolveEngine?(userId: string, engine: Row): Promise<{ adapter: string; model: string | null; effort: unknown; connectionId: string | null; contextWindow?: number }>; runOut?: { onRunOut(threadId: string): Promise<{ switchedTo: string } | { approvalId: string }>; answer(approval: Row, optionId: string): Promise<void> } };
type AfterRun=(input:{thread:Row;project:Row|null;runId:string;state:string;containerId:string;driver:Driver})=>Promise<void>;
const afterRunHooks:AfterRun[]=[];
export function onAfterRun(fn:AfterRun):()=>void{afterRunHooks.push(fn);return()=>{const i=afterRunHooks.indexOf(fn);if(i>=0)afterRunHooks.splice(i,1)}}
/** Where a run executes: `workspaceFrom` mounts another thread's workspace read-only (no seeding); `baseBranch` replaces the project base. */
export type RunPlacement = { workspaceFrom?: string; baseBranch?: string };
type Placement=(thread:Row)=>Promise<RunPlacement|null>;
const placementHooks:Placement[]=[];
export function onPlacement(fn:Placement):()=>void{placementHooks.push(fn);return()=>{const i=placementHooks.indexOf(fn);if(i>=0)placementHooks.splice(i,1)}}

export class ThreadRunner {
  readonly running = new Map<string, Promise<void>>();
  readonly cancelled = new Set<string>();
  readonly containers = new Map<string,string>();
  readonly inbox: RunnerQueue;
  private readonly live = new Map<string, { runId: string; adapter: AgentAdapter; sessionId: string | null }>();
  private readonly supervised = new Set<Promise<void>>();
  constructor(readonly deps: RunnerDeps) { this.inbox = new RunnerQueue(deps.store.pool); }
  get pool() { return this.deps.store.pool; }
  private supervise(promise: Promise<void>): void {
    const tracked = promise.catch(() => undefined).finally(() => this.supervised.delete(tracked));
    this.supervised.add(tracked);
  }
  async drain(): Promise<void> {
    while (this.supervised.size) await Promise.allSettled(this.supervised);
  }
  kick(threadId: string): void { this.supervise(this.startNext(threadId, 'message')); }
  async resumePending(): Promise<void> { for (const t of new Set([...(await this.inbox.releaseUploads()), ...(await this.inbox.pendingThreads())])) this.kick(t); }
  async assertOwner(threadId: string, userId: string): Promise<Row> { const t = await this.thread(threadId); if (!t || t.owner_id !== userId) throw new ApiFailure('NotFound', 'thread not found'); return t; }
  private adapterFor(thread: Row): AgentAdapter | undefined { return this.deps.adapters.get((thread.engine as Row).adapter as string); }

  private async owned(threadId: string, userId?: string): Promise<boolean> { if (!userId) return true; const t=await this.thread(threadId); return t?.owner_id===userId; }
  async createThread(input: { ownerId: string; projectId?: string | null; title: string; prompt: string; engine?: Thread['engine']; maxUsd?: number | null; requestId?: string; env?: EnvVarMutation[]; parentId?: string; attachments?: string[]; draft?: boolean }): Promise<Row> {
    if (input.requestId) {
      const prior = await this.pool.query(`SELECT e.thread_id FROM events e JOIN threads t ON t.id=e.thread_id WHERE e.request_id=$1 AND e.kind='thread.created' AND t.owner_id=$2 ORDER BY e.seq LIMIT 1`, [input.requestId, input.ownerId]);
      if (prior.rows[0]) { const row=(await this.pool.query('SELECT * FROM threads WHERE id=$1', [prior.rows[0].thread_id])).rows[0]; if(row?.owner_id!==input.ownerId) throw new Error('not found'); return row; }
    }
    if (input.projectId) { const ownedProject=(await this.pool.query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[input.projectId,input.ownerId])).rows[0]; if(!ownedProject) throw new Error('project not found'); }
    const env = input.env ?? [];
    if (env.length && !this.deps.vault) throw new Error('secrets vault not configured');
    await this.inbox.validateAttachments(input.ownerId, input.attachments);
    const threadId = id('thr'); const code = `FLO-${randomBytes(2).toString('hex').toUpperCase()}`;
    const row = (await this.pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent,parent_id) VALUES ($1,$2,$3,'thread',$4,$5,$10,$6,$7,$8,$9) RETURNING *`, [threadId, code, input.projectId ?? null, input.ownerId, input.title, JSON.stringify(input.engine ?? { adapter: 'fake', model: null, effort: null, connectionId: null }), JSON.stringify(budget(input.maxUsd ?? null)), JSON.stringify(zero), input.parentId ?? null, input.draft ? 'idle' : 'queued'])).rows[0];
    if (env.length) await this.deps.vault!.mutate('thread', threadId, env, input.ownerId).catch(async (err) => { await this.pool.query('DELETE FROM threads WHERE id=$1', [threadId]); throw err; });
    const createSecrets = { ...this.deps.secrets, ...Object.fromEntries(env.flatMap((m) => m.op === 'set' ? [[m.name, m.value]] : [])) };
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'thread.created', source: 'kernel', trust: 'trusted', payload: scrub({ title: input.title }, createSecrets) }, ...(input.draft ? [] : [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: scrub({ text: input.prompt }, createSecrets) }])] as never, { requestId: input.requestId });
    if (input.draft) return row;
    const cmd = parseCommand(input.prompt);
    await this.inbox.add({ threadId, text: cmd.kind === 'plan' ? cmd.body : input.prompt, mode: 'queue', plan: cmd.kind === 'plan', by: input.ownerId, ownerId: input.ownerId, attachments: input.attachments });
    this.kick(threadId);
    return row;
  }

  async message(threadId: string, text: string, mode: DeliveryMode = 'queue', userId?: string, attachments: string[] = []): Promise<{ item: ThreadInboxItem | null; sideThreadId?: string }> {
    if (!DELIVERY_MODES.includes(mode)) throw new ApiFailure('ValidationFailed', 'mode must be queue, steer or interrupt');
    const thread = await this.thread(threadId); if (!thread || (userId && thread.owner_id!==userId)) throw new ApiFailure('NotFound', 'thread not found');
    const parsed = parseCommand(text); const cmd = parsed.kind === 'side' && !userId ? { kind: null, body: text } : parsed;
    if (cmd.kind === 'side') {
      const side = await this.createThread({ ownerId: thread.owner_id as string, parentId: threadId, projectId: thread.project_id as string | null, title: `btw: ${cmd.body.slice(0, 60)}`, prompt: cmd.body, engine: thread.engine as Thread['engine'], maxUsd: (thread.budget as { maxUsd: number | null } | null)?.maxUsd ?? null });
      await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'thread.side', source: 'kernel', trust: 'trusted', payload: { threadId: side.id } }] as never);
      return { item: null, sideThreadId: side.id as string };
    }
    const item = await this.inbox.add({ threadId, text: cmd.body, mode, plan: cmd.kind === 'plan', by: userId ?? null, ownerId: thread.owner_id as string, attachments, priority: mode === 'interrupt' ? 1 : 0 });
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'user.message', source: userId ? 'user' : 'kernel', trust: userId ? 'trusted' : 'untrusted', payload: scrub({ text, mode, by: userId, inboxId: item.id }, this.deps.secrets ?? {}) }] as never);
    return { item: item.state === 'pending' ? await this.deliver(threadId, item) : item };
  }
  /** Steer if the live adapter can inject at its next step; interrupt for send-now; otherwise the item waits for the turn to end. */
  async deliver(threadId: string, item: ThreadInboxItem): Promise<ThreadInboxItem> {
    const live = this.live.get(threadId);
    if (!live) { this.kick(threadId); return item; }
    if (item.mode === 'steer' && live.sessionId && live.adapter.manifest.capabilities.steerMidTurn && live.adapter.steer) {
      const claimed = await this.inbox.markDelivered(item.id, live.runId);
      if (claimed && (await live.adapter.steer(live.sessionId, item.text).catch(() => 'queued' as const)) === 'delivered') return claimed;
      if (claimed) await this.pool.query(`UPDATE thread_inbox SET state='pending',delivered_at=NULL,run_id=NULL WHERE id=$1`, [item.id]);
    }
    if (item.mode === 'interrupt') await this.interrupt(threadId);
    return item;
  }
  async sendNow(threadId: string, itemId: string): Promise<ThreadInboxItem> { const item = await this.inbox.prioritize(threadId, itemId); return item.state === 'pending' ? this.deliver(threadId, { ...item, mode: item.mode === 'steer' ? 'steer' : 'interrupt' }) : item; }
  async newVersion(threadId: string, itemId: string, text: string, userId: string): Promise<ThreadInboxItem> {
    const thread = await this.assertOwner(threadId, userId); const sent = await this.inbox.get(threadId, itemId);
    if (!sent) throw new ApiFailure('NotFound', 'message not found');
    if (sent.state !== 'delivered') throw new ApiFailure('Conflict', 'edit queued messages in place');
    const version = Math.max(...(await this.inbox.versions(threadId, itemId)).map((v) => v.version)) + 1;
    const item = await this.inbox.add({ threadId, text, mode: 'queue', plan: sent.plan, by: userId, ownerId: thread.owner_id as string, attachments: sent.attachments, rootId: sent.rootId, version, priority: 1 });
    // No adapter exposes fork/rewind yet, so the edited version starts a new session (SPEC CAPY-010 fallback).
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: scrub({ text, mode: 'queue', by: userId, inboxId: item.id, rootId: sent.rootId, version, fork: 'new-session' }, this.deps.secrets ?? {}) }] as never);
    return this.deliver(threadId, item);
  }
  async retry(threadId: string, userId: string, engine: { model?: string; connectionId?: string; effort?: string | null }): Promise<ThreadInboxItem> {
    const thread = await this.assertOwner(threadId, userId);
    const last = (await this.pool.query('SELECT state FROM runs WHERE thread_id=$1 ORDER BY ordinal DESC LIMIT 1', [threadId])).rows[0];
    const sent = await this.inbox.lastDelivered(threadId);
    if (last?.state !== 'failed' || !sent || this.running.has(threadId)) throw new ApiFailure('Conflict', 'nothing to retry');
    if (engine.model !== undefined || engine.connectionId !== undefined || engine.effort !== undefined) {
      const next: Row = { ...(thread.engine as Row), ...(engine.model !== undefined ? { model: engine.model } : {}), ...(engine.model !== undefined && engine.model !== (thread.engine as Row).model ? { effort: null } : {}), ...(engine.effort !== undefined ? { effort: engine.effort } : {}), ...(engine.connectionId !== undefined ? { connectionId: engine.connectionId } : {}) };
      // The catalog checks the user owns an enabled connection that offers the model; the vault then injects its key at run start.
      const r = this.deps.resolveEngine ? await this.deps.resolveEngine(userId, next) : null;
      await this.pool.query('UPDATE threads SET engine=engine || $2::jsonb WHERE id=$1', [threadId, JSON.stringify(r ? { adapter: r.adapter, model: r.model, effort: r.effort, connectionId: r.connectionId, contextWindow: r.contextWindow ?? null } : next)]);
    }
    await this.pool.query(`UPDATE threads SET status='queued' WHERE id=$1`, [threadId]);
    const item = await this.inbox.add({ threadId, text: sent.text, mode: 'queue', plan: sent.plan, by: userId, ownerId: thread.owner_id as string, attachments: sent.attachments, priority: 1 });
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'control.retry', source: 'user', trust: 'trusted', payload: { inboxId: item.id, ...engine } }] as never);
    return this.deliver(threadId, item);
  }
  async context(threadId: string, userId: string, compactAt?: unknown): Promise<ContextMeter> {
    const thread = await this.assertOwner(threadId, userId);
    const caps = this.adapterFor(thread)?.manifest.capabilities as { compaction?: boolean } | undefined;
    const compactSupported = caps?.compaction === true;
    if (compactAt !== undefined) {
      if (!compactSupported) throw new ApiFailure('Conflict', 'this agent does not support compaction');
      if (typeof compactAt !== 'number' || !(compactAt > 0 && compactAt <= 1)) throw new ApiFailure('ValidationFailed', 'compactAt must be in (0, 1]');
      await this.pool.query('UPDATE threads SET compact_at=$2 WHERE id=$1', [threadId, compactAt]); thread.compact_at = compactAt;
    }
    const usage = (await this.pool.query('SELECT usage FROM runs WHERE thread_id=$1 AND ended_at IS NOT NULL ORDER BY ordinal DESC LIMIT 1', [threadId])).rows[0]?.usage as CostTotals | undefined;
    return { usedTokens: usage ? usage.inputTokens + usage.outputTokens + usage.cacheTokens : 0, compactAt: (thread.compact_at as number | null) ?? Number(process.env.FLOTILLA_COMPACT_AT ?? 0.8), compactSupported };
  }
  async interrupt(threadId: string, userId?: string): Promise<void> { if (!(await this.owned(threadId,userId))) throw new Error('not found'); this.cancelled.add(threadId); const live = this.live.get(threadId); if (live) await live.adapter.cancel(live.runId as never).catch(() => undefined); await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'control.interrupt', source: 'user', trust: 'trusted', payload: {} }] as never); }
  async stop(threadId: string, userId?: string): Promise<void> { if (!(await this.owned(threadId,userId))) throw new Error('not found'); this.cancelled.add(threadId); await this.inbox.cancelAll(threadId); { const live = this.live.get(threadId); if (live) await live.adapter.cancel(live.runId as never).catch(() => undefined); } if (!this.running.has(threadId)) this.cancelled.delete(threadId); await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'control.stop', source: 'user', trust: 'trusted', payload: {} }] as never); await this.pool.query(`UPDATE threads SET status='idle',updated_at=now() WHERE id=$1`, [threadId]); }

  async answerApproval(approvalId: string, optionId: string, value: number | undefined, userId: string): Promise<Row | null> {
    const existing = (await this.pool.query('SELECT thread_id, detail FROM approvals WHERE id=$1 AND state=$2', [approvalId, 'open'])).rows[0];
    if (!existing || !(await this.owned(existing.thread_id,userId))) return null;
    if ((existing.detail as { feedback?: unknown } | null)?.feedback) throw new ApiFailure('Conflict', 'feedback drafts must be answered through the feedback endpoint');
    const rows = await this.pool.query(`UPDATE approvals SET state='answered',answer=$2 WHERE id=$1 AND state='open' RETURNING *`, [approvalId, JSON.stringify({ optionId, value, by: userId, at: new Date().toISOString() })]);
    const approval = rows.rows[0]; if (!approval) return null;
    if (approval.kind === 'budget' && optionId === 'raise' && value) await this.pool.query(`UPDATE threads SET budget=jsonb_set(budget,'{maxUsd}',to_jsonb($2::int)),status='queued' WHERE id=$1`, [approval.thread_id, value]);
    if (approval.kind === 'budget' && optionId === 'stop') await this.stop(approval.thread_id);
    if (approval.kind === 'run-out') { await this.deps.runOut?.answer(approval, optionId); if (optionId === 'use') await this.pool.query(`UPDATE threads SET status='queued' WHERE id=$1`, [approval.thread_id]); }
    await this.deps.store.appendEvents(approval.thread_id, [{ runId: null, kind: 'approval.resolved', source: 'kernel', trust: 'trusted', payload: { approvalId, optionId, value } }] as never);
    if (approval.kind === 'run-out' && optionId === 'use') this.kick(approval.thread_id);
    if (approval.gate === 'plan') {
      const owner = (await this.thread(approval.thread_id))!.owner_id as string;
      if (optionId === 'approve') { await this.pool.query(`UPDATE threads SET plan_mode=false,status='queued',needs_you='[]' WHERE id=$1`, [approval.thread_id]); await this.inbox.add({ threadId: approval.thread_id, ...(await this.approvedPlan(approval.thread_id)), mode: 'queue', by: null, ownerId: owner, priority: 1 }); }
      else if (optionId === 'stop') { await this.stop(approval.thread_id, userId); await this.pool.query(`UPDATE threads SET plan_mode=false,status='idle',needs_you='[]' WHERE id=$1`, [approval.thread_id]); }
      else {
        await this.pool.query(`UPDATE threads SET status='queued',needs_you='[]' WHERE id=$1`, [approval.thread_id]);
        const prior = await this.approvedPlan(approval.thread_id);
        await this.inbox.add({ threadId: approval.thread_id, text: prior.text.replace('Plan approved. Implement the plan now.', 'Continue planning. Revise the plan; do not implement yet.'), attachments: prior.attachments, mode: 'queue', plan: true, by: null, ownerId: owner, priority: 1 });
      }
      if (optionId !== 'stop') this.kick(approval.thread_id);
    }
    if (optionId === 'raise') { if (!(await this.inbox.hasPending(approval.thread_id))) await this.inbox.add({ threadId: approval.thread_id, text: 'Continue within the raised budget.', mode: 'queue', by: null, ownerId: (await this.thread(approval.thread_id))!.owner_id as string }); this.supervise(this.startNext(approval.thread_id, 'resume')); }
    return approval;
  }

  async startNext(threadId: string, trigger: string): Promise<void> {
    if (this.running.has(threadId)) return;
    if (!(await this.inbox.hasPending(threadId))) return;
    if ((await this.pool.query(`SELECT 1 FROM approvals WHERE thread_id=$1 AND gate='plan' AND state='open'`, [threadId])).rows[0]) return;
    if (this.running.has(threadId)) return;
    const promise = this.run(threadId, trigger).catch(async (_err) => { await this.pool.query(`UPDATE threads SET status='failed' WHERE id=$1`, [threadId]); }).finally(() => this.running.delete(threadId));
    this.running.set(threadId, promise);
    await promise;
    const current = await this.thread(threadId);
    const budgetNow=current?.budget as {maxUsd:number|null}|undefined;const spentNow=(current?.spent as {usd:number}|undefined)?.usd??0;if (current?.status !== 'failed' && current?.status !== 'paused' && !this.cancelled.has(threadId) && (budgetNow?.maxUsd==null||spentNow<budgetNow.maxUsd) && await this.inbox.hasPending(threadId)) this.kick(threadId);
  }

  private async thread(threadId: string): Promise<Row | null> { return (await this.pool.query('SELECT * FROM threads WHERE id=$1', [threadId])).rows[0] ?? null; }
  private async project(thread: Row): Promise<Row | null> { return thread.project_id ? (await this.pool.query('SELECT * FROM projects WHERE id=$1', [thread.project_id])).rows[0] ?? null : null; }

  private async run(threadId: string, trigger: string): Promise<void> {
    const thread = await this.thread(threadId); if (!thread) return;
    const runId = id('run'); const ordinal = ((await this.pool.query('SELECT max(ordinal) n FROM runs WHERE thread_id=$1', [threadId])).rows[0].n ?? 0) + 1;
    await this.pool.query(`INSERT INTO runs (id,thread_id,ordinal,trigger,state,usage) VALUES ($1,$2,$3,$4,'starting',$5)`, [runId, threadId, ordinal, JSON.stringify({ kind: trigger, eventId: null }), JSON.stringify(zero)]);
    await this.pool.query(`UPDATE threads SET status='working',updated_at=now() WHERE id=$1`, [threadId]);
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'run.started', source: 'kernel', trust: 'trusted', payload: { trigger } }] as never);

    const policy = thread.budget as { maxUsd: number | null; maxWallSec: number | null; maxTokens: number | null; warnAt: number };
    const reserveAmount = Math.min(20_000, Math.max(1, policy.maxUsd ?? 20_000));
    if (policy.maxUsd !== null && (thread.spent as CostTotals).usd >= policy.maxUsd) { await this.pool.query(`UPDATE runs SET state='paused_budget',ended_at=now() WHERE id=$1`, [runId]); await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'run.ended', source: 'kernel', trust: 'trusted', payload: { state: 'paused_budget', usage: zero } }] as never); return this.pauseBudget(threadId, runId, 'budget'); }
    let prepared: PreparedSecrets;
    try { prepared = await this.deps.vault?.prepare(threadId) ?? { env: {}, grants: [] }; } catch (err) { return this.failStart(threadId, runId, err); }
    if (policy.maxUsd !== null) {
      await this.pool.query('INSERT INTO budget_holds (scope,scope_id,run_id,amount) VALUES ($1,$2,$3,$4)', ['thread', threadId, runId, reserveAmount]);
    }

    const adapter = this.adapterFor(thread);
    if (!adapter) return this.failStart(threadId, runId, new Error(`adapter ${(thread.engine as Row).adapter} is not installed`));
    const place: RunPlacement = {}; try { for (const hook of placementHooks) Object.assign(place, await hook(thread)); } catch (err) { return this.failStart(threadId, runId, err); }
    const base = await this.project(thread);
    const project = base && place.baseBranch ? { ...base, repo: { ...(base.repo as Row), baseBranch: place.baseBranch } } : base;
    const tokenService = thread.role === 'captain' ? getRunTokenService() : null;
    const runToken = tokenService?.issue(runId, threadId);
    let machine = { containerId: '' };
    {
      machine = await this.deps.driver.startThreadContainer({ threadId, code: thread.code, image: process.env.FLOTILLA_THREAD_IMAGE ?? 'flotilla-thread:dev', cpus: 1, memMb: 512, env: runToken ? { FLOTILLA_MCP_TOKEN: runToken.token } : {}, roMounts: [], egressAllow: project?.egress_allow as string[] ?? [], ...(place.workspaceFrom ? { workspaceFrom: place.workspaceFrom } : {}) }).catch((err) => { tokenService?.endRun(runId); throw err; });
      if (project?.repo && !thread.branch && !place.workspaceFrom) {
        const seeded = await seedWorkspace({ id: threadId as never, code: thread.code as string, title: thread.title as string, branch: thread.branch as string | null, containerId: machine.containerId }, { id: project.id as never, repo: project.repo as never, trust: project.trust as never, token: process.env.GITHUB_TOKEN }, this.deps.driver).catch(() => ({ branch: null }));
        if (seeded.branch && seeded.branch !== thread.branch) await this.pool.query('UPDATE threads SET branch=$2 WHERE id=$1', [threadId, seeded.branch]);
        thread.branch = seeded.branch ?? thread.branch;
      }
    }
    if (Object.keys(prepared.env).length) {
      try {
        if (!('copyIn' in this.deps.driver)) throw new Error('machine driver cannot receive the secrets file');
        await (this.deps.driver as Driver & {copyIn(id:string,dir:string,tar:Buffer):Promise<void>}).copyIn(machine.containerId, '/run', secretsTar(prepared.env));
      } catch (err) {
        tokenService?.endRun(runId);
        await ((this.deps.driver as Driver & {remove?(id:string):Promise<void>}).remove?.(machine.containerId) ?? this.deps.driver.stop(machine.containerId)).catch(() => undefined);
        return this.failStart(threadId, runId, new Error('secrets file could not be written to the machine', { cause: err }));
      }
    }
    if (runToken && 'copyIn' in this.deps.driver) await (this.deps.driver as Driver & {copyIn(id:string,dir:string,tar:Buffer):Promise<void>}).copyIn(machine.containerId, '/run', captainMcpTar(runToken.token)).catch(() => undefined);
    let transport: ReturnType<Driver['transport']>;
    try { transport = this.deps.driver.transport(machine.containerId); } catch (err) { tokenService?.endRun(runId); throw err; }
    let usage = { ...zero }; let state: 'completed' | 'cancelled' | 'failed' | 'paused_budget' | 'run_out' = 'completed'; let error: AdapterError | null = null; const started = Date.now();
    const eventSecrets = { ...this.deps.secrets, ...prepared.env, ...(runToken ? { FLOTILLA_MCP_TOKEN: runToken.token } : {}) };
    const scrubber = createDeltaScrubber(eventSecrets);
    const item = await this.inbox.claim(threadId, runId); const planRun = item?.plan === true || thread.plan_mode === true;
    if (item?.plan && !thread.plan_mode) await this.pool.query('UPDATE threads SET plan_mode=true WHERE id=$1', [threadId]);
    const files = item?.attachments.length ? await this.copyAttachments(machine.containerId, item.attachments) : [];
    const prompt = item ? `${planRun ? PLAN_PROMPT : ''}${item.text}${files.length ? `\n\nAttached files:\n${files.map((f) => `- ${f}`).join('\n')}` : ''}` : '';
    const eng = thread.engine as { model?: string | null; effort?: string | null };
    this.live.set(threadId, { runId, adapter, sessionId: null });
    let stream: AsyncIterable<AdapterEvent>;
    try { stream = adapter.start({ runId: runId as never, threadId: threadId as never, prompt, cwd: project?.repo ? '/workspace/repo' : '/workspace', env: prepared.env, transport, resumeSessionId: null, attachments: files, model: eng.model ?? null, effort: eng.effort ?? null, contextWindow: (thread.engine as Row).contextWindow ?? null, vendorBudget: { maxMicroUsd: policy.maxUsd }, auth: { kind: 'none' }, mcpConfigPath: runToken ? '/run/flotilla/mcp.json' : null, images: [] } as never); } catch (err) { tokenService?.endRun(runId); throw err; }
    try {
      for await (const event of stream) {
        if (this.cancelled.has(threadId)) { state = 'cancelled'; await adapter.cancel(runId as never).catch(() => undefined); break; }
        if (event.t === 'session') this.live.set(threadId, { runId, adapter, sessionId: event.adapterSessionId });
        await this.adapterEvent(threadId, runId, event, scrubber, eventSecrets);
        if (event.t === 'usage') {
          const m = meter({ threadId: threadId as never, runId: runId as never, at: new Date().toISOString() }, usage, event, null, placeholderPriceTable);
          usage = m.next;
          await this.pool.query('INSERT INTO cost_entries (thread_id,run_id,source,model,delta,price_table_version) VALUES ($1,$2,$3,$4,$5,$6)', [threadId, runId, m.entry.source, m.entry.model, JSON.stringify(m.entry.delta), m.entry.priceTableVersion]);
          await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'cost.entry', source: 'kernel', trust: 'trusted', payload: m.entry }] as never);
          await this.pool.query(`UPDATE threads SET spent=$2,updated_at=now() WHERE id=$1`, [threadId, JSON.stringify(add(thread.spent as CostTotals, usage))]);
          const fence = inRunFence({ estimate: usage, wallSec: (Date.now()-started)/1000, hold: { scope: 'thread', scopeId: threadId as never, runId: runId as never, amount: reserveAmount }, policy: policy as never });
          if (fence !== 'continue' || (policy.maxUsd !== null && usage.usd >= policy.maxUsd)) { state = 'paused_budget'; await adapter.cancel(runId as never).catch(() => undefined); await this.pauseBudget(threadId, runId, fence === 'continue' ? 'usd' : fence.stop); break; }
        }
        if (event.t === 'done' && event.stopReason === 'error') { state = 'failed'; error = adapterError(scrub(event.error ?? '', eventSecrets) as string); }
        if (event.t === 'done' && event.stopReason === 'run_out' && state === 'completed') state = 'run_out';
        if (event.t === 'done' && event.stopReason === 'cancelled' && state === 'completed') state = 'cancelled';
      }
      const tail = scrubber.flush(); if (tail) await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'agent.delta', source: 'adapter', trust: 'trusted', payload: { text: tail } }] as never);
    } finally {
      this.live.delete(threadId);
      tokenService?.endRun(runId);
      await this.pool.query('DELETE FROM budget_holds WHERE run_id=$1', [runId]);
      await this.pool.query('UPDATE runs SET state=$2,ended_at=now(),usage=$3,error=$4 WHERE id=$1', [runId, state, JSON.stringify(usage), error && JSON.stringify(error)]);
      let ranOut: { switchedTo: string } | { approvalId: string } | null = null;
      if (state === 'run_out') { if (item) await this.inbox.add({ threadId, text: item.text, mode: 'queue', plan: item.plan, by: null, ownerId: thread.owner_id as string, attachments: item.attachments, priority: 1 }); ranOut = await this.deps.runOut?.onRunOut(threadId).catch(() => null) ?? null; }
      await this.pool.query(`UPDATE threads SET status=$2,updated_at=now() WHERE id=$1`, [threadId, state === 'run_out' ? (ranOut && 'switchedTo' in ranOut ? 'queued' : 'paused') : state === 'paused_budget' ? 'paused' : state === 'completed' ? 'waiting' : state === 'cancelled' ? 'idle' : 'failed']);
      await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'run.ended', source: 'kernel', trust: 'trusted', payload: { state, usage, ...(error ? { error } : {}) } }, ...(ranOut ? [{ runId: null, kind: 'switchedTo' in ranOut ? 'thread.status' : 'approval.requested', source: 'kernel', trust: 'trusted', payload: 'switchedTo' in ranOut ? { status: 'queued', runOut: true, connectionId: ranOut.switchedTo } : { approvalId: ranOut.approvalId, kind: 'run-out' } }] : [])] as never);
      if (planRun && state === 'completed') await this.openPlanGate(thread, runId);
      for (const hook of planRun ? [] : afterRunHooks) await hook({ thread, project, runId, state, containerId: machine.containerId, driver: this.deps.driver }).catch(() => undefined);
      await ((this.deps.driver as Driver & {remove?(id:string):Promise<void>}).remove?.(machine.containerId) ?? this.deps.driver.stop(machine.containerId)).catch(() => undefined);
      this.containers.delete(threadId);
      this.cancelled.delete(threadId);
    }
  }
  private async adapterEvent(threadId: string, runId: string, event: AdapterEvent, scrubber: ReturnType<typeof createDeltaScrubber>, eventSecrets: Record<string,string> = this.deps.secrets ?? {}): Promise<void> {
    if (event.t === 'text') { const out = scrubber.push(event.delta); if (out) await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'agent.delta', source: 'adapter', trust: 'trusted', payload: { text: out } }] as never); return; }
    const kind = event.t === 'tool_call' ? 'agent.tool_call' : event.t === 'tool_result' ? 'agent.tool_result' : event.t === 'done' ? null : null;
    if (kind) await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind, source: 'adapter', trust: 'trusted', payload: scrub(event, eventSecrets) }] as never);
  }
  /** Plan mode ends every turn at a blocking gate; nothing else runs and no after-run hook (push, PR) fires until it is approved. */
  /** Runs start fresh sessions, so the implementation turn gets the request and the plan text. */
  private async approvedPlan(threadId: string): Promise<{ text: string; attachments: string[] }> {
    const latest = await this.inbox.lastDelivered(threadId);
    const first = (await this.pool.query(`SELECT text,attachments FROM thread_inbox WHERE thread_id=$1 AND plan=true AND by_user IS NOT NULL AND created_at <= $2 ORDER BY created_at DESC LIMIT 1`, [threadId, latest?.createdAt ?? new Date(0)])).rows[0] ?? (await this.pool.query(`SELECT text,attachments FROM thread_inbox WHERE thread_id=$1 AND plan=true AND by_user IS NOT NULL ORDER BY created_at DESC LIMIT 1`, [threadId])).rows[0] ?? (await this.pool.query('SELECT text,attachments FROM thread_inbox WHERE thread_id=$1 ORDER BY created_at LIMIT 1', [threadId])).rows[0];
    const plan = (await this.pool.query(`SELECT string_agg(payload->>'text', '' ORDER BY seq) AS text FROM events WHERE thread_id=$1 AND kind='agent.delta' AND run_id=$2`, [threadId, latest?.runId ?? null])).rows[0]?.text as string | null;
    return { text: `Plan approved. Implement the plan now.${first ? `\n\nRequest:\n${first.text}` : ''}${plan ? `\n\nApproved plan:\n${plan}` : ''}`, attachments: first?.attachments ?? [] };
  }
  private async openPlanGate(thread: Row, runId: string): Promise<void> {
    const approvalId = id('apr');
    await this.pool.query(`UPDATE threads SET status='paused',needs_you=$2 WHERE id=$1`, [thread.id, JSON.stringify([approvalId])]);
    await this.pool.query(`INSERT INTO approvals (id,thread_id,captain_id,kind,question,options,blocking,state,gate) VALUES ($1,$2,$3,'decision','Approve the plan?',$4,true,'open','plan')`, [approvalId, thread.id, thread.crew_of ?? null, JSON.stringify([{ id: 'approve', label: 'Approve plan' }, { id: 'revise', label: 'Keep planning' }])]);
    await this.deps.store.appendEvents(thread.id as Thread['id'], [{ runId: runId as never, kind: 'approval.requested', source: 'kernel', trust: 'trusted', payload: { approvalId, kind: 'decision', gate: 'plan' } }] as never);
  }
  private async copyAttachments(containerId: string, ids: string[]): Promise<string[]> {
    const copyIn = (this.deps.driver as Driver & { copyIn?(id: string, dir: string, tar: Buffer): Promise<void> }).copyIn;
    if (!copyIn) return [];
    const paths: string[] = [];
    for (const fileId of ids) {
      const f = (await this.pool.query('SELECT id,name,data FROM api_files WHERE id=$1 AND uploaded_at IS NOT NULL', [fileId])).rows[0] as { id: string; name: string; data: Buffer } | undefined;
      if (!f) continue;
      const dir = `flotilla/attachments/${f.id}-`;
      const rel = dir + f.name.replace(/[^\w.-]/g, '_').slice(-(100 - dir.length)); await copyIn.call(this.deps.driver, containerId, '/run', tarFile(rel, f.data)); paths.push(`/run/${rel}`);
    }
    return paths;
  }
  /** At startup, runs without ended_at belong to a dead process: end them and re-queue the messages they had claimed. */
  async recoverClaimed(): Promise<void> {
    const rows = await this.pool.query(`WITH orphan AS (UPDATE runs SET state='failed',ended_at=now() WHERE ended_at IS NULL RETURNING id),
      items AS (UPDATE thread_inbox SET state='pending',delivered_at=NULL,run_id=NULL WHERE state='delivered' AND run_id IN (SELECT id FROM orphan) RETURNING thread_id)
      SELECT DISTINCT thread_id FROM items`);
    for (const r of rows.rows) this.kick(r.thread_id as string);
  }
  private async failStart(threadId: string, runId: string, err: unknown): Promise<never> {
    await this.inbox.cancelAll(threadId);
    await this.pool.query('DELETE FROM budget_holds WHERE run_id=$1', [runId]);
    await this.pool.query(`UPDATE runs SET state='failed',ended_at=now() WHERE id=$1`, [runId]);
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'run.ended', source: 'kernel', trust: 'trusted', payload: { state: 'failed', usage: zero } }] as never);
    throw err;
  }
  private async pauseBudget(threadId: string, runId: string, why: string): Promise<void> {
    const approvalId = id('apr');
    // Thread status first: anything that sees the open approval also sees the thread paused.
    await this.pool.query(`UPDATE threads SET status='paused',needs_you=$2 WHERE id=$1`, [threadId, JSON.stringify([approvalId])]);
    await this.pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,'budget',$3,$4,true,'open') ON CONFLICT DO NOTHING`, [approvalId, threadId, `Budget cap reached (${why}); raise the cap or stop`, JSON.stringify([{ id: 'raise', label: 'Raise budget' }, { id: 'stop', label: 'Stop' }])]);
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'budget.exceeded', source: 'kernel', trust: 'trusted', payload: { why } }, { runId: null, kind: 'approval.requested', source: 'kernel', trust: 'trusted', payload: { approvalId, kind: 'budget' } }] as never);
  }
}
