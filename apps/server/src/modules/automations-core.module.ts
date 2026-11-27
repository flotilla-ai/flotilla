import { automationStore } from '../automations-core/index.js';
import { defaultRunner } from '../routes/threads.route.js';

/** Durable automation scheduler. It scans once per minute; missed schedule occurrences collapse to the latest due run. */
export default {
  name: 'automations-core',
  async start({ log }: { log: Pick<Console, 'info' | 'warn' | 'error'>; env: NodeJS.ProcessEnv }) {
    const store = automationStore(undefined, { startRun: async ({ threadId, prompt }) => { await defaultRunner().message(threadId, prompt, 'queue'); } });
    const tick = () => void store.dueSchedules(new Date()).catch((err) => log.warn(`automation schedule scan failed: ${String((err as Error).message ?? err)}`));
    const timer = setInterval(tick, 60_000); timer.unref();
    const first = setTimeout(tick, 5_000); first.unref();
    return async () => { clearInterval(timer); clearTimeout(first); };
  }
};
