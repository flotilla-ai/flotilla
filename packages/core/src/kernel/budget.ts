import type { AdapterEvent, Approval, BudgetPolicy, BudgetState, CostEntry, CostTotals, Hold, MicroUsd } from '../types.js';
import type { PriceTable } from './priceTable.js';

type Usage = Extract<AdapterEvent, { t: 'usage' }>;

const zero: CostTotals = { usd: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, machineSec: 0 };

function add(a: CostTotals, b: CostTotals): CostTotals {
  return {
    usd: a.usd + b.usd,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheTokens: a.cacheTokens + b.cacheTokens,
    machineSec: a.machineSec + b.machineSec
  };
}

function nonneg(n: number): number {
  return Math.max(0, Math.trunc(n));
}

function approval(threadId: Approval['threadId'], captainId: Approval['captainId'], question: string): Omit<Approval, 'id'> {
  return {
    threadId,
    captainId,
    kind: 'budget',
    question,
    options: [
      { id: 'raise', label: 'Raise budget' },
      { id: 'stop', label: 'Stop' }
    ],
    blocking: true,
    state: 'open',
    answer: null
  };
}

export function meter(
  ctx: { threadId: CostEntry['threadId']; runId: CostEntry['runId']; at: string },
  prev: CostTotals,
  usage: Usage,
  model: string | null,
  priceTable: PriceTable
): { entry: CostEntry; next: CostTotals } {
  const current: CostTotals = {
    usd: usage.usdMicro ?? 0,
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheTokens: usage.cacheTokens ?? 0,
    machineSec: 0
  };
  const raw: CostTotals = usage.cumulative
    ? {
        usd: nonneg(current.usd - prev.usd),
        inputTokens: nonneg(current.inputTokens - prev.inputTokens),
        outputTokens: nonneg(current.outputTokens - prev.outputTokens),
        cacheTokens: nonneg(current.cacheTokens - prev.cacheTokens),
        machineSec: 0
      }
    : current;
  let delta: CostTotals;
  let source: CostEntry['source'];
  if (usage.usdMicro !== undefined) {
    delta = { ...raw };
    source = 'vendor-usd';
  } else {
    const prices = priceTable.models[usage.model ?? model ?? 'default'] ?? priceTable.models.default;
    const usd = Math.trunc(
      (raw.inputTokens * prices.inputPerMillionMicro +
        raw.outputTokens * prices.outputPerMillionMicro +
        raw.cacheTokens * prices.cachePerMillionMicro) / 1_000_000
    );
    delta = { ...raw, usd };
    source = 'token-estimate';
  }
  const next = usage.cumulative
    ? { ...add(prev, delta), machineSec: prev.machineSec }
    : add(prev, delta);
  return {
    entry: {
      threadId: ctx.threadId,
      runId: ctx.runId,
      at: ctx.at,
      source,
      model: usage.model ?? model,
      delta,
      priceTableVersion: priceTable.version
    },
    next
  };
}

function remaining(state: BudgetState): number {
  if (state.policy.maxUsd === null) return Number.POSITIVE_INFINITY;
  return state.policy.maxUsd - state.spent.usd - state.reserved;
}

export function reserve(
  tree: BudgetState[],
  perRunReserve: MicroUsd,
  ctx: { threadId: Approval['threadId']; captainId: Approval['captainId']; runId: Hold['runId'] }
): { ok: true; holds: Hold[] } | { ok: false; scope: BudgetState; approval: Omit<Approval, 'id'> } {
  for (const scope of tree) {
    if (remaining(scope) < perRunReserve) {
      return {
        ok: false,
        scope,
        approval: approval(ctx.threadId, ctx.captainId, `Budget cap reached for ${scope.scope}; raise the cap or stop`)
      };
    }
  }
  return {
    ok: true,
    holds: tree.filter((scope) => scope.policy.maxUsd !== null).map((scope) => ({
      scope: scope.scope,
      scopeId: scope.scopeId,
      runId: ctx.runId,
      amount: perRunReserve
    }))
  };
}

export function settle(holds: Hold[], actual: CostTotals): { overshoot: MicroUsd } {
  const reserved = holds.reduce((max, hold) => Math.max(max, hold.amount), 0);
  return { overshoot: Math.max(0, actual.usd - reserved) };
}

export function inRunFence(input: { estimate: CostTotals; wallSec: number; hold: Hold; policy: BudgetPolicy }): 'continue' | { stop: 'usd' | 'tokens' | 'wall' } {
  if (input.policy.maxWallSec !== null && input.wallSec >= input.policy.maxWallSec) return { stop: 'wall' };
  if (input.estimate.usd >= input.hold.amount) return { stop: 'usd' };
  const tokens = input.estimate.inputTokens + input.estimate.outputTokens + input.estimate.cacheTokens;
  if (input.policy.maxTokens !== null && tokens >= input.policy.maxTokens) return { stop: 'tokens' };
  return 'continue';
}

export function checkBudget(
  tree: BudgetState[],
  ctx: { threadId: Approval['threadId']; captainId: Approval['captainId'] }
): { action: 'ok' } | { action: 'warn'; scope: BudgetState } | { action: 'pause'; scope: BudgetState; approval: Omit<Approval, 'id'> } {
  let warning: BudgetState | null = null;
  for (const scope of tree) {
    if (scope.policy.maxUsd === null) continue;
    const used = scope.spent.usd + scope.reserved;
    if (used >= scope.policy.maxUsd) {
      return {
        action: 'pause',
        scope,
        approval: approval(ctx.threadId, ctx.captainId, `Budget cap reached for ${scope.scope}; raise the cap or stop`)
      };
    }
    if (used / scope.policy.maxUsd >= scope.policy.warnAt) warning ??= scope;
  }
  return warning ? { action: 'warn', scope: warning } : { action: 'ok' };
}

export const budgetZero = zero;
