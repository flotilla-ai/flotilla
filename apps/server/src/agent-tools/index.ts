import { KernelDenied } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';

type Row = Record<string, any>;
export type AgentToolRunner = { createThread(input: Record<string, unknown>): Promise<Record<string, unknown>>; message(threadId: string, text: string, mode?: 'queue' | 'interrupt'): Promise<unknown> };
export type AgentToolDeps = {
  runner: AgentToolRunner;
  environments?: { tool(threadId: string, projectId: string, name: string, args: Record<string, unknown>, machine: () => unknown): Promise<unknown> };
  mcp?: { propose(userId: string, threadId: string, args: Record<string, unknown>): Promise<unknown> };
};
export const agentToolNames = ['sibling.create', 'sibling.message', 'captain.create', 'environment.read', 'environment.replace', 'mcp.propose'] as const;
export const agentToolSchemas: Record<string, unknown> = {
  'sibling.create': { type: 'object', properties: { title: { type: 'string' }, prompt: { type: 'string' } }, required: ['title'] },
  'sibling.message': { type: 'object', properties: { threadId: { type: 'string' }, text: { type: 'string' } }, required: ['threadId', 'text'] },
  'captain.create': { type: 'object', properties: { name: { type: 'string' }, prompt: { type: 'string' } }, required: ['name'] },
  'environment.read': { type: 'object', properties: {} },
  'environment.replace': { type: 'object', properties: { baseVersion: { type: 'integer' }, spec: { type: 'object' } }, required: ['baseVersion', 'spec'] },
  'mcp.propose': { type: 'object', properties: { action: { type: 'string' }, server: { type: 'object' }, serverId: { type: 'string' } }, required: ['action'] }
};

/** Run-token tools available to ordinary thread agents; integration into the built-in MCP endpoint stays in captain/tools. */
export async function handleAgentTool(self: Row, threadId: string, name: string, args: Record<string, unknown>, deps: AgentToolDeps, query: (sql: string, params: unknown[]) => Promise<{ rows: Row[] }>): Promise<{ handled: boolean; result?: unknown }> {
  if (!(agentToolNames as readonly string[]).includes(name)) return { handled: false };
  if (name === 'sibling.create') {
    if (self.role === 'captain' || !self.parent_id) throw new KernelDenied('scope', 'sibling tools require a non-Captain child thread');
    const thread = await deps.runner.createThread({ ownerId: self.owner_id, projectId: self.project_id, parentId: self.parent_id, title: String(args.title ?? 'Sibling thread'), prompt: String(args.prompt ?? args.title ?? 'Sibling thread'), engine: args.engine as never, maxUsd: args.maxUsd == null ? null : Number(args.maxUsd) });
    return { handled: true, result: { threadId: String(thread.id), parentId: self.parent_id ?? null } };
  }
  if (name === 'sibling.message') {
    const target = (await query('SELECT owner_id,parent_id FROM threads WHERE id=$1', [String(args.threadId ?? '')])).rows[0] as Row | undefined;
    const sameParent = target?.parent_id && target.parent_id === self.parent_id;
    if (!target || target.owner_id !== self.owner_id || !sameParent) throw new KernelDenied('scope', 'thread is not a sibling owned by this user');
    await deps.runner.message(String(args.threadId), String(args.text ?? ''), 'queue');
    return { handled: true, result: { ok: true } };
  }
  if (name === 'captain.create') {
    const title = String(args.name ?? '').trim();
    if (!title) throw new ApiFailure('ValidationFailed', 'name is required');
    const thread = await deps.runner.createThread({ ownerId: self.owner_id, projectId: self.project_id, title, prompt: String(args.prompt ?? `You are Captain ${title}.`), engine: args.engine as never, maxUsd: args.maxUsd == null ? null : Number(args.maxUsd), draft: true });
    await query(`WITH u AS (UPDATE threads SET role='captain',updated_at=now() WHERE id=$1 RETURNING id) INSERT INTO captains (thread_id,purpose,crew_runs_on,max_concurrent_crew,digest_md,wake_policy) SELECT u.id,$2,'pool',5,'',$3 FROM u ON CONFLICT (thread_id) DO NOTHING`, [String(thread.id), title, JSON.stringify({ heartbeatSec: [600, 7200], coalesceSec: 30 })]);
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
