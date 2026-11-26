import { describe, expect, it } from 'vitest';
import { autofixDecision } from './autofix.js';
describe('autofixDecision',()=>{it('caps attempts and detects repeated signatures',()=>{expect(autofixDecision([])).toBe('retry');expect(autofixDecision([{attempt:1,signature:'a'},{attempt:2,signature:'b'}])).toBe('retry');expect(autofixDecision([{attempt:1,signature:'a'},{attempt:2,signature:'b'},{attempt:3,signature:'c'}])).toEqual({stop:'cap'});expect(autofixDecision([{attempt:1,signature:'a'},{attempt:2,signature:'a'}])).toEqual({stop:'no-progress'})})})
