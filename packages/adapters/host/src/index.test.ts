import { describe, expect, it } from 'vitest';
import { LocalTransport, runJsonl } from './index.js';

describe('LocalTransport and runJsonl', () => {
  it('spawns a detached process and parses stdout lines', async () => {
    const run = runJsonl(new LocalTransport(), [process.execPath, '-e', 'console.log(JSON.stringify({n:1}))'], { cwd: process.cwd(), env: process.env as Record<string, string> }, (line) => JSON.parse(line));
    const out = [];
    for await (const event of run.events) out.push(event);
    expect(out).toEqual([{ n: 1 }]);
  });

  it('reports a missing executable instead of crashing', async () => {
    const run = runJsonl(new LocalTransport(), ['definitely-missing-flotilla-cli'], { cwd: process.cwd(), env: process.env as Record<string, string> }, () => null);
    const out = [];
    for await (const event of run.events) out.push(event);
    expect(out.at(-1)).toMatchObject({ t: 'done', stopReason: 'error' });
  });

  it('drains stderr so diagnostic output cannot block the child', async () => {
    const run = runJsonl(new LocalTransport(), [process.execPath, '-e', 'process.stderr.write("x".repeat(1024*1024));console.log(JSON.stringify({n:2}))'], { cwd: process.cwd(), env: process.env as Record<string, string> }, (line) => JSON.parse(line));
    const out = [];
    for await (const event of run.events) out.push(event);
    expect(out).toEqual([{ n: 2 }]);
  });
});
