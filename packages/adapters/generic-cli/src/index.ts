import type { AdapterEvent, AgentAdapter, MachineCtx, ResumeInput, RunId, StartInput } from '@flotilla/core/types';
import { runJsonl } from '@flotilla/adapter-host';

export class GenericCliAdapter implements AgentAdapter {
  private readonly cancels = new Map<RunId, () => Promise<void>>();
  constructor(private readonly argv: string[]) {}
  manifest = {
    id: 'generic-cli' as const,
    displayName: 'Generic CLI',
    binary: null,
    versionRange: '*',
    transport: 'stdout-jsonl' as const,
    capabilities: { resume: false, cancel: true, steerMidTurn: false, nativeSubagents: false, vendorBudgetFlag: null, hardCapSupported: false, mcp: false, images: false, planMode: false, permissionModes: [] },
    auth: [{ kind: 'none' as const }],
    costReporting: 'none' as const,
    egressHosts: []
  };

  async probe(ctx: MachineCtx) {
    const bin = this.argv[0];
    const out = await ctx.exec([bin, '--version'], { timeoutMs: 1000 });
    return { installed: out.code === 0, version: out.code === 0 ? out.stdout.trim().split(/\s+/).pop() ?? null : null, authed: 'unknown' as const };
  }

  start(input: StartInput): AsyncIterable<AdapterEvent> {
    const run = runJsonl(input.transport, [...this.argv, input.prompt], { cwd: input.cwd, env: input.env }, (line) => ({ t: 'text', delta: `${line}\n` }));
    this.cancels.set(input.runId, run.cancel);
    return run.events;
  }

  resume(input: ResumeInput): AsyncIterable<AdapterEvent> {
    return this.start(input);
  }

  async cancel(runId: RunId): Promise<void> {
    await this.cancels.get(runId)?.();
  }
}

