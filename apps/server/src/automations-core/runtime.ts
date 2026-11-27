import { defaultRunner } from '../routes/threads.route.js';
import type { CancelAutomationRun, StartAutomationRun } from './index.js';

export function automationRuntimeDeps(): { startRun: StartAutomationRun; cancelRun: CancelAutomationRun } {
  return {
    startRun: async ({ threadId, prompt }) => (await defaultRunner().message(threadId, prompt, 'queue')).item?.id,
    cancelRun: async ({ threadId, inboxItemId }) => {
      if (!threadId) return;
      const runner = defaultRunner();
      if (inboxItemId) {
        const cancelled = await runner.inbox.cancel(threadId, inboxItemId).then(() => true).catch(() => false);
        if (cancelled) return;
      }
      await runner.stop(threadId);
    }
  };
}
