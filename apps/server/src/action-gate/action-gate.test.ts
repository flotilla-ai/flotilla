import { describe, expect, it } from 'vitest';
import { ActionGateService, type Queryable } from './index.js';

function db() {
  const calls: { sql: string; params: unknown[] }[] = [];
  const pool: Queryable = { async query(sql: string, params: unknown[] = []) {
    calls.push({ sql, params });
    if (sql.includes('SELECT 1 FROM agent_audit')) return { rows: [] };
    if (sql.includes('UPDATE approvals')) return { rows: [], rowCount: 2 };
    return { rows: [] };
  } };
  return { calls, pool };
}
const input = { tool: 'browser.click', text: 'Send reply' };

describe('ActionGateService', () => {
  it('creates decision approval cards with allow-once always-allow and deny for send', async () => {
    const { calls, pool } = db(); const svc = new ActionGateService(pool);
    const out = await svc.evaluate({ userId: 'u', threadId: 't', input });
    expect(out.decision.decision).toBe('ask'); expect(out.approvalId).toMatch(/^aga_/);
    const insert = calls.find((c) => c.sql.includes('INSERT INTO approvals'));
    expect(insert?.params[1]).toBe('t'); expect(insert?.sql).toContain("'decision'");
    const options = JSON.parse(insert?.params[3] as string) as {id:string}[];
    expect(options.map((o) => o.id)).toEqual(['allow-once', 'always-allow', 'deny']);
    const detail = JSON.parse(insert?.params[4] as string) as {kind:string;signature:string};
    expect(detail.kind).toBe('action'); expect(detail.signature).toContain('send:');
  });
  it('omits always-allow for purchase and stores a thirty-minute background expiry', async () => {
    const { calls, pool } = db(); const svc = new ActionGateService(pool);
    await svc.evaluate({ userId: 'u', threadId: 't', input: { tool: 'browser.click', text: 'Place order' }, background: true, now: new Date('2026-01-01T00:00:00Z') });
    const insert = calls.find((c) => c.sql.includes('INSERT INTO approvals'));
    expect(JSON.parse(insert?.params[3] as string).map((o:{id:string})=>o.id)).toEqual(['allow-once', 'deny']);
    expect(JSON.parse(insert?.params[4] as string).expiresAt).toBe('2026-01-01T00:30:00.000Z');
  });
  it('writes append-only audit rows and expires only open action cards', async () => {
    const { calls, pool } = db(); const svc = new ActionGateService(pool);
    await svc.evaluate({ userId: 'u', threadId: 't', runId: 'r', input });
    const audit = calls.find((c) => c.sql.includes('INSERT INTO agent_audit'));
    expect(audit?.params.slice(0, 7)).toEqual(['u', 't', 'r', 'browser.click', 'Send reply', 'send', 'ask']);
    expect(await svc.expireBackground()).toBe(2);
    const expire = calls.find((c) => c.sql.includes('UPDATE approvals'));
    expect(expire?.sql).toContain("detail->>'kind'='action'"); expect(expire?.sql).toContain("state='expired'");
  });
  it('uses durable denial audit rows when deciding later actions', async () => {
    const calls: string[] = []; const pool: Queryable = { async query(sql: string) { calls.push(sql); if (sql.includes('SELECT 1 FROM agent_audit')) return { rows: [{ '?column?': 1 }] }; return { rows: [] }; } };
    const svc = new ActionGateService(pool);
    const out = await svc.evaluate({ userId: 'u', threadId: 't', input });
    expect(out.decision.decision).toBe('deny'); expect(out.approvalId).toBeUndefined();
    expect(calls.some((sql) => sql.includes("kind='user.message'"))).toBe(true);
  });
});
