import type { AdapterEvent, AgentAdapter, MachineCtx, ResumeInput, RunId, StartInput } from '@flotilla/core/types';
import { runJsonl } from '@flotilla/adapter-host';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bin = join(root, 'bin', 'fake-agent');
const fixture = (name: string) => join(root, 'fixtures', name);

export class FakeAdapter implements AgentAdapter {
  private readonly cancels = new Map<RunId, () => Promise<void>>();
  manifest = {
    id: 'fake' as const,
    displayName: 'Fake',
    binary: 'fake-agent',
    versionRange: '0.x',
    transport: 'stdout-jsonl' as const,
    capabilities: { resume: true, cancel: true, steerMidTurn: false, nativeSubagents: false, vendorBudgetFlag: null, hardCapSupported: true, mcp: false, images: false, planMode: false, permissionModes: [] },
    auth: [{ kind: 'none' as const }],
    costReporting: 'usd' as const,
    egressHosts: []
  };

  async probe(ctx: MachineCtx) {
    const out = await ctx.exec(['fake-agent', '--probe'], { timeoutMs: 1000 });
    return { installed: out.code === 0, version: out.code === 0 ? out.stdout.trim().split(/\s+/).pop() ?? null : null, authed: 'yes' as const };
  }

  start(input: StartInput): AsyncIterable<AdapterEvent> {
    const hang = input.env.FAKE_HANG === '1';
    const args = [bin, fixture(hang ? 'hang.jsonl' : input.mcpConfigPath ? 'captain-crew.jsonl' : 'pr-happy.jsonl')];
    if (hang) args.push('--hang');
    if (input.env.FAKE_SPAWN_CHILD === '1') args.push('--spawn-child');
    if (input.mcpConfigPath) args.push('--mcp-config', input.mcpConfigPath);
    const run = runJsonl(input.transport, args, { cwd: input.cwd, env: input.env }, (line) => {
      try { return JSON.parse(line) as AdapterEvent; } catch { return null; }
    });
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

export const fakeAdapter = new FakeAdapter();
