export type ReaperContainer = { id: string; labels: Record<string, string>; state: string };
export type ReaperAction = { action: 'remove-orphan' | 'restart' | 'fail-thread'; containerId?: string; threadId: string };

export function reconcile(
  dbThreads: { id: string; state: 'running' | 'stopped' | 'archived' }[],
  dockerContainers: ReaperContainer[]
): ReaperAction[] {
  const actions: ReaperAction[] = [];
  const byThread = new Map(dockerContainers.filter((c) => c.labels['flotilla.thread']).map((c) => [c.labels['flotilla.thread'], c]));
  for (const container of byThread.values()) {
    const threadId = container.labels['flotilla.thread'];
    if (!dbThreads.some((t) => t.id === threadId)) actions.push({ action: 'remove-orphan', containerId: container.id, threadId });
  }
  for (const thread of dbThreads.filter((t) => t.state === 'running')) {
    const container = byThread.get(thread.id);
    if (!container || container.state !== 'running') actions.push({ action: 'restart', containerId: container?.id, threadId: thread.id });
  }
  return actions;
}
