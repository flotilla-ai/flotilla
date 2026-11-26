import { describe, expect, it } from 'vitest';
import { LocalTransport, runJsonl } from './index.js';

describe('LocalTransport and runJsonl', () => {
  it('spawns a detached process and parses stdout lines', async () => {
    const run = runJsonl(new LocalTransport(), [process.execPath, '-e', 'console.log(JSON.stringify({n:1}))'], { cwd: process.cwd(), env: process.env as Record<string, string> }, (line) => JSON.parse(line));
    const out = [];
    for await (const event of run.events) out.push(event);
    expect(out).toEqual([{ n: 1 }]);
  });
});
