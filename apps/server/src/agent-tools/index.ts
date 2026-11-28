import { KernelDenied } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';
import type { Subagent, SubagentDraft } from '../subagent-core/types.js';

type Row = Record<string, any>;
export type AgentToolRunner = { createThread(input: Record<string, unknown>): Promise<Record<string, unknown>>; message(threadId: string, text: string, mode?: 'queue' | 'interrupt', userId?: string): Promise<unknown> };
export type AgentToolDeps = {
  runner: AgentToolRunner;
  environments?: { tool(threadId: string, projectId: string, name: string, args: Record<string, unknown>, machine: () => unknown): Promise<unknown> };
  mcp?: { propose(userId: string, threadId: string, args: Record<string, unknown>): Promise<unknown> };
  subagents?: { create(parentId: string, userId: string, draft: SubagentDraft): Promise<Subagent>; start(id: string, userId: string): Promise<Subagent> };
  resolveEngine?: (userId: string, engine: Record<string, unknown>) => Promise<Record<string, unknown>>;
};
export const agentToolNames = ['sibling.create', 'sibling.message', 'captain.create', 'environment.read', 'environment.replace', 'mcp.propose'] as const;
export const agentToolSchemas: Record<string, unknown> = {
  'sibling.create': { type: 'object', properties: { title: { type: 'string' }, prompt: { type: 'string' }, placement: { type: 'string', enum: ['fresh', 'shared'] }, mode: { type: 'string', enum: ['parallel'] }, paths: { type: 'array', items: { type: 'string' } }, maxUsd: { type: 'number', exclusiveMinimum: 0 } }, required: ['title'] },
  'sibling.message': { type: 'object', properties: { threadId: { type: 'string' }, text: { type: 'string' } }, required: ['threadId', 'text'] },
  'captain.create': { type: 'object', properties: { name: { type: 'string' }, prompt: { type: 'string' }, maxUsd: { type: 'number', exclusiveMinimum: 0 }, engine: { type: 'object', properties: { adapter: { type: 'string' }, model: { type: 'string' }, effort: { type: 'string' }, connectionId: { type: 'string' } } } }, required: ['name'] },
  'environment.read': { type: 'object', properties: {} },
  'environment.replace': { type: 'object', properties: { baseVersion: { type: 'integer' }, spec: { type: 'object' } }, required: ['baseVersion', 'spec'] },
  'mcp.propose': { type: 'object', properties: { action: { type: 'string' }, server: { type: 'object' }, serverId: { type: 'string' } }, required: ['action'] }
};

