import type { CheckMonitor } from './monitor.js';
export type CheckRunWebhook = {
  action?: string;
  repository?: { full_name?: string };
  check_run?: { head_sha?: string; pull_requests?: { number?: number }[] };
};
export async function handleCheckRunWebhook(monitor: CheckMonitor, body: CheckRunWebhook): Promise<boolean> {
  const repo = body.repository?.full_name;
  const sha = body.check_run?.head_sha;
  const number = body.check_run?.pull_requests?.[0]?.number;
  if (!repo || !sha || !number) return false;
  const rows = await monitor.deps.pool.query('SELECT thread_id FROM prs WHERE repo=$1 AND number=$2', [repo, number]);
  const threadId = rows.rows[0]?.thread_id;
  if (!threadId) return false;
  await monitor.process(repo, number, threadId, sha);
  return true;
}
