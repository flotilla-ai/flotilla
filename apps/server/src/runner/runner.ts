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
import { captainMcpTar } from '../captain/tools/mcpConfig.js';

type Driver = GitDriver & { startThreadContainer(input: Record<string, unknown>): Promise<{ containerId: string }>; stop(id: string): Promise<void> };
type Row = Record<string, unknown>;
const zero = budgetZero;
const add = (a: CostTotals, b: CostTotals): CostTotals => ({ usd: a.usd+b.usd, inputTokens: a.inputTokens+b.inputTokens, outputTokens: a.outputTokens+b.outputTokens, cacheTokens: a.cacheTokens+b.cacheTokens, machineSec: a.machineSec+b.machineSec });
const id = (p: string) => `${p}_${randomBytes(10).toString('base64url')}`;
const budget = (maxUsd: number | null = null) => ({ maxUsd, maxTokens: null, maxWallSec: null, scope: 'thread' as const, onHit: 'pause-and-ask' as const, warnAt: 0.8 });
export type RunnerDeps = { store: EventStore; driver: Driver; adapters: Map<string, AgentAdapter>; secrets?: Record<string,string>; projectFor?(row: Row): Row };
type AfterRun=(input:{thread:Row;project:Row|null;runId:string;state:string;containerId:string;driver:Driver})=>Promise<void>;
const afterRunHooks:AfterRun[]=[];
export function onAfterRun(fn:AfterRun):()=>void{afterRunHooks.push(fn);return()=>{const i=afterRunHooks.indexOf(fn);if(i>=0)afterRunHooks.splice(i,1)}}

export class ThreadRunner {
  readonly running = new Map<string, Promise<void>>();
  readonly queued = new Map<string, string[]>();
  readonly cancelled = new Set<string>();
  readonly containers = new Map<string,string>();
  constructor(readonly deps: RunnerDeps) {}
  get pool() { return this.deps.store.pool; }

