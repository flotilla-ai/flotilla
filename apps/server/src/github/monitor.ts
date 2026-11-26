import pg from 'pg';
import type { AutofixAttempt } from '@flotilla/core/kernel/autofix';
import { autofixDecision } from '@flotilla/core/kernel/autofix';
import type { Event } from '@flotilla/core/types';
import type { EventStore } from '../events/store.js';
import { checksState, errorSignature, GitHubClient } from './client.js';

export type MonitorDeps = {
  pool: pg.Pool; store: EventStore; clientFor(repo: string): GitHubClient;
  wake(threadId: string, text: string): Promise<void>;
  now?: () => number;
};
export class CheckMonitor {
  readonly greenSent = new Set<string>();
  readonly attempts = new Map<string, AutofixAttempt[]>();
  readonly terminalSent = new Set<string>();
  constructor(readonly deps: MonitorDeps) {}
  key(repo: string, number: number): string { return `${repo}#${number}`; }
  async process(repo: string, number: number, threadId: string, sha: string): Promise<'pending' | 'green' | 'failed'> {
    const client = this.deps.clientFor(repo);
    const checks = await client.checkRuns(repo, sha);
    const state = checksState(checks);
    const key = this.key(repo, number);
    if (state === 'pending') return state;
    if (state === 'green') {
      if (!this.greenSent.has(key)) {
        this.greenSent.add(key);
        await this.deps.store.appendEvents(threadId as Event['threadId'], [{ threadId: threadId as Event['threadId'], runId: null, kind: 'ci.passed', source: 'github', trust: 'trusted', payload: { repo, number, sha } }]);
        await this.deps.wake(threadId, `CI passed for ${repo}#${number}`);
      }
      return state;
    }
    const failing = checks.find((x) => !['success', 'neutral', 'skipped'].includes(x.conclusion ?? ''));
    const log = failing ? await client.checkLog(repo, failing) : '';
    const signature = errorSignature(log);
    const prior = this.attempts.get(key) ?? [];
    const current = { attempt: prior.length + 1, signature };
    const decision = autofixDecision([...prior, current]);
    await this.deps.store.appendEvents(threadId as Event['threadId'], [{ threadId: threadId as Event['threadId'], runId: null, kind: 'ci.failed', source: 'github', trust: 'untrusted', payload: { repo, number, sha, log: log.split('\n').slice(-200).join('\n'), signature } }]);
    if (decision === 'retry') {
      this.attempts.set(key, [...prior, current]);
      await this.deps.wake(threadId, `CI failed for ${repo}#${number}. Autofix attempt ${current.attempt}. Log tail:\n${log}`);
    } else if (!this.terminalSent.has(key)) {
      this.terminalSent.add(key);
      const id = `apr_${Math.random().toString(16).slice(2)}`;
      await this.deps.pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,'decision',$3,$4,true,'open')`, [id, threadId, `CI autofix stopped: ${decision.stop}`, JSON.stringify([{ id: 'continue', label: 'Continue manually' }, { id: 'stop', label: 'Stop' }])]);
      await this.deps.store.appendEvents(threadId as Event['threadId'], [{ threadId: threadId as Event['threadId'], runId: null, kind: 'approval.requested', source: 'kernel', trust: 'trusted', payload: { approvalId: id, kind: 'decision', reason: decision.stop } }]);
    }
    return state;
  }
  async pollOnce(): Promise<void> {
    const rows = await this.deps.pool.query(`SELECT t.id thread_id, p.repo repo, pr.number, pr.head_branch FROM prs pr JOIN threads t ON t.id=pr.thread_id JOIN projects p ON p.id=t.project_id WHERE pr.owned=true`);
    for (const row of rows.rows) {
      const repoName = typeof row.repo === 'string' ? row.repo : row.repo.fullName;
      const branch = row.head_branch;
      try {
        const client = this.deps.clientFor(repoName);
        const pr = await client.findPr(repoName, branch);
        if (pr) await this.process(repoName, row.number, row.thread_id, pr.head.sha);
      } catch { /* keep polling later */ }
    }
  }
}
