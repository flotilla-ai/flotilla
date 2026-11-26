import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StartInput } from '@flotilla/core/types';
import { LocalTransport } from '@flotilla/adapter-host';
import { GenericCliAdapter } from './index.js';

const input = (runId: string): StartInput => ({
  threadId: `thr_${runId}` as StartInput['threadId'], runId: runId as StartInput['runId'], cwd: process.cwd(), prompt: 'ignored', attachments: [],
  model: null, effort: null, mcpConfigPath: null, rulesPaths: [], env: process.env as Record<string, string>, auth: 'none', vendorBudget: { maxMicroUsd: null }, transport: new LocalTransport()
});
const collect = async <T>(iter: AsyncIterable<T>) => { const out: T[] = []; for await (const x of iter) out.push(x); return out; };

describe('generic-cli adapter', () => {
  it('maps stdout lines to text', async () => {
    const adapter = new GenericCliAdapter([process.execPath, '-e', 'console.log("one");console.log("two")']);
    expect(await collect(adapter.start(input('run_g1')))).toEqual([{ t: 'text', delta: 'one\n' }, { t: 'text', delta: 'two\n' }]);
  });

  it('maps a nonzero exit to done:error', async () => {
    const adapter = new GenericCliAdapter([process.execPath, '-e', 'console.log("bad");process.exit(3)']);
    expect((await collect(adapter.start(input('run_g2')))).at(-1)).toEqual({ t: 'done', stopReason: 'error', error: 'exit 3' });
  });

  it('probe uses MachineCtx and never spawns the main command through a transport', async () => {
    const calls: string[][] = [];
    const result = await new GenericCliAdapter(['main-command']).probe({ machineId: 'mac_m' as never, exec: async (argv) => { calls.push(argv); return { code: 0, stdout: 'tool 1.2.3', stderr: '' }; } });
    expect(calls).toEqual([['main-command', '--version']]);
    expect(result).toEqual({ installed: true, version: '1.2.3', authed: 'unknown' });
  });

  it('never imports child_process in adapter sources', () => {
    expect(readFileSync(new URL('./index.ts', import.meta.url), 'utf8')).not.toContain('child_process');
  });
});
