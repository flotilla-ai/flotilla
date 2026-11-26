import { describe, expect, it } from 'vitest';
import { approvalSchema, eventSchema } from './schemas.js';

describe('core boundary schemas', () => {
  it('accepts a valid event', () => {
    expect(eventSchema.safeParse({
      id: 'evt_1', seq: 1, threadId: 'thr_1', runId: null, kind: 'thread.created',
      at: new Date().toISOString(), source: 'kernel', trust: 'trusted', payload: {}
    }).success).toBe(true);
  });

  it('rejects an approval with an unprefixed id', () => {
    expect(approvalSchema.safeParse({
      id: 'bad', threadId: 'thr_1', captainId: null, kind: 'budget', question: 'q',
      options: [], blocking: true, state: 'open', answer: null
    }).success).toBe(false);
  });
});
