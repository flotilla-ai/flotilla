import type { AdapterEvent, AgentAdapter, MachineCtx, ResumeInput, RunId, StartInput } from '@flotilla/core/types';
import { runJsonl } from '@flotilla/adapter-host';

type Json = Record<string, unknown>;
export function argvFor(input: StartInput | ResumeInput): string[] {
  const model = input.model ? ['--model', input.model] : [];
  if ('adapterSessionId' in input) return ['codex', 'exec', 'resume', input.adapterSessionId, '--json', ...model, input.prompt];
  return ['codex', 'exec', '--json', ...model, input.prompt];
}
export function parseCodexLine(line: string): AdapterEvent[] {
  let row: Json;
  try { row = JSON.parse(line) as Json; } catch { return []; }
  const type = String(row.type ?? row.event ?? '');
  if ((type === 'session.started' || type === 'thread.started') && typeof (row.session_id ?? row.thread_id) === 'string') return [{ t: 'session', adapterSessionId: String(row.session_id ?? row.thread_id) }];
  if (type === 'item.started' || type === 'item.completed' || type === 'response_item') {
    const item = (row.item ?? row) as Json;
    if ((item.type === 'message' || item.type === 'agent_message') && typeof item.text === 'string') return [{ t: 'text', delta: item.text }];
    if (item.type === 'function_call' || item.type === 'tool_call') return [{ t: 'tool_call', id: String(item.id ?? item.call_id ?? ''), name: String(item.name ?? ''), input: item.arguments ?? item.input }];
    if (item.type === 'function_call_output' || item.type === 'tool_result') return [{ t: 'tool_result', id: String(item.call_id ?? item.id ?? ''), ok: item.is_error !== true, output: String(item.output ?? item.content ?? '') }];
    if (item.type === 'command_execution') {
      const out: AdapterEvent[] = [];
      if (typeof item.command === 'string' && item.status === 'in_progress') out.push({ t: 'tool_call', id: String(item.id ?? ''), name: 'shell', input: { command: item.command } });
      if ('output' in item || typeof item.exit_code === 'number' || item.status === 'completed' || item.status === 'failed') out.push({ t: 'tool_result', id: String(item.id ?? ''), ok: item.status !== 'failed' && Number(item.exit_code ?? 0) === 0, output: String(item.output ?? '') });
      return out;
    }
  }
  if (type === 'turn.completed' || type === 'result') {
    const usage = (row.usage ?? {}) as Json;
    const out: AdapterEvent[] = [];
    if (Object.keys(usage).length) out.push({ t: 'usage', inputTokens: Math.max(0, Number(usage.input_tokens ?? usage.inputTokens ?? 0) - Number(usage.cached_input_tokens ?? usage.cached_tokens ?? usage.cacheTokens ?? 0)), outputTokens: Number(usage.output_tokens ?? usage.outputTokens ?? 0), cacheTokens: Number(usage.cached_input_tokens ?? usage.cached_tokens ?? usage.cacheTokens ?? 0), cumulative: true });
    out.push({ t: 'done', stopReason: row.is_error === true || row.error ? 'error' : 'end_turn', error: row.error ? String(row.error) : undefined });
    return out;
  }
  return [];
}
export function parseCodexJsonl(text: string): AdapterEvent[] {
  const events = text.split('\n').filter(Boolean).flatMap(parseCodexLine);
  if (!events.some((e) => e.t === 'done')) events.push({ t: 'done', stopReason: 'cancelled' });
  return events;
}
export class CodexAdapter implements AgentAdapter {
  private readonly cancels = new Map<RunId, () => Promise<void>>();
  manifest = {
    id: 'codex' as const, displayName: 'Codex', binary: 'codex', versionRange: 'unverified', transport: 'stdout-jsonl' as const,
    capabilities: { resume: true, cancel: true, steerMidTurn: false, nativeSubagents: false, vendorBudgetFlag: null, hardCapSupported: false, mcp: false, images: false, planMode: false, permissionModes: [] },
    auth: [{ kind: 'vendor-login' as const, command: ['codex', 'login'] }, { kind: 'api-key' as const, envVar: 'CODEX_API_KEY' }],
    costReporting: 'tokens' as const, egressHosts: ['api.openai.com']
  };
  async probe(ctx: MachineCtx) {
    const out = await ctx.exec(['codex', '--version'], { timeoutMs: 1000 });
    return { installed: out.code === 0, version: out.code === 0 ? out.stdout.trim().split(/\s+/).pop() ?? null : null, authed: 'unknown' as const };
  }
  start(input: StartInput): AsyncIterable<AdapterEvent> {
    const run = runJsonl(input.transport, argvFor(input), { cwd: input.cwd, env: input.env }, (line) => parseCodexLine(line));
    this.cancels.set(input.runId, run.cancel);
    return run.events;
  }
  resume(input: ResumeInput): AsyncIterable<AdapterEvent> { return this.start(input); }
  async cancel(runId: RunId): Promise<void> { await this.cancels.get(runId)?.(); }
}
export const codexAdapter = new CodexAdapter();
