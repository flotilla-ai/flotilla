import { describe, expect, it } from 'vitest';
import { actionSignature, canOfferAlwaysAllow, classifyAction, decideAction, safeActionTarget, tightenDecision } from './actionGate.js';

describe('actionGate kernel', () => {
  it('classifies consequential actions deterministically', () => {
    expect(classifyAction({ tool: 'browser.click', text: 'Place order' })).toEqual({ class: 'consequential', kind: 'purchase' });
    expect(classifyAction({ tool: 'browser.type', fieldTypes: ['password'] })).toEqual({ class: 'consequential', kind: 'credential-entry' });
    expect(classifyAction({ tool: 'browser.click', text: 'Delete repository' })).toEqual({ class: 'consequential', kind: 'delete' });
    expect(classifyAction({ tool: 'browser.click', text: 'Send' })).toEqual({ class: 'consequential', kind: 'send' });
    expect(classifyAction({ tool: 'browser.click', text: 'Accept terms' })).toEqual({ class: 'consequential', kind: 'legal-accept' });
    expect(classifyAction({ tool: 'web.fetch' })).toEqual({ class: 'read' });
    expect(classifyAction({ tool: 'browser.click', text: 'Confirm' })).toEqual({ class: 'consequential', kind: 'permission' });
  });
  it('ask-first beats allow and hard classes always ask', () => {
    const buy = { tool: 'browser.click', text: 'Buy now' };
    expect(decideAction(buy, classifyAction(buy), { askFirst: ['buy'], allow: ['buy'] }).reason).toBe('ask-first-rule');
    expect(decideAction(buy, classifyAction(buy), { allow: ['buy'] }).reason).toBe('always-ask');
    const send = { tool: 'mail.send', text: 'Send hello' };
    expect(decideAction(send, classifyAction(send), { allow: ['hello'] }).decision).toBe('allow');
  });
  it('removes URL credentials queries and fragments from stored signatures', () => {
    expect(safeActionTarget('https://user:pw@example.test/path?token=secret#frag')).toBe('https://example.test/path');
    expect(actionSignature({ tool: 'web.fetch', url: 'https://example.test/path?token=secret' })).not.toContain('secret');
  });
  it('limits rules and denies repeated signatures until cleared by caller', () => {
    const input = { tool: 'browser.click', text: 'Publish post' };
    const cls = classifyAction(input);
    const first = decideAction(input, cls, {}, new Set());
    expect(first.decision).toBe('ask');
    expect(decideAction(input, cls, {}, new Set([first.signature])).decision).toBe('deny');
    expect(actionSignature(input)).toBe(actionSignature({ ...input }));
  });
  it('hooks can tighten but not loosen kernel decisions', () => {
    const input = { tool: 'browser.click', text: 'Send' };
    const cls = classifyAction(input);
    const kernel = decideAction(input, cls, { allow: ['send'] });
    expect(kernel.decision).toBe('allow');
    expect(tightenDecision(kernel, { decision: 'ask', reason: 'hook', signature: 'x' }).decision).toBe('ask');
    const hard = decideAction(input, cls);
    expect(hard.decision).toBe('ask');
    expect(tightenDecision(hard, { decision: 'allow', reason: 'hook', signature: 'x' }).decision).toBe('ask');
  });
  it('never offers always-allow for purchase delete or credentials', () => {
    expect(canOfferAlwaysAllow({ class: 'consequential', kind: 'send' })).toBe(true);
    expect(canOfferAlwaysAllow({ class: 'consequential', kind: 'purchase' })).toBe(false);
    expect(canOfferAlwaysAllow({ class: 'consequential', kind: 'delete' })).toBe(false);
    expect(canOfferAlwaysAllow({ class: 'consequential', kind: 'credential-entry' })).toBe(false);
  });
});
