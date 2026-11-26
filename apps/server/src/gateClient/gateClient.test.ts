import { describe, expect, it } from 'vitest';
import { mergedAllowlist } from './index.js';

describe('gateClient', () => {
  it('merges adapter and project allowlists without duplicates', () => {
    expect(mergedAllowlist(['api.github.com','npmjs.org'],['api.github.com','example.com'])).toEqual(['api.github.com','example.com','npmjs.org']);
  });
});
