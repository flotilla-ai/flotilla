import { describe, expect, it } from 'vitest';
import type { BudgetState, CostTotals } from '../types.js';
import { checkBudget, inRunFence, meter, reserve, settle } from './budget.js';
import { placeholderPriceTable } from './priceTable.js';

const totals = (usd: number): CostTotals => ({ usd, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0 });
const state = (scope: BudgetState['scope'], maxUsd: number, spent = 0, reserved = 0): BudgetState => ({
  scope, scopeId: scope === 'thread' ? 'thr_t' : scope, policy: { maxUsd, maxTokens: null, maxWallSec: null, scope, onHit: 'pause-and-ask', warnAt: 0.8 }, spent: totals(spent), reserved
});
const ctx = { threadId: 'thr_t' as const, captainId: 'thr_c' as const, runId: 'run_r' as const };

describe('budget kernel', () => {
  it('warns at 80% and pauses at 100% with raise/stop approval options', () => {
    expect(checkBudget([state('thread', 100, 80)], ctx)).toMatchObject({ action: 'warn' });
    const hit = checkBudget([state('thread', 100, 100)], ctx);
    expect(hit).toMatchObject({ action: 'pause', approval: { blocking: true, kind: 'budget' } });
    if (hit.action === 'pause') expect(hit.approval.options.map((o) => o.id)).toEqual(['raise', 'stop']);
  });

  it('captain subtree cap trips even when each thread is under its own cap', () => {
    const hit = checkBudget([state('thread', 100, 10), state('captain-subtree', 100, 100)], ctx);
    expect(hit).toMatchObject({ action: 'pause', scope: { scope: 'captain-subtree' } });
  });

  it('uses integer micro-USD and counts cumulative usage once', () => {
    const first = meter({ threadId: ctx.threadId, runId: ctx.runId, at: new Date(0).toISOString() }, totals(0), { t: 'usage', usdMicro: 20000, cumulative: true }, null, placeholderPriceTable);
    expect(first.entry.delta.usd).toBe(20000);
    const second = meter({ threadId: ctx.threadId, runId: ctx.runId, at: new Date(1).toISOString() }, first.next, { t: 'usage', usdMicro: 20000, cumulative: true }, null, placeholderPriceTable);
    expect(second.entry.delta.usd).toBe(0);
    expect(Number.isInteger(second.next.usd)).toBe(true);
  });

  it('reserves the smaller remaining amount and only fails with no positive balance', () => {
    const result = reserve([state('thread', 100, 0, 0), state('captain-subtree', 100, 0, 90)], 20, ctx);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.holds.find((h) => h.scope === 'captain-subtree')?.amount).toBe(10);
    expect(reserve([state('captain-subtree', 100, 0, 100)], 20, ctx)).toMatchObject({ ok: false, scope: { scope: 'captain-subtree' } });
  });

  it('settles overshoot and enforces wall clock fence', () => {
    expect(settle([{ scope: 'thread', scopeId: 'thr_t', runId: ctx.runId, amount: 20 }, { scope: 'captain-subtree', scopeId: 'thr_c', runId: ctx.runId, amount: 10 }], totals(15))).toEqual({ overshoot: 5 });
    const policy = { maxUsd: null, maxTokens: null, maxWallSec: 10, scope: 'thread' as const, onHit: 'pause-and-ask' as const, warnAt: 0.8 };
    expect(inRunFence({ estimate: totals(0), wallSec: 10, hold: { scope: 'thread', scopeId: 'thr_t', runId: ctx.runId, amount: 10 }, policy })).toEqual({ stop: 'wall' });
  });
});
