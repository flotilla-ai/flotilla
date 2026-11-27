import { KernelDenied } from '@flotilla/core/types';
import { crewLimitCheck } from '@flotilla/core/kernel/crewLimits';
import type pg from 'pg';
import type { RunTokenService } from './tokens.js';

type RunnerLike = { createThread(input: Record<string, unknown>): Promise<Record<string, unknown>>; message(threadId: string, text: string, mode?: 'queue' | 'interrupt'): Promise<void> };
export type CaptainToolDeps = { pool: pg.Pool; tokens: RunTokenService; runner: RunnerLike };
const zero = { usd: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0 };
function json(value: unknown) { return { content: [{ type: 'text', text: JSON.stringify(value) }] }; }
export class CaptainToolService {
  private readonly starts = new Map<string, Promise<unknown>>();
  constructor(readonly deps: CaptainToolDeps) {}
  async call(authToken: string | undefined, name: string, args: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
    if (!authToken) return { status: 401, body: { error: 'token required' } };
    const auth = this.deps.tokens.authenticate(authToken);
    if (!auth) return { status: 401, body: { error: 'expired token' } };
    if (name === 'crew.start') {
      const prior = this.starts.get(auth.captainId) ?? Promise.resolve(null);
      const next = prior.catch(() => undefined).then(async () => {
        const still = this.deps.tokens.authenticate(authToken);
        if (!still || still.runId !== auth.runId) return { status: 401, body: { error: 'expired token' } };
        return this.execute(auth.captainId, name, args);
      });
      this.starts.set(auth.captainId, next);
      return next;
    }
    return this.execute(auth.captainId, name, args);
  }
  private async execute(captainId: string, name: string, args: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
    try { return { status: 200, body: json(await this.dispatch(captainId, name, args)) }; }
    catch (err) {
      if (err instanceof KernelDenied) { await this.recordDenied(captainId, name, err); return { status: 403, body: { error: err.message, rule: err.rule } }; }
      throw err;
    }
  }
  private async recordDenied(captainId: string, name: string, err: KernelDenied): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const seq = Number((await this.deps.pool.query('SELECT coalesce(max(seq),0)+1 n FROM events WHERE thread_id=$1', [captainId])).rows[0]?.n ?? 1);
      try {
        await this.deps.pool.query(
          `WITH allocated AS (UPDATE event_order SET next_pos=next_pos+1 WHERE id=true RETURNING next_pos-1 AS pos)
           INSERT INTO events (id,thread_id,seq,kind,source,trust,payload,pos)
           SELECT $1,$2,$3,'kernel.denied','kernel','trusted',$4,allocated.pos FROM allocated`,
          [`evt_${Math.random().toString(16).slice(2)}`, captainId, seq, JSON.stringify({ rule: err.rule, detail: err.detail, tool: name })]
        );
        return;
      }
      catch { if (attempt === 2) return; }
    }
  }
  private async dispatch(captainId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === 'crew.start') return this.crewStart(captainId, args);
    if (name === 'crew.message') { const owned = (await this.deps.pool.query('SELECT 1 FROM threads WHERE id=$1 AND crew_of=$2', [args.threadId, captainId])).rows[0]; if (!owned) throw new KernelDenied('crew-limit', 'thread is not in this captain crew'); await this.deps.runner.message(String(args.threadId), String(args.text ?? ''), 'queue'); return { ok: true }; }
    if (name === 'crew.release') { const out = await this.deps.pool.query('UPDATE threads SET crew_of=null WHERE id=$1 AND crew_of=$2', [args.threadId, captainId]); if ((out as { rowCount?: number }).rowCount === 0) throw new KernelDenied('crew-limit', 'thread is not in this captain crew'); return { ok: true }; }
    if (name === 'digest.write') { await this.deps.pool.query('UPDATE captains SET digest_md=$2 WHERE thread_id=$1', [captainId, String(args.md ?? '')]); return { ok: true }; }
    if (name === 'ask.human') return this.askHuman(captainId, args);
    throw new Error(`unknown tool ${name}`);
  }
  private async crewStart(captainId: string, args: Record<string, unknown>): Promise<unknown> {
    const captain = (await this.deps.pool.query('SELECT * FROM threads WHERE id=$1 AND role=$2', [captainId, 'captain'])).rows[0];
    if (!captain) throw new KernelDenied('crew-limit', 'captain not found');
    const active = Number((await this.deps.pool.query(`SELECT count(*)::int n FROM threads WHERE crew_of=$1 AND status IN ('queued','working','paused')`, [captainId])).rows[0]?.n ?? 0);
    const meta = (await this.deps.pool.query('SELECT * FROM captains WHERE thread_id=$1', [captainId])).rows[0] ?? {}; const maxCrew = meta.max_concurrent_crew ?? 5;
    const policy = captain.budget ?? {}; const spent = captain.spent ?? zero;
    const requestedInput = args.budget == null ? null : Number(args.budget);
    const remaining = policy.maxUsd == null ? (requestedInput ?? 0) : Math.max(0, Number(policy.maxUsd) - Number(spent.usd ?? 0));
    const requested = requestedInput == null ? remaining : Math.min(requestedInput, remaining);
    crewLimitCheck({ active, max: maxCrew, subtreeRemaining: remaining, requested, sameProject: true, alreadyCrew: false });
    if (policy.maxUsd !== null && requested <= 0) { const approvalId = `apr_${Math.random().toString(16).slice(2)}`; await this.deps.pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,'budget','Captain subtree budget exhausted','[]',true,'open')`, [approvalId, captainId]); throw new KernelDenied('budget', 'captain subtree budget exhausted'); }
    const thread = await this.deps.runner.createThread({ ownerId: captain.owner_id, projectId: captain.project_id, title: String(args.title ?? 'Crew thread'), prompt: String(args.brief ?? ''), engine: args.engine as never, maxUsd: requestedInput == null && policy.maxUsd == null ? null : requested });
    await this.deps.pool.query('UPDATE threads SET crew_of=$2,parent_id=$2 WHERE id=$1', [String(thread.id), captainId]);
    return { threadId: String(thread.id) };
  }
  private async askHuman(captainId: string, args: Record<string, unknown>): Promise<unknown> {
    const id = `apr_${Math.random().toString(16).slice(2)}`;
    await this.deps.pool.query('INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,$3,$4,$5,true,$6)', [id, captainId, String(args.kind ?? 'decision'), String(args.question ?? ''), JSON.stringify(args.options ?? []), 'open']);
    return { approvalId: id };
  }
}
