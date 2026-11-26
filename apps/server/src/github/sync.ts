import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Event, Thread } from '@flotilla/core/types';
import { autofixDecision, type AutofixAttempt } from '@flotilla/core/kernel/autofix';
import { collectAndPush, type GitDriver, type GitProject, type GitThread } from '../git/mirror.js';
import type { EventStore } from '../events/store.js';
import { checksState, errorSignature, GitHubClient, type CheckRun } from './client.js';

export function verifyWebhook(secret: string, body: string, signature: string | null): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const want = createHmac('sha256', secret).update(body).digest('hex');
  const got = signature.slice(7);
  return want.length === got.length && timingSafeEqual(Buffer.from(want), Buffer.from(got));
}
export async function pushAndOpenPr(input: { thread: GitThread & { prs?: { repo: string; number: number; owned: boolean }[] }; project: GitProject; driver: GitDriver; github: GitHubClient; store: EventStore; token?: string }): Promise<{ number: number | null; pushedSha: string | null }> {
  const pushed = await collectAndPush(input.thread, input.project, input.driver);
  if (!pushed.pushedSha) return { number: null, pushedSha: null };
  const branch = input.thread.branch ?? '';
  const pr = await input.github.openOrFindPr(input.project.repo.fullName, branch, input.project.repo.baseBranch, input.thread.title);
  const prRecord = { repo: input.project.repo.fullName, number: pr.number, owned: true };
  const existing = input.thread.prs ?? [];
  const prs = existing.some((x) => x.repo === prRecord.repo && x.number === prRecord.number) ? existing : [...existing, prRecord];
  await input.store.pool.query('UPDATE threads SET prs=$2, branch=$3 WHERE id=$1', [input.thread.id, JSON.stringify(prs), branch]);
  await input.store.pool.query('INSERT INTO prs (repo,number,thread_id,head_branch,owned) VALUES ($1,$2,$3,$4,true) ON CONFLICT (repo,number) DO UPDATE SET thread_id=$3, head_branch=$4, owned=true', [input.project.repo.fullName, pr.number, input.thread.id, branch]);
  await input.store.appendEvents(input.thread.id as Event['threadId'], [
    { threadId: input.thread.id as Event['threadId'], runId: null, kind: 'pr.pushed', source: 'github', trust: 'trusted', payload: { sha: pushed.pushedSha } },
    { threadId: input.thread.id as Event['threadId'], runId: null, kind: 'pr.opened', source: 'github', trust: 'trusted', payload: { repo: input.project.repo.fullName, number: pr.number, url: pr.html_url } }
  ]);
  return { number: pr.number, pushedSha: pushed.pushedSha };
}
export type CheckWake = { kind: 'none' } | { kind: 'green'; sha: string } | { kind: 'failed'; log: string; signature: string; autofix: 'retry' | { stop: 'cap' | 'no-progress' } };
export function evaluateChecks(checks: CheckRun[], sha: string, history: AutofixAttempt[], log = '', greenAlreadySent = false): CheckWake {
  const state = checksState(checks);
  if (state === 'pending') return { kind: 'none' };
  if (state === 'green') return greenAlreadySent ? { kind: 'none' } : { kind: 'green', sha };
  const signature = errorSignature(log);
  return { kind: 'failed', log: log.split('\n').slice(-200).join('\n'), signature, autofix: autofixDecision([...history, { attempt: history.length + 1, signature }]) };
}
export async function emitCheckWake(store: EventStore, threadId: Thread['id'], wake: Exclude<CheckWake,{kind:'none'}>): Promise<void> {
  if (wake.kind === 'green') {
    await store.appendEvents(threadId, [{ threadId, runId: null, kind: 'ci.passed', source: 'github', trust: 'trusted', payload: { sha: wake.sha } }]);
    return;
  }
  const events = [{ threadId, runId: null, kind: 'ci.failed' as const, source: 'github' as const, trust: 'untrusted' as const, payload: { log: wake.log, signature: wake.signature } }];
  await store.appendEvents(threadId, events);
}
