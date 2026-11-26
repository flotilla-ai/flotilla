import { spawn } from 'node:child_process';
import type { AdapterEvent, ProcessHandle, ProcessTransport } from '@flotilla/core/types';

async function* lines(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  let rest = '';
  for await (const chunk of stream) {
    rest += chunk.toString();
    let at = rest.indexOf('\n');
    while (at >= 0) {
      yield rest.slice(0, at);
      rest = rest.slice(at + 1);
      at = rest.indexOf('\n');
    }
  }
  if (rest) yield rest;
}

class LocalHandle implements ProcessHandle {
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  exit: Promise<{ code: number | null; signal: string | null }>;
  constructor(private readonly child: import('node:child_process').ChildProcess) {
    this.stdout = lines(child.stdout!);
    this.stderr = lines(child.stderr!);
    this.exit = new Promise((resolve) => {
      child.once('error', () => resolve({ code: null, signal: null }));
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  }
  async groupAlive(): Promise<boolean> {
    if (!this.child.pid) return false;
    try { process.kill(-this.child.pid, 0); return true; } catch { return false; }
  }
  async signal(sig: 'SIGINT' | 'SIGTERM' | 'SIGKILL'): Promise<void> {
    if (this.child.pid) {
      try { process.kill(-this.child.pid, sig); } catch { try { this.child.kill(sig); } catch { /* exited */ } }
    }
  }
}

export class LocalTransport implements ProcessTransport {
  spawn(argv: string[], opts: { cwd: string; env: Record<string, string> }): ProcessHandle {
    const child = spawn(argv[0], argv.slice(1), { cwd: opts.cwd, env: opts.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    return new LocalHandle(child);
  }
}

async function waitExit(exit: ProcessHandle['exit'], ms: number): Promise<boolean> {
  return Promise.race([exit.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), ms))]);
}

export function runJsonl(
  transport: ProcessTransport,
  argv: string[],
  opts: { cwd: string; env: Record<string, string> },
  parseLine: (line: string) => AdapterEvent | AdapterEvent[] | null
): { events: AsyncIterable<AdapterEvent>; cancel(): Promise<void> } {
  const handle = transport.spawn(argv, opts);
  let cancelled = false;
  let cancelPromise: Promise<void> | null = null;
  const cancel = async (): Promise<void> => {
    if (cancelPromise) return cancelPromise;
    cancelled = true;
    cancelPromise = (async () => {
      const groupAlive = async () => 'groupAlive' in handle && typeof handle.groupAlive === 'function' ? await (handle.groupAlive as () => Promise<boolean>)() : true;
      await handle.signal('SIGINT');
      await waitExit(handle.exit, 2000);
      if (!(await groupAlive())) return;
      await handle.signal('SIGTERM');
      await waitExit(handle.exit, 2000);
      if (!(await groupAlive())) return;
      await handle.signal('SIGKILL');
      await waitExit(handle.exit, 6000);
    })();
    return cancelPromise;
  };
  void (async () => { for await (const _ of handle.stderr) void _; })();
  const events = (async function* (): AsyncIterable<AdapterEvent> {
    let sawDone = false;
    for await (const line of handle.stdout) {
      const event = parseLine(line);
      for (const item of event ? Array.isArray(event) ? event : [event] : []) {
        if (item.t === 'done') sawDone = true;
        yield item;
      }
    }
    const exit = await handle.exit;
    if (cancelled) yield { t: 'done', stopReason: 'cancelled' };
    else if (!sawDone && exit.code !== 0) yield { t: 'done', stopReason: 'error', error: `exit ${exit.code ?? exit.signal}` };
  })();
  return { events, cancel };
}
