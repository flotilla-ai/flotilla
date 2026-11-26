import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StartInput } from '@flotilla/core/types';
import { LocalTransport } from '@flotilla/adapter-host';
import { FakeAdapter } from './index.js';

const input = (runId: string, env: Record<string, string> = {}): StartInput => ({
  threadId: `thr_${runId}` as StartInput['threadId'], runId: runId as StartInput['runId'], cwd: process.cwd(), prompt: 'hi', attachments: [],
  model: null, effort: null, mcpConfigPath: null, rulesPaths: [], env: { ...process.env, ...env } as Record<string, string>, auth: 'none', vendorBudget: { maxMicroUsd: null }, transport: new LocalTransport()
});
const collect = async <T>(iter: AsyncIterable<T>) => { const out: T[] = []; for await (const x of iter) out.push(x); return out; };
const markerCount = () => {
  try { return execFileSync('ps', ['-eo', 'args'], { encoding: 'utf8' }).split('\n').filter((l) => l.includes('setInterval(()=>{},1000)')).length; } catch { return 0; }
};

describe('fake adapter', () => {
  it('replays pr-happy fixture as the exact AdapterEvent sequence', async () => {
    const events = await collect(new FakeAdapter().start(input('run_happy')));
    expect(events).toEqual([
      { t: 'session', adapterSessionId: 'fake-session' },
      { t: 'text', delta: 'Hello' },
      { t: 'usage', usdMicro: 1000, cumulative: true },
      { t: 'done', stopReason: 'end_turn' }
    ]);
  });

  it('cancels a hanging process group within 10 seconds', async () => {
    const adapter = new FakeAdapter();
    const events = collect(adapter.start(input('run_cancel', { FAKE_HANG: '1', FAKE_SPAWN_CHILD: '1' })));
    await new Promise((r) => setTimeout(r, 300));
    const before = markerCount();
    const started = Date.now();
    await adapter.cancel('run_cancel' as StartInput['runId']);
    const out = await events;
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(out.at(-1)).toEqual({ t: 'done', stopReason: 'cancelled' });
    expect(before).toBeGreaterThan(0);
    expect(markerCount()).toBe(0);
  }, 12_000);

  it('never imports child_process in adapter sources', () => {
    expect(readFileSync(new URL('./index.ts', import.meta.url), 'utf8')).not.toContain('child_process');
  });
});
