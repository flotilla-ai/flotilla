import { describe, expect, it } from 'vitest';
import { assertPushAllowed } from './branchGuard.js';

describe('branch guard', () => {
  it('denies release branches and allows flotilla branches', () => {
    expect(() => assertPushAllowed('release/1.2', { baseBranch: 'main', defaultBranch: 'main' })).toThrow('protected-branch');
    expect(() => assertPushAllowed('flotilla/x', { baseBranch: 'main', defaultBranch: 'main' })).not.toThrow();
  });
});
