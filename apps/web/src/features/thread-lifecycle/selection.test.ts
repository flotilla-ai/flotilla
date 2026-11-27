import { describe, expect, it } from 'vitest';
import { selectRange } from './selection.js';

describe('CAPY-019 bulk selection', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];
  it('click toggles one thread', () => {
    expect([...selectRange(order, new Set(['a']), 'a', 'c', false)]).toEqual(['a', 'c']);
    expect([...selectRange(order, new Set(['a', 'c']), 'a', 'c', false)]).toEqual(['a']);
  });
  it('shift-click selects the range from the anchor in either direction', () => {
    expect([...selectRange(order, new Set(['b']), 'b', 'd', true)].sort()).toEqual(['b', 'c', 'd']);
    expect([...selectRange(order, new Set(['e']), 'e', 'c', true)].sort()).toEqual(['c', 'd', 'e']);
    expect([...selectRange(order, new Set(), null, 'c', true)]).toEqual(['c']);
  });
});
