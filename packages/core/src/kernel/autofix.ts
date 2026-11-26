export type AutofixAttempt = { attempt: number; signature: string };
export function autofixDecision(history: AutofixAttempt[], cap = 3): 'retry' | { stop: 'cap' | 'no-progress' } {
  if (history.length >= cap) return { stop: 'cap' };
  const last = history.at(-1);
  if (last && history.slice(0, -1).some((x) => x.signature === last.signature)) return { stop: 'no-progress' };
  return 'retry';
}
