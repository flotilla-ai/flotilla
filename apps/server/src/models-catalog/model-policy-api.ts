import { randomBytes } from 'node:crypto';
import { ApiFailure } from '../api-platform/types.js';
import { modelsCatalogStore, type ModelsCatalogStore } from './store.js';
import type { Connection, ModelBadge, ModelListItem, ModelSelection, ResolvedSelection } from './types.js';

type Row = Record<string, any>;
export type RunOutOutcome = { switchedTo: string } | { approvalId: string };
const badge = (k: Connection['kind']): ModelBadge => (k === 'subscription' ? 'subscription' : k === 'free' ? 'free' : 'key');

/** Model list, background-model resolution and the run-out policy (pause and ask by default). */
export class ModelPolicyApi {
  constructor(readonly store: ModelsCatalogStore = modelsCatalogStore()) {}

  /** CAPY-336/484: one row per adapter:model across the user's usable connections, connections listed in run order. */
  async models(userId: string): Promise<ModelListItem[]> {
    const rows = new Map<string, ModelListItem>();
    for (const c of await this.store.candidates(userId)) for (const model of c.models) {
      const id = `${c.adapter}:${model}`;
      const e = this.store.catalog.models.find((m) => m.adapter === c.adapter && m.model === model);
      const row = rows.get(id) ?? { id, adapter: c.adapter, model, displayName: e?.displayName ?? model, contextWindow: e?.contextWindow ?? null, efforts: e?.efforts ?? [], free: e?.free ?? false, zdr: e?.zdr ?? false, connections: [] };
      row.connections.push({ id: c.id, label: c.label, badge: badge(c.kind) });
      rows.set(id, row);
    }
    return [...rows.values()];
  }

  /** CAPY-338: background requests (titles, summaries) use the user's background model, else the thread's own; never a hosted account. */
  async background(userId: string, threadEngine: unknown): Promise<ResolvedSelection> {
    const sel = (await this.store.policy(userId)).background ?? threadEngine;
    if (!sel) throw new ApiFailure('ValidationFailed', 'no background model: set one in your model policy or pass the thread engine');
    return this.store.resolve(userId, sel);
  }

  /** The next connection after the thread's current one in run order offering the same model, else the free models; never wraps around. */
  private async next(ownerId: string, engine: ModelSelection): Promise<{ connection: Connection; engine: ModelSelection } | null> {
    const order = await this.store.candidates(ownerId);
    const after = order.slice(order.findIndex((c) => c.id === engine.connectionId) + 1);
    const same = after.find((c) => c.adapter === engine.adapter && (!engine.model || c.models.includes(engine.model)));
    if (same) return { connection: same, engine: { ...engine, connectionId: same.id } };
    const free = after.find((c) => c.kind === 'free');
    return free ? { connection: free, engine: { adapter: free.adapter, model: null, effort: null, connectionId: free.id } } : null;
  }

  /** CAPY-333: called when a run ends with `run_out`. Switches per policy, otherwise opens a Wait/Use card. */
  async onRunOut(threadId: string): Promise<RunOutOutcome> {
    const [t] = await this.store.q('SELECT owner_id, engine FROM threads WHERE id=$1', [threadId]);
    const policy = await this.store.policy(t.owner_id);
    const next = await this.next(t.owner_id, t.engine);
    if (next && (policy.runOut === 'keep-going' || (policy.runOut === 'ask-before-free' && next.connection.kind !== 'free'))) {
      await this.store.q('UPDATE threads SET engine=$2 WHERE id=$1', [threadId, JSON.stringify(next.engine)]);
      return { switchedTo: next.connection.id };
    }
    const approvalId = `apr_${randomBytes(10).toString('base64url')}`;
    const options = [{ id: 'wait', label: 'Wait' }, ...(next ? [{ id: 'use', label: `Use ${next.connection.label}`, engine: next.engine }] : [])];
    await this.store.q(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,'run-out',$3,$4,true,'open')`,
      [approvalId, threadId, `${t.engine.adapter}${t.engine.model ? `:${t.engine.model}` : ''} ran out on its connection; wait for it to reset${next ? ` or use ${next.connection.label}` : ''}`, JSON.stringify(options)]);
    await this.store.q(`UPDATE threads SET needs_you=needs_you || $2::jsonb WHERE id=$1`, [threadId, JSON.stringify([approvalId])]);
    return { approvalId };
  }

  /** Answering `use` re-pins the thread to the offered connection (re-resolved, so a since-disabled connection fails). */
  async answer(approval: Row, optionId: string): Promise<void> {
    await this.store.q(`UPDATE threads SET needs_you=needs_you - $2::text WHERE id=$1`, [approval.thread_id, approval.id]);
    if (optionId !== 'use') return;
    const opt = (approval.options as Row[]).find((o) => o.id === 'use');
    if (!opt) throw new ApiFailure('ValidationFailed', 'no connection to continue on');
    const [t] = await this.store.q('SELECT owner_id FROM threads WHERE id=$1', [approval.thread_id]);
    const r = await this.store.resolve(t.owner_id, opt.engine);
    await this.store.q('UPDATE threads SET engine=$2 WHERE id=$1', [approval.thread_id, JSON.stringify({ adapter: r.adapter, model: r.model, effort: r.effort, connectionId: r.connectionId, ...(r.contextWindow ? { contextWindow: r.contextWindow } : {}) })]);
  }

  /** `/wait` and `/continue` typed into the thread answer its open run-out card. */
  async slash(threadId: string, userId: string, text: string): Promise<{ approvalId: string; optionId: 'wait' | 'use' } | null> {
    const cmd = text.trim();
    if (cmd !== '/wait' && cmd !== '/continue') return null;
    const [a] = await this.store.q(`SELECT a.id, a.options FROM approvals a JOIN threads t ON t.id=a.thread_id WHERE a.thread_id=$1 AND t.owner_id=$2 AND a.kind='run-out' AND a.state='open' ORDER BY a.id DESC LIMIT 1`, [threadId, userId]);
    if (!a) throw new ApiFailure('NotFound', 'no open run-out card on this thread');
    if (cmd === '/continue' && !(a.options as Row[]).some((o) => o.id === 'use')) throw new ApiFailure('ValidationFailed', 'no connection to continue on');
    return { approvalId: a.id, optionId: cmd === '/wait' ? 'wait' : 'use' };
  }
}

let api: ModelPolicyApi | null = null;
export const modelPolicyApi = () => (api ??= new ModelPolicyApi());
