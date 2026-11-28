import { describe, expect, it } from 'vitest';
import { decideCompute, defaultCaptainQuota, normalizeQuota, tightenComputeDecision } from './computeGuard.js';

const cap = { vcpus: 8, ramMb: 16384, diskFreeGb: 200 };

describe('computeGuard', () => {
  it('uses host reserves and captain defaults', () => {
    expect(defaultCaptainQuota).toEqual({ vcpus: 2, ramMb: 4096, diskGb: 32, gpu: 'none' });
    expect(normalizeQuota({ vcpus: 0, ramMb: 1, diskGb: 1 })).toEqual({ vcpus: 1, ramMb: 2048, diskGb: 16, gpu: 'none' });
    const out = decideCompute(cap, [], {});
    expect(out.decision).toBe('allow');
    // 16GB less max(2GB,25%=4GB) leaves 12GB RAM; after 4GB request 8GB remains.
    expect(out.remaining?.ramMb).toBe(8192);
  });
  it('does not overcommit RAM across running computers', () => {
    const running = [{ id: 'a', state: 'running' as const, vcpus: 1, ramMb: 10000, diskGb: 16 }];
    const out = decideCompute(cap, running, { ramMb: 4096, vcpus: 1, diskGb: 16 });
    expect(out.decision).toBe('deny'); expect(out.reason).toBe('Not enough RAM: sleep Captain X or lower its RAM');
  });
  it('allows CPU at most 2x allocatable and disk at most 90 percent free-after-reserve', () => {
    expect(decideCompute(cap, [], { vcpus: 14, ramMb: 2048, diskGb: 16 }).decision).toBe('allow');
    expect(decideCompute(cap, [], { vcpus: 15, ramMb: 2048, diskGb: 16 }).reason).toContain('Not enough CPU');
    expect(decideCompute(cap, [], { vcpus: 1, ramMb: 2048, diskGb: 162 }).decision).toBe('allow');
    expect(decideCompute(cap, [], { vcpus: 1, ramMb: 2048, diskGb: 163 }).reason).toContain('Not enough disk');
  });
  it('ignores sleeping allocations and hooks cannot loosen a kernel denial', () => {
    const sleeping = [{ id: 'a', state: 'sleeping' as const, vcpus: 8, ramMb: 16000, diskGb: 160 }];
    expect(decideCompute(cap, sleeping, {}).decision).toBe('allow');
    const kernel = decideCompute(cap, [], { ramMb: 99999 });
    expect(tightenComputeDecision(kernel, { decision: 'allow', reason: 'hook' }).decision).toBe('deny');
    const ok = decideCompute(cap, [], {});
    expect(tightenComputeDecision(ok, { decision: 'deny', reason: 'hook' }).decision).toBe('deny');
  });
});
