import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';
import type { EnvironmentSpec, MachineCapabilities, ProcessKind, RunResult, SetupPhaseName, StartupEntry } from './types.js';

export type EnvironmentMachine = { transport: ProcessTransport; caps: MachineCapabilities; env: Record<string, string> };
export type ProcessReport = RunResult & { kind: ProcessKind; name: string; head?: string | null };
export type ExecutorOptions = { secondMs?: number; report?(r: ProcessReport): Promise<void> };
const TAIL = 8 * 1024;
const READY_TIMEOUT_SEC = 120;

const machines = new Map<string, EnvironmentMachine>();
/** Seam for the machine-core unit: register a running thread machine so commands and tools can reach it. */
export function registerEnvironmentMachine(threadId: string, machine: EnvironmentMachine): () => void {
  machines.set(threadId, machine);
  return () => { if (machines.get(threadId) === machine) machines.delete(threadId); };
}
export function environmentMachine(threadId: string): EnvironmentMachine {
  const m = machines.get(threadId);
  if (!m) throw new ApiFailure('Conflict', 'thread machine is not running');
  return m;
}

/** Runs setup phases, startup entries and named commands as `bash -c` from the repo dir with the thread's env. */
export class EnvironmentExecutor {
  private readonly services = new Map<string, ProcessHandle>();
  private readonly secondMs: number;
  constructor(readonly threadId: string, readonly machine: EnvironmentMachine, private readonly opts: ExecutorOptions = {}) { this.secondMs = opts.secondMs ?? 1000; }

  private spawn(command: string, extra: Record<string, string> = {}): ProcessHandle {
    return this.machine.transport.spawn(['bash', '-c', command], { cwd: this.machine.caps.repoDir, env: { ...this.machine.env, FLOTILLA_SUDO: this.machine.caps.sudo ? '1' : '0', ...extra } });
  }
  private async report(r: ProcessReport): Promise<void> { await this.opts.report?.(r).catch(() => undefined); }

  async run(kind: ProcessKind, name: string, command: string, timeoutSec: number, extra: Record<string, string> = {}, head?: string | null): Promise<RunResult> {
    await this.report({ kind, name, state: 'running', exitCode: null, output: '', head });
    if (!command.trim()) { const r: RunResult = { state: 'passed', exitCode: 0, output: '' }; await this.report({ kind, name, head, ...r }); return r; }
    const h = this.spawn(command, extra); let output = '';
    const collect = async (s: AsyncIterable<string>) => { for await (const l of s) output = (output + l + '\n').slice(-TAIL); };
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; void h.signal('SIGTERM'); setTimeout(() => void h.signal('SIGKILL'), 5 * this.secondMs).unref(); }, timeoutSec * this.secondMs);
    const [exit] = await Promise.all([h.exit, collect(h.stdout), collect(h.stderr)]);
    clearTimeout(timer);
    const r: RunResult = { state: timedOut ? 'timeout' : exit.code === 0 ? 'passed' : 'failed', exitCode: exit.code, output };
    await this.report({ kind, name, head, ...r });
    return r;
  }
  setup(spec: EnvironmentSpec, phase: SetupPhaseName, head?: string | null): Promise<RunResult> {
    return this.run('setup', phase, spec.setup[phase].script, spec.setup[phase].timeoutSec, { FLOTILLA_SETUP_PHASE: phase }, head);
  }
  async command(spec: EnvironmentSpec, name: string): Promise<RunResult> {
    const c = spec.commands.find((x) => x.name === name);
    if (!c) throw new ApiFailure('NotFound', 'command not found');
    return this.run('command', name, c.command, 3600);
  }

  private async ready(port: number): Promise<boolean> {
    const deadline = Date.now() + Math.max(READY_TIMEOUT_SEC * this.secondMs, 10_000);
    while (Date.now() < deadline) {
      if ((await this.spawn(`exec 3<>/dev/tcp/127.0.0.1/${port}`).exit).code === 0) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }
  private async startOne(e: StartupEntry): Promise<void> {
    await this.report({ kind: 'startup', name: e.name, state: 'running', exitCode: null, output: '' });
    const h = this.spawn(e.command); this.services.set(e.name, h);
    let exited = false;
    void h.exit.then(async (x) => { exited = true; if (this.services.get(e.name) === h) { this.services.delete(e.name); await this.report({ kind: 'startup', name: e.name, state: 'failed', exitCode: x.code, output: '' }); } });
    void (async () => { for await (const _ of h.stdout); })(); void (async () => { for await (const _ of h.stderr); })();
    if (e.readinessPort === null) return;
    const ok = await Promise.race([this.ready(e.readinessPort), h.exit.then(() => false)]);
    if (!exited && this.services.get(e.name) === h) await this.report({ kind: 'startup', name: e.name, state: ok ? 'ready' : 'failed', exitCode: null, output: '' });
  }
  /** Starts every startup entry and waits until each is ready on its port (or failed). */
  async startServices(spec: EnvironmentSpec): Promise<void> { await Promise.all(spec.startup.map((e) => this.startOne(e))); }
  /** Machine woke up: processes are gone, so rerun every startup entry. */
  async wake(spec: EnvironmentSpec): Promise<void> { await this.stop(); await this.startServices(spec); }
  async stop(): Promise<void> {
    const all = [...this.services.entries()]; this.services.clear();
    await Promise.all(all.map(async ([name, h]) => { await h.signal('SIGTERM'); await h.exit; await this.report({ kind: 'startup', name, state: 'stopped', exitCode: null, output: '' }); }));
  }
}
