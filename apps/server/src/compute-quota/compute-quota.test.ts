import { describe, expect, it } from 'vitest';
import { ComputeQuotaService, detectHostCapacity, type Queryable } from './index.js';

function db(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const pool: Queryable = { async query(sql: string, params: unknown[] = []) { calls.push({ sql, params }); if (sql.includes('UPDATE') || sql.includes('INSERT')) return { rows: [{ captain_id: params[0], state: params[1] }], rowCount: 1 }; return { rows }; } };
  return { calls, pool };
}
const provider = { capacity: async () => ({ vcpus: 8, ramMb: 16384, diskFreeGb: 200 }) };

describe('compute quota service', () => {
  it('has zero impact when isolation is off and never contacts capacity or SQL', async () => {
    const { calls, pool } = db(); let contacted = false;
    const svc = new ComputeQuotaService({ pool, enabled: false, provider: { capacity: async () => { contacted = true; return { vcpus: 1, ramMb: 1, diskFreeGb: 1 }; } } });
    const out = await svc.evaluate({ userId: 'u', threadId: 't' });
    expect(out).toMatchObject({ enabled: false, decision: { decision: 'allow', reason: 'isolation-off-zero-impact' } });
    expect(contacted).toBe(false); expect(calls).toEqual([]);
  });
  it('raises an orange decision card when RAM does not fit', async () => {
    const { calls, pool } = db([{ id: 'cap_x', state: 'running', vcpus: 1, ramMb: 10000, diskGb: 16 }]);
    const svc = new ComputeQuotaService({ pool, enabled: true, provider });
    const out = await svc.evaluate({ userId: 'u', threadId: 't', captainId: 'cap_y', request: { ramMb: 4096, vcpus: 1, diskGb: 16 } });
    expect(out.decision).toMatchObject({ decision: 'deny', reason: 'Not enough RAM: sleep Captain X or lower its RAM' });
    const insert = calls.find((c) => c.sql.includes('INSERT INTO approvals'));
    expect(insert?.sql).toContain("'decision'"); expect(JSON.parse(insert?.params[4] as string)).toMatchObject({ kind: 'compute', captainId: 'cap_y' });
  });
  it('allocation state API can stop a computer on budget exhaustion', async () => {
    const { calls, pool } = db(); const svc = new ComputeQuotaService({ pool, enabled: true, provider });
    const row = await svc.stopForBudget('cap_x') as { state: string };
    expect(row.state).toBe('stopped');
    expect(calls[0].sql).toContain('ON CONFLICT (captain_id) DO UPDATE');
  });
  it('detects real host capacity shape without external services', () => {
    const cap = detectHostCapacity();
    expect(cap.vcpus).toBeGreaterThan(0); expect(cap.ramMb).toBeGreaterThan(0); expect(cap.diskFreeGb).toBeGreaterThan(0);
  });
});
