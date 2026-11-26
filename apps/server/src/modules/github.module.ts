import { EventStore } from '../events/store.js';
import { GitHubClient } from '../github/client.js';
import { CheckMonitor } from '../github/monitor.js';
import { setCheckMonitor } from '../github/registry.js';
import { defaultRunner } from '../routes/threads.route.js';
import { onAfterRun } from '../runner/runner.js';
import { pushAndOpenPr } from '../github/sync.js';
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
    const unregister = onAfterRun(async ({ thread, project, state, containerId, driver }) => {
      if (!project || state !== 'completed') return;
      await pushAndOpenPr({ thread: { id: thread.id, code: thread.code, title: thread.title, branch: thread.branch, prs: thread.prs, containerId } as never, project: { id: project.id, repo: project.repo, trust: project.trust, token: process.env.GITHUB_TOKEN } as never, driver, github: new GitHubClient(process.env.GITHUB_TOKEN ?? ''), store });
    });
    const timer = setInterval(() => { void checkMonitor?.pollOnce().catch(() => undefined); }, 60_000);
    return async () => { unregister(); clearInterval(timer); setCheckMonitor(null); checkMonitor = null; await store.pool.end().catch(() => undefined); };
  }
};
