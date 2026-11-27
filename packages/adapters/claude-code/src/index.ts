import type { AdapterEvent, AgentAdapter, MachineCtx, ResumeInput, RunId, StartInput } from '@flotilla/core/types';
import { runJsonl } from '@flotilla/adapter-host';

type Json = Record<string, unknown>;
const usageOf = (u: Json | undefined, cumulative: boolean): AdapterEvent | null => {
  if (!u) return null;
  return { t: 'usage', inputTokens: Number(u.input_tokens ?? 0), outputTokens: Number(u.output_tokens ?? 0), cacheTokens: Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0), cumulative };
};

export function argvFor(input: StartInput | ResumeInput): string[] {
  const argv = ['claude', '-p', input.prompt, '--output-format', 'stream-json', '--verbose'];
  if (input.vendorBudget.maxMicroUsd !== null) argv.push('--max-budget-usd', (input.vendorBudget.maxMicroUsd / 1e6).toString());
  if (input.auth === 'api-key') argv.push('--bare');
  else argv.push('--strict-mcp-config', '--setting-sources', 'user');
  if (input.mcpConfigPath) argv.push('--mcp-config', input.mcpConfigPath, '--strict-mcp-config');
  if ('adapterSessionId' in input) argv.push('--resume', input.adapterSessionId);
  return argv;
}

export function parseClaudeLine(line: string, opts: { resume?: boolean; seenUsageMessages?: Set<string> } = {}): AdapterEvent[] {
  let row: Json;
  try { row = JSON.parse(line) as Json; } catch { return []; }
  if (row.type === 'system' && row.subtype === 'init' && typeof row.session_id === 'string') return [{ t: 'session', adapterSessionId: row.session_id }];
  if (row.type === 'assistant') {
    const message = row.message as Json | undefined;
    const out: AdapterEvent[] = [];
    for (const part of (message?.content as Json[] | undefined) ?? []) {
      if (part.type === 'text' && typeof part.text === 'string') out.push({ t: 'text', delta: part.text });
      if (part.type === 'tool_use') out.push({ t: 'tool_call', id: String(part.id), name: String(part.name), input: part.input });
    }
    const messageId = typeof message?.id === 'string' ? message.id : undefined;
    const duplicateUsage = messageId !== undefined && opts.seenUsageMessages?.has(messageId);
    const usage = duplicateUsage ? null : usageOf(message?.usage as Json | undefined, false);
    if (usage) {
      if (messageId) opts.seenUsageMessages?.add(messageId);
      out.push(usage);
    }
    return out;
  }
  if (row.type === 'user') {
    const message = row.message as Json | undefined;
    const out: AdapterEvent[] = [];
    for (const part of (message?.content as Json[] | undefined) ?? []) {
      if (part.type === 'tool_result') out.push({ t: 'tool_result', id: String(part.tool_use_id), ok: part.is_error !== true, output: typeof part.content === 'string' ? part.content : JSON.stringify(part.content ?? '') });
    }
    return out;
  }
  if (row.type === 'result') {
    const out: AdapterEvent[] = [];
    const resultUsage = row.usage as Json | undefined;
    if (!opts.resume && (typeof row.total_cost_usd === 'number' || resultUsage)) {
      out.push({
        t: 'usage',
        usdMicro: typeof row.total_cost_usd === 'number' ? Math.round(row.total_cost_usd * 1e6) : undefined,
        inputTokens: resultUsage ? Number(resultUsage.input_tokens ?? 0) : undefined,
        outputTokens: resultUsage ? Number(resultUsage.output_tokens ?? 0) : undefined,
        cacheTokens: resultUsage ? Number(resultUsage.cache_read_input_tokens ?? 0) + Number(resultUsage.cache_creation_input_tokens ?? 0) : undefined,
        cumulative: true
      });
    }
    out.push({ t: 'done', stopReason: row.is_error === true ? 'error' : 'end_turn', error: row.is_error === true ? String(row.result ?? 'claude error') : undefined });
    return out;
  }
  return [];
}

export function parseClaudeJsonl(text: string): AdapterEvent[] {
  const seen = new Set<string>();
  const events = text.split('\n').filter(Boolean).flatMap((line) => parseClaudeLine(line, { seenUsageMessages: seen }));
  if (!events.some((e) => e.t === 'done')) events.push({ t: 'done', stopReason: 'cancelled' });
  return events;
}

export class ClaudeCodeAdapter implements AgentAdapter {
  private readonly cancels = new Map<RunId, () => Promise<void>>();
  manifest = {
    id: 'claude-code' as const,
    displayName: 'Claude Code',
    binary: 'claude',
    versionRange: 'unverified',
    transport: 'stdout-jsonl' as const,
    capabilities: { resume: true, cancel: true, steerMidTurn: false, nativeSubagents: true, vendorBudgetFlag: '--max-budget-usd', hardCapSupported: true, mcp: true, images: true, planMode: true, permissionModes: ['default', 'acceptEdits', 'plan', 'bypassPermissions'] },
    auth: [{ kind: 'vendor-login' as const, command: ['claude', 'auth', 'login'] }, { kind: 'api-key' as const, envVar: 'ANTHROPIC_API_KEY', baseUrlEnvVar: 'ANTHROPIC_BASE_URL' }],
    costReporting: 'usd' as const,
    egressHosts: ['api.anthropic.com']
  };
  async probe(ctx: MachineCtx) {
    const out = await ctx.exec(['claude', '--version'], { timeoutMs: 1000 });
    return { installed: out.code === 0, version: out.code === 0 ? out.stdout.trim().split(/\s+/).pop() ?? null : null, authed: 'unknown' as const };
  }
  start(input: StartInput): AsyncIterable<AdapterEvent> {
    const seen = new Set<string>();
    const resume = 'adapterSessionId' in input;
    const run = runJsonl(input.transport, argvFor(input), { cwd: input.cwd, env: input.env }, (line) => parseClaudeLineMany(line, { resume, seen }));
    this.cancels.set(input.runId, run.cancel);
    return run.events;
  }
  resume(input: ResumeInput): AsyncIterable<AdapterEvent> { return this.start(input); }
  async cancel(runId: RunId): Promise<void> { await this.cancels.get(runId)?.(); }
}
function parseClaudeLineMany(line: string, opts: { resume?: boolean; seen?: Set<string> } = {}): AdapterEvent[] | null {
  const events = parseClaudeLine(line, { resume: opts.resume, seenUsageMessages: opts.seen });
  return events.length ? events : null;
}
export const claudeCodeAdapter = new ClaudeCodeAdapter();
