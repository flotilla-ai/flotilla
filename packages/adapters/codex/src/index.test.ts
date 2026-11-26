import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StartInput } from '@flotilla/core/types';
import { argvFor, parseCodexJsonl } from './index.js';

const input = (over: Partial<StartInput> = {}): StartInput => ({ threadId: 'thr_t' as StartInput['threadId'], runId: 'run_r' as StartInput['runId'], cwd: '/workspace', prompt: 'do it', attachments: [], model: null, effort: null, mcpConfigPath: null, rulesPaths: [], env: {}, auth: 'vendor-login', vendorBudget: { maxMicroUsd: null }, transport: { spawn: () => { throw new Error('unused'); } }, ...over });

describe('codex adapter', () => {
  it('builds start argv', () => { expect(argvFor(input({ model: 'gpt-5' }))).toEqual(['codex', 'exec', '--json', '--model', 'gpt-5', 'do it']); });
  it('builds resume argv', () => { expect(argvFor({ ...input(), adapterSessionId: 'sess_1' })).toEqual(['codex', 'exec', 'resume', 'sess_1', '--json', 'do it']); });
  it('parses fixture session, text, tools, usage, and done', () => {
    const events = parseCodexJsonl(readFileSync(new URL('../fixtures/happy.jsonl', import.meta.url), 'utf8'));
    expect(events).toEqual([
      { t: 'session', adapterSessionId: 'codex-sess' },
      { t: 'tool_call', id: 'cmd_1', name: 'shell', input: { command: 'bash -lc ls' } },
      { t: 'tool_result', id: 'cmd_1', ok: true, output: 'ok' },
      { t: 'text', delta: 'Hello' },
      { t: 'usage', inputTokens: 12, outputTokens: 4, cacheTokens: 2, cumulative: true },
      { t: 'done', stopReason: 'end_turn', error: undefined }
    ]);
  });
  it('never references auth.json or child_process', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('auth.json'); expect(src).not.toContain('child_process');
  });
});
