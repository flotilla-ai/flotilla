import { EventStore } from '../events/store.js';
import { GitHubClient } from '../github/client.js';
import { CheckMonitor } from '../github/monitor.js';
import { setCheckMonitor } from '../github/registry.js';
import { defaultRunner } from '../routes/threads.route.js';
export let checkMonitor: CheckMonitor | null = null;
export default {
  name: 'github',
  async start() {
    const url = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla';
    const store = new EventStore(url);
    const monitor = new CheckMonitor({
      pool: store.pool, store,
      clientFor: () => new GitHubClient(process.env.GITHUB_TOKEN ?? ''),
      wake: async (threadId, text) => { await defaultRunner().message(threadId, text, 'queue'); }
    });
    checkMonitor = monitor;
    setCheckMonitor(monitor);
    const timer = setInterval(() => { void checkMonitor?.pollOnce().catch(() => undefined); }, 60_000);
    return async () => { clearInterval(timer); setCheckMonitor(null); checkMonitor = null; await store.pool.end().catch(() => undefined); };
  }
};
