import { describe, expect, it } from 'vitest';
import { MemoryV2Service, rankMemory, secretLike, type Queryable } from './index.js';
import { RunTokenService } from '../captain/tools/tokens.js';
import { createCaptainToolsServer } from '../captain/tools/http.js';

function db() {
  const rows: Record<string, unknown>[] = []; const deleted: unknown[] = [];
  const pool: Queryable = { async query(sql: string, params: unknown[] = []) {
    if (sql.startsWith('INSERT')) rows.push({ id: params[0], scope: params[1], subjectId: params[2], text: params[3], kind: params[6], captainId: params[7] });
    if (sql.startsWith('SELECT')) return { rows: rows.filter((r) => r.scope === params[0] && r.subjectId === params[1] && (params[2] == null || r.captainId === params[2])) };
    if (sql.startsWith('DELETE')) { deleted.push(params[0]); return { rows: [], rowCount: rows.some((r) => r.id === params[0] && r.subjectId === params[1]) ? 1 : 0 }; }
    return { rows: [] };
  } };
  return { pool, rows, deleted };
}

describe('memory v2', () => {
  it('saves scoped memories and retrieves rules plus relevant facts with stale warning', async () => {
    const { pool } = db(); const svc = new MemoryV2Service({ pool });
    await svc.save({ scope: 'captain', subjectId: 'cap1', captainId: 'cap1', kind: 'rule', text: 'Always ask before email' });
    await svc.save({ scope: 'captain', subjectId: 'cap1', captainId: 'cap1', text: 'Rocket fixture altitude changed often' });
    await svc.save({ scope: 'captain', subjectId: 'cap2', captainId: 'cap2', text: 'other captain fact' });
    const out = await svc.list({ scope: 'captain', subjectId: 'cap1', captainId: 'cap1', query: 'rocket altitude' });
    expect(out.warning).toContain('memory may be stale'); expect(out.items.map((x) => x.kind)).toContain('rule'); expect(out.items.some((x) => x.text.includes('Rocket'))).toBe(true); expect(out.items.some((x) => x.text.includes('other captain'))).toBe(false);
  });
  it('refuses password card OTP and scrubber-hit secrets before storage', async () => {
    const { pool, rows } = db(); const svc = new MemoryV2Service({ pool });
    for (const text of ['password: hunter2', 'card: 4242424242424242', 'otp: 123456', 'token sk-abcdefghijklmnopqrstuvwxyz']) await expect(svc.save({ scope: 'user', subjectId: 'u', text })).rejects.toThrow('secret-like');
    expect(rows).toEqual([]); expect(secretLike('ordinary fact')).toBe(false);
  });
  it('writes automatic typed worklog entries', async () => {
    const { pool, rows } = db(); const svc = new MemoryV2Service({ pool });
    const out = await svc.worklog({ userId: 'u', captainId: 'cap', runId: 'run', title: 'Research rocket', outcome: 'done', links: ['https://example.test/report'] });
    expect(out.kind).toBe('worklog'); expect(rows[0].text).toContain('Research rocket: done');
  });
  it('exposes memory tools through per-run token MCP calls', async () => {
    const { pool } = db(); const tokens = new RunTokenService(); const issued = tokens.issue('run1', 'cap'); const svc = new MemoryV2Service({ pool, tokens });
    expect((await svc.mcpCall(undefined, 'memory.list', {})).status).toBe(401);
    expect((await svc.mcpCall(issued.token, 'memory.save', { text: 'preference is concise updates', kind: 'preference' })).status).toBe(200);
    expect((await svc.mcpCall(issued.token, 'memory.list', { query: 'concise' })).status).toBe(200);
    tokens.endRun('run1'); expect((await svc.mcpCall(issued.token, 'memory.list', {})).status).toBe(401);
  });
  it('ranks every rule ahead of facts', () => {
    const out = rankMemory([{ id: 'f', scope: 'captain', subjectId: 'c', kind: 'fact', text: 'exact matching fact' }, { id: 'r', scope: 'captain', subjectId: 'c', kind: 'rule', text: 'unrelated rule' }], 'exact matching');
    expect(out[0].kind).toBe('rule');
  });

  it('serves /mcp/memory JSONRPC with the per-run token', async () => {
    const { pool } = db(); const tokens = new RunTokenService(); const issued = tokens.issue('run1', 'cap');
    const memory = new MemoryV2Service({ pool, tokens });
    const captain = { call: async () => ({ status: 404, body: {} }) };
    const server = createCaptainToolsServer(captain as never, { memory });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/mcp/memory`, { method: 'POST', headers: { authorization: `Bearer ${issued.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'memory.save', arguments: { text: 'user prefers concise answers', kind: 'preference' } } }) });
    expect(res.status).toBe(200); server.close();
  });
});