/** Run-token tools available to ordinary thread agents; integration into the built-in MCP endpoint stays in captain/tools. */
export async function handleAgentTool(self: Row, threadId: string, name: string, args: Record<string, unknown>, deps: AgentToolDeps, query: (sql: string, params: unknown[]) => Promise<{ rows: Row[] }>): Promise<{ handled: boolean; result?: unknown }> {
  if (!(agentToolNames as readonly string[]).includes(name)) return { handled: false };
  if (name === 'sibling.create') {
    if (self.role === 'captain' || !self.parent_id) throw new KernelDenied('scope', 'sibling tools require a non-Captain child thread');
    if (!deps.subagents) throw new KernelDenied('scope', 'subagents are not configured');
    if (args.placement !== undefined && !['fresh', 'shared'].includes(String(args.placement))) throw new ApiFailure('ValidationFailed', 'placement must be fresh or shared');
    if (args.mode !== undefined && args.mode !== 'parallel') throw new ApiFailure('ValidationFailed', 'agent-created siblings must use parallel mode');
    const draft = await deps.subagents.create(String(self.parent_id), String(self.owner_id), {
      title: String(args.title ?? 'Sibling thread'), prompt: String(args.prompt ?? args.title ?? 'Sibling thread'),
      placement: args.placement === 'shared' ? 'shared' : 'fresh', mode: 'parallel',
      ...(Array.isArray(args.paths) ? { paths: args.paths.map(String) } : {}), ...(args.engine && typeof args.engine === 'object' ? { engine: args.engine as SubagentDraft['engine'] } : {}),
      ...(args.maxUsd == null ? {} : { maxUsd: Number(args.maxUsd) })
    });
    const started = await deps.subagents.start(String(draft.id), String(self.owner_id));
    return { handled: true, result: { threadId: String(started.id), parentId: String(started.parentId), state: started.state } };
  }
  if (name === 'sibling.message') {
    if (!deps.subagents) throw new KernelDenied('scope', 'subagents are not configured');
    const target = (await query('SELECT s.thread_id,s.parent_id,s.started_at,t.owner_id FROM subagents s JOIN threads t ON t.id=s.thread_id WHERE s.thread_id=$1', [String(args.threadId ?? '')])).rows[0] as Row | undefined;
    const sameParent = target?.parent_id && target.parent_id === self.parent_id;
    if (!target || target.owner_id !== self.owner_id || !sameParent || !target.started_at) throw new KernelDenied('scope', 'thread is not a started sibling owned by this user');
    const text = String(args.text ?? '').trim();
    if (!text) throw new ApiFailure('ValidationFailed', 'text is required');
    await deps.runner.message(String(args.threadId), String(args.text ?? ''), 'queue');
    return { handled: true, result: { ok: true } };
  }
  if (name === 'captain.create') {
    const title = String(args.name ?? '').trim();
    if (!title) throw new ApiFailure('ValidationFailed', 'name is required');
    const base = (self.engine ?? {}) as Row;
    const override = args.engine && typeof args.engine === 'object' && !Array.isArray(args.engine) ? args.engine as Row : {};
    const same = !override.adapter || override.adapter === base.adapter;
    const modelChanged = override.model !== undefined && override.model !== base.model;
    const requested: Row = { adapter: override.adapter ?? base.adapter, model: override.model ?? (same ? base.model : null), effort: override.effort ?? (same && !modelChanged ? base.effort : null), connectionId: override.connectionId ?? (same ? base.connectionId : null), ...(base.contextWindow || override.contextWindow ? { contextWindow: override.contextWindow ?? base.contextWindow } : {}) };
    const engine = deps.resolveEngine ? await deps.resolveEngine(String(self.owner_id), requested) : requested;
    if (args.maxUsd !== undefined && args.maxUsd !== null && !(typeof args.maxUsd === 'number' && args.maxUsd > 0)) throw new ApiFailure('ValidationFailed', 'maxUsd must be positive');
    const prompt = String(args.prompt ?? `You are Captain ${title}.`);
    const thread = await deps.runner.createThread({ ownerId: self.owner_id, projectId: self.project_id, title, prompt, engine: engine as never, maxUsd: args.maxUsd == null ? null : Number(args.maxUsd), draft: true });
    await query(`WITH u AS (UPDATE threads SET role='captain',updated_at=now() WHERE id=$1 RETURNING id) INSERT INTO captains (thread_id,purpose,crew_runs_on,max_concurrent_crew,digest_md,wake_policy) SELECT u.id,$2,'pool',5,'',$3 FROM u ON CONFLICT (thread_id) DO NOTHING`, [String(thread.id), title, JSON.stringify({ heartbeatSec: [600, 7200], coalesceSec: 30 })]);
    await deps.runner.message(String(thread.id), prompt, 'queue');
    return { handled: true, result: { captainId: String(thread.id), ownerId: self.owner_id } };
  }
  if (name === 'environment.read' || name === 'environment.replace') {
    if (!deps.environments) throw new KernelDenied('scope', 'environment tools are not configured');
    if (!self.project_id || (args.projectId !== undefined && args.projectId !== self.project_id)) throw new KernelDenied('scope', 'environment tools are limited to the calling thread project');
    return { handled: true, result: await deps.environments.tool(threadId, self.project_id, name, args, () => { throw new KernelDenied('scope', 'machine unavailable') }) };
  }
  if (!deps.mcp) throw new KernelDenied('scope', 'MCP proposals are not configured');
  return { handled: true, result: await deps.mcp.propose(self.owner_id, threadId, args) };
}
