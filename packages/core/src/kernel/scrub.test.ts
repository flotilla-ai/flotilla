import { describe, expect, it } from 'vitest';
import { createDeltaScrubber, scrub, scrubString } from './scrub.js';

const secret = 'correct-horse-secret';
const secrets = { anthropic: secret };

describe('secret scrubber', () => {
  it('redacts exact and URL-encoded known secrets with the secret name', () => {
    expect(scrubString(`a ${secret} b`, secrets)).toBe('a [REDACTED:anthropic] b');
    expect(scrubString(encodeURIComponent(secret), secrets)).toBe('[REDACTED:anthropic]');
  });

  it('redacts base64-encoded secrets at byte offsets 0, 1, and 2', () => {
    for (const offset of [0, 1, 2]) {
      const encoded = Buffer.concat([Buffer.alloc(offset), Buffer.from(secret)]).toString('base64');
      expect(scrubString(encoded, secrets)).toBe('[REDACTED:anthropic]');
    }
  });

  it('redacts credential patterns the server was not given', () => {
    expect(scrubString('token sk-ant-api03-fakefakefakefake', {})).toContain('[REDACTED:pattern]');
    expect(scrubString('token ghp_12345678901234567890', {})).toContain('[REDACTED:pattern]');
  });

  it('scrubs strings recursively in payloads', () => {
    expect(scrub({ nested: [secret] }, secrets)).toEqual({ nested: ['[REDACTED:anthropic]'] });
  });

  it('does not leak a secret split across three delta chunks', () => {
    const scrubber = createDeltaScrubber(secrets);
    const parts = [secret.slice(0, 7), secret.slice(7, 13), secret.slice(13)];
    const out = parts.map((p) => scrubber.push(p)).join('') + scrubber.flush();
    expect(out).not.toContain(secret);
    expect(out).toContain('[REDACTED:anthropic]');
  });
});
