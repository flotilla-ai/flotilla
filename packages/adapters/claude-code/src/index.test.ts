import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StartInput } from '@flotilla/core/types';
import { argvFor, parseClaudeJsonl } from './index.js';

const input = (over: Partial<StartInput> = {}): StartInput => ({
  threadId: 'thr_t' as StartInput['threadId'], runId: 'run_r' as StartInput['runId'], cwd: '/workspace', prompt: 'do it', attachments: [],
  model: null, effort: null, mcpConfigPath: null, rulesPaths: [], env: {}, auth: 'vendor-login', vendorBudget: { maxMicroUsd: 50_000 }, transport: { spawn: () => { throw new Error('unused'); } },
  ...over
});

describe('claude-code adapter', () => {
  it('builds documented start argv with budget and vendor-login flags', () => {
    const argv = argvFor(input());
    expect(argv).toEqual(expect.arrayContaining(['-p', '--output-format', 'stream-json', '--verbose', '--max-budget-usd', '0.05', '--strict-mcp-config', '--setting-sources', 'user']));
    expect(argv).not.toContain('--bare');
  });
  it('uses --bare only for api-key auth', () => {
    expect(argvFor(input({ auth: 'api-key' }))).toContain('--bare');
    expect(argvFor(input({ auth: 'api-key' }))).not.toContain('--setting-sources');
  });
  it('adds mcp config and resume id', () => {
    const argv = argvFor({ ...input({ mcpConfigPath: '/tmp/mcp.json' }), adapterSessionId: 'sess_1' });
    expect(argv).toEqual(expect.arrayContaining(['--mcp-config', '/tmp/mcp.json', '--strict-mcp-config', '--resume', 'sess_1']));
  });
  it('parses fixture session, text, tools, usage, final usd cost, and done', () => {
    const events = parseClaudeJsonl(readFileSync(new URL('../fixtures/happy.jsonl', import.meta.url), 'utf8'));
    expect(events[0]).toEqual({ t: 'session', adapterSessionId: 'sess-fixture' });
    expect(events).toContainEqual({ t: 'text', delta: 'Hello' });
    expect(events).toContainEqual({ t: 'tool_call', id: 'toolu_1', name: 'Read', input: { path: 'x' } });
    expect(events).toContainEqual({ t: 'tool_result', id: 'toolu_1', ok: true, output: 'file text' });
    expect(events).toContainEqual({ t: 'usage', inputTokens: 10, outputTokens: 4, cacheTokens: 3, cumulative: false });
    expect(events).toContainEqual({ t: 'usage', usdMicro: 12300, cumulative: true });
    expect(events.at(-1)).toMatchObject({ t: 'done', stopReason: 'end_turn' });
  });

  it('dedupes repeated message usage and reads final result token usage', () => {
    const events = parseClaudeJsonl('{"type":"assistant","message":{"id":"m1","content":[{"type":"text","text":"a"}],"usage":{"input_tokens":1,"output_tokens":1}}}\n{"type":"assistant","message":{"id":"m1","content":[{"type":"tool_use","id":"t","name":"x","input":{}}],"usage":{"input_tokens":1,"output_tokens":1}}}\n{"type":"result","total_cost_usd":0.001,"usage":{"input_tokens":2,"output_tokens":3,"cache_read_input_tokens":4}}');
    expect(events.filter((e) => e.t === 'usage' && e.cumulative === false)).toHaveLength(1);
    expect(events).toContainEqual({ t: 'usage', usdMicro: 1000, inputTokens: 2, outputTokens: 3, cacheTokens: 4, cumulative: true });
  });
  it('parses a SIGTERM-killed fixture as cancelled without final usage', () => {
    const events = parseClaudeJsonl(readFileSync(new URL('../fixtures/sigterm.jsonl', import.meta.url), 'utf8'));
    expect(events.at(-1)).toEqual({ t: 'done', stopReason: 'cancelled' });
    expect(events.filter((e) => e.t === 'usage' && 'usdMicro' in e)).toEqual([]);
  });
  it('never references credential files or child_process', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    for (const bad of ['.claude.json', '.credentials', 'setup-token', 'child_process']) expect(src).not.toContain(bad);
  });
});
