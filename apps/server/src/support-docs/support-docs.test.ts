import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { TROUBLESHOOTING_INDEX } from './index.js';

describe('support docs', () => {
  it('CAPY-464: troubleshooting guide covers machine, setup, snapshot, credits, reconnect, limits, CI, waits, archive, ports and MCP recovery', async () => {
    expect(TROUBLESHOOTING_INDEX.map((x) => x.topic)).toEqual(['machine-replaced','processes-gone','setup-failed','snapshot-failing','credits','codex-reconnect','limits','ci-ignored','waits','archived','ports','mcp']);
    const doc = await readFile(new URL('../../../../docs/TROUBLESHOOTING.md', import.meta.url), 'utf8');
    for (const x of TROUBLESHOOTING_INDEX) {
      expect(doc).toContain(`## ${x.title}`); expect(doc).toContain(x.heading);
      expect(x.symptoms.length).toBeGreaterThan(0); expect(x.recovery.length).toBeGreaterThan(0);
    }
    expect(doc).not.toMatch(/TODO|TBD/);
  });
});