  private async owned(threadId: string, userId?: string): Promise<boolean> { if (!userId) return true; const t=await this.thread(threadId); return t?.owner_id===userId; }
  async createThread(input: { ownerId: string; projectId?: string | null; title: string; prompt: string; engine?: Thread['engine']; maxUsd?: number | null; requestId?: string }): Promise<Row> {
    if (input.requestId) {
      const prior = await this.pool.query(`SELECT thread_id FROM events WHERE request_id=$1 AND kind='thread.created' ORDER BY seq LIMIT 1`, [input.requestId]);
      if (prior.rows[0]) { const row=(await this.pool.query('SELECT * FROM threads WHERE id=$1', [prior.rows[0].thread_id])).rows[0]; if(row?.owner_id!==input.ownerId) throw new Error('not found'); return row; }
    }
    if (input.projectId) { const ownedProject=(await this.pool.query('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2',[input.projectId,input.ownerId])).rows[0]; if(!ownedProject) throw new Error('project not found'); }
    const threadId = id('thr'); const code = `FLO-${randomBytes(2).toString('hex').toUpperCase()}`;
    const row = (await this.pool.query(`INSERT INTO threads (id,code,project_id,role,owner_id,title,status,engine,budget,spent) VALUES ($1,$2,$3,'thread',$4,$5,'queued',$6,$7,$8) RETURNING *`, [threadId, code, input.projectId ?? null, input.ownerId, input.title, JSON.stringify(input.engine ?? { adapter: 'fake', model: null, effort: null, connectionId: null }), JSON.stringify(budget(input.maxUsd ?? null)), JSON.stringify(zero)])).rows[0];
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'thread.created', source: 'kernel', trust: 'trusted', payload: scrub({ title: input.title }, this.deps.secrets ?? {}) }, { runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: scrub({ text: input.prompt }, this.deps.secrets ?? {}) }] as never, { requestId: input.requestId });
    this.queued.set(threadId,[input.prompt]);
    void this.startNext(threadId, 'message');
    return row;
  }

  async message(threadId: string, text: string, mode: 'queue' | 'interrupt' = 'queue', userId?: string): Promise<void> {
    const thread = await this.thread(threadId); if (!thread || thread.owner_id!==userId) throw new Error('not found');
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: scrub({ text, mode, by: userId }, this.deps.secrets ?? {}) }] as never);
    if (mode === 'interrupt') await this.interrupt(threadId); else this.queued.set(threadId, [...(this.queued.get(threadId) ?? []), text]);
    if (!this.running.has(threadId)) void this.startNext(threadId, 'message');
  }
  async interrupt(threadId: string, userId?: string): Promise<void> { if (!(await this.owned(threadId,userId))) throw new Error('not found'); this.cancelled.add(threadId); await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'control.interrupt', source: 'user', trust: 'trusted', payload: {} }] as never); }
  async stop(threadId: string, userId?: string): Promise<void> { if (!(await this.owned(threadId,userId))) throw new Error('not found'); this.cancelled.add(threadId); this.queued.delete(threadId); await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: null, kind: 'control.stop', source: 'user', trust: 'trusted', payload: {} }] as never); await this.pool.query(`UPDATE threads SET status='idle',updated_at=now() WHERE id=$1`, [threadId]); }

  async answerApproval(approvalId: string, optionId: string, value: number | undefined, userId: string): Promise<Row | null> {
    const rows = await this.pool.query(`UPDATE approvals SET state='answered',answer=$2 WHERE id=$1 AND state='open' RETURNING *`, [approvalId, JSON.stringify({ optionId, value, by: userId, at: new Date().toISOString() })]);
    const approval = rows.rows[0]; if (!approval) return null;
    if (!(await this.owned(approval.thread_id,userId))) return null;
    if (approval.kind === 'budget' && optionId === 'raise' && value) await this.pool.query(`UPDATE threads SET budget=jsonb_set(budget,'{maxUsd}',to_jsonb($2::int)),status='queued' WHERE id=$1`, [approval.thread_id, value]);
    if (approval.kind === 'budget' && optionId === 'stop') await this.stop(approval.thread_id);
    await this.deps.store.appendEvents(approval.thread_id, [{ runId: null, kind: 'approval.resolved', source: 'kernel', trust: 'trusted', payload: { approvalId, optionId, value } }] as never);
    if (optionId === 'raise') void this.startNext(approval.thread_id, 'resume');
    return approval;
  }

  async startNext(threadId: string, trigger: string): Promise<void> {
    if (this.running.has(threadId)) return;
    const promise = this.run(threadId, trigger).catch(async (_err) => { await this.pool.query(`UPDATE threads SET status='failed' WHERE id=$1`, [threadId]); }).finally(() => this.running.delete(threadId));
    this.running.set(threadId, promise);
    await promise;
    if ((this.queued.get(threadId) ?? []).length && !this.cancelled.has(threadId)) void this.startNext(threadId, 'message');
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
    if (policy.maxUsd !== null) {
      const spent = (thread.spent as CostTotals).usd;
      if (spent >= policy.maxUsd) return this.pauseBudget(threadId, runId, 'budget');
      await this.pool.query('INSERT INTO budget_holds (scope,scope_id,run_id,amount) VALUES ($1,$2,$3,$4)', ['thread', threadId, runId, reserveAmount]);
    }

    const project = await this.project(thread);
    const tokenService = thread.role === 'captain' ? getRunTokenService() : null;
    const runToken = tokenService?.issue(runId, threadId);
    let machine = { containerId: thread.role === 'captain' ? '' : this.containers.get(threadId) ?? '' };
    if (!machine.containerId) {
      machine = await this.deps.driver.startThreadContainer({ threadId, code: thread.code, image: 'flotilla-thread:dev', cpus: 1, memMb: 512, env: runToken ? { FLOTILLA_MCP_TOKEN: runToken.token } : {}, roMounts: [], egressAllow: project?.egress_allow as string[] ?? [] }).catch((err) => { tokenService?.endRun(runId); throw err; });
      this.containers.set(threadId, machine.containerId);
      if (project && !thread.branch) {
        const seeded = await seedWorkspace({ id: threadId as never, code: thread.code as string, title: thread.title as string, branch: thread.branch as string | null, containerId: machine.containerId }, { id: project.id as never, repo: project.repo as never, trust: project.trust as never }, this.deps.driver).catch(() => ({ branch: null }));
        if (seeded.branch && seeded.branch !== thread.branch) await this.pool.query('UPDATE threads SET branch=$2 WHERE id=$1', [threadId, seeded.branch]);
        thread.branch = seeded.branch ?? thread.branch;
      }
    }
    if (runToken && 'copyIn' in this.deps.driver) await (this.deps.driver as Driver & {copyIn(id:string,dir:string,tar:Buffer):Promise<void>}).copyIn(machine.containerId, '/run', captainMcpTar(runToken.token)).catch(() => undefined);
    const adapter = this.deps.adapters.get((thread.engine as Row).adapter as string) ?? [...this.deps.adapters.values()][0];
    if (!adapter) { tokenService?.endRun(runId); throw new Error('adapter missing'); }
    let transport: ReturnType<Driver['transport']>;
    try { transport = this.deps.driver.transport(machine.containerId); } catch (err) { tokenService?.endRun(runId); throw err; }
    let usage = { ...zero }; let state: 'completed' | 'cancelled' | 'failed' | 'paused_budget' = 'completed'; const started = Date.now();
    const eventSecrets = { ...(this.deps.secrets ?? {}), ...(runToken ? { FLOTILLA_MCP_TOKEN: runToken.token } : {}) };
    const scrubber = createDeltaScrubber(eventSecrets);
    let stream: AsyncIterable<AdapterEvent>;
    try { stream = adapter.start({ runId: runId as never, threadId: threadId as never, prompt: (this.queued.get(threadId) ?? []).shift() ?? '', cwd: '/workspace/repo', env: {}, transport, resumeSessionId: null, vendorBudget: { maxMicroUsd: policy.maxUsd }, auth: { kind: 'none' }, mcpConfigPath: runToken ? '/run/flotilla/mcp.json' : null, images: [] } as never); } catch (err) { tokenService?.endRun(runId); throw err; }
    try {
      for await (const event of stream) {
        if (this.cancelled.has(threadId)) { state = 'cancelled'; await adapter.cancel(runId as never).catch(() => undefined); break; }
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
        if (event.t === 'done' && event.stopReason === 'error') state = 'failed';
        if (event.t === 'done' && event.stopReason === 'cancelled' && state === 'completed') state = 'cancelled';
      }
      const tail = scrubber.flush(); if (tail) await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'agent.delta', source: 'adapter', trust: 'trusted', payload: { text: tail } }] as never);
    } finally {
      tokenService?.endRun(runId);
      await this.pool.query('DELETE FROM budget_holds WHERE run_id=$1', [runId]);
      await this.pool.query('UPDATE runs SET state=$2,ended_at=now(),usage=$3 WHERE id=$1', [runId, state, JSON.stringify(usage)]);
      await this.pool.query(`UPDATE threads SET status=$2,updated_at=now() WHERE id=$1`, [threadId, state === 'paused_budget' ? 'paused' : state === 'completed' ? 'waiting' : state === 'cancelled' ? 'idle' : 'failed']);
      await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'run.ended', source: 'kernel', trust: 'trusted', payload: { state, usage } }] as never);
      for (const hook of afterRunHooks) await hook({ thread, project, runId, state, containerId: machine.containerId, driver: this.deps.driver }).catch(() => undefined);
      this.cancelled.delete(threadId);
    }
  }
  private async adapterEvent(threadId: string, runId: string, event: AdapterEvent, scrubber: ReturnType<typeof createDeltaScrubber>, eventSecrets: Record<string,string> = this.deps.secrets ?? {}): Promise<void> {
    if (event.t === 'text') { const out = scrubber.push(event.delta); if (out) await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'agent.delta', source: 'adapter', trust: 'trusted', payload: { text: out } }] as never); return; }
    const kind = event.t === 'tool_call' ? 'agent.tool_call' : event.t === 'tool_result' ? 'agent.tool_result' : event.t === 'done' ? null : null;
    if (kind) await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind, source: 'adapter', trust: 'trusted', payload: scrub(event, eventSecrets) }] as never);
  }
  private async pauseBudget(threadId: string, runId: string, why: string): Promise<void> {
    const approvalId = id('apr');
    await this.pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,'budget',$3,$4,true,'open') ON CONFLICT DO NOTHING`, [approvalId, threadId, `Budget cap reached (${why}); raise the cap or stop`, JSON.stringify([{ id: 'raise', label: 'Raise budget' }, { id: 'stop', label: 'Stop' }])]);
    await this.pool.query(`UPDATE threads SET status='paused',needs_you=$2 WHERE id=$1`, [threadId, JSON.stringify([approvalId])]);
    await this.deps.store.appendEvents(threadId as Thread['id'], [{ runId: runId as never, kind: 'budget.exceeded', source: 'kernel', trust: 'trusted', payload: { why } }, { runId: null, kind: 'approval.requested', source: 'kernel', trust: 'trusted', payload: { approvalId, kind: 'budget' } }] as never);
  }
}
