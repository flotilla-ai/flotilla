import { z } from 'zod';

export const eventSchema = z.object({
  id: z.string().regex(/^evt_/),
  seq: z.number().int().positive(),
  threadId: z.string().regex(/^thr_/),
  runId: z.string().regex(/^run_/).nullable(),
  kind: z.enum([
    'thread.created', 'thread.status', 'run.started', 'run.ended',
    'agent.message', 'agent.delta', 'agent.tool_call', 'agent.tool_result', 'agent.subagent',
    'user.message', 'control.interrupt', 'control.stop',
    'cost.entry', 'budget.warning', 'budget.exceeded',
    'pr.opened', 'pr.pushed', 'ci.failed', 'ci.passed', 'pr.review', 'pr.conflict', 'pr.merged',
    'crew.status', 'approval.requested', 'approval.resolved',
    'machine.state', 'preview.exposed', 'hook.applied', 'hook.rolled_back', 'kernel.denied'
  ]),
  at: z.string().datetime(),
  source: z.enum(['kernel', 'adapter', 'user', 'github', 'captain', 'automation', 'hook']),
  trust: z.enum(['trusted', 'untrusted']),
  payload: z.unknown()
});

export const approvalSchema = z.object({
  id: z.string().regex(/^apr_/),
  threadId: z.string().regex(/^thr_/),
  captainId: z.string().regex(/^thr_/).nullable(),
  kind: z.enum(['conversation', 'decision', 'budget', 'merge', 'environment', 'mcp', 'credential', 'machine', 'hook-change']),
  question: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })),
  blocking: z.boolean(),
  state: z.enum(['open', 'answered', 'dismissed', 'expired']),
  answer: z.object({
    optionId: z.string(),
    value: z.number().int().optional(),
    by: z.string().regex(/^usr_/),
    at: z.string().datetime(),
    note: z.string().optional()
  }).nullable()
});
