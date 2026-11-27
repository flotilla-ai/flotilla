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
  readonly greenRecorded = new Set<string>();
  readonly greenWaking = new Set<string>();
  readonly greenSent = new Set<string>();
  readonly attempts = new Map<string, AutofixAttempt[]>();
  readonly terminalSent = new Set<string>();
  constructor(readonly deps: MonitorDeps) {}
  key(repo: string, number: number): string { return `${repo}#${number}`; }
  private async archived(threadId: string): Promise<boolean> {
    return Boolean((await this.deps.pool.query('SELECT archived_at FROM threads WHERE id=$1', [threadId])).rows[0]?.archived_at);
  }
  private async wakeIfActive(threadId: string, text: string): Promise<boolean> {
    if (await this.archived(threadId)) return false;
    await this.deps.wake(threadId, text);
    return true;
  }

  async syncRepo(repo: string): Promise<void> {
    const client = this.deps.clientFor(repo);
    const pulls = await client.listPrs(repo);
    for (const pr of pulls) {
      let checks: string | null = null;
      try { checks = checksState(await client.checkRuns(repo, pr.head.sha)); } catch { checks = null; }
      const state = pr.merged_at ? 'merged' : pr.state ?? 'open';
      await this.deps.pool.query(`INSERT INTO prs (repo,number,thread_id,head_branch,owned,title,author,state,labels,draft,checks_state,updated_at) VALUES ($1,$2,NULL,$3,false,$4,$5,$6,$7,$8,COALESCE($9,'unknown'),now()) ON CONFLICT (repo,number) DO UPDATE SET head_branch=$3,title=$4,author=$5,state=$6,labels=$7,draft=$8,checks_state=COALESCE($9,prs.checks_state),updated_at=now()`, [repo, pr.number, pr.head.ref, pr.title ?? '', pr.user?.login?.toLowerCase() ?? '', state, JSON.stringify((pr.labels ?? []).map((x) => x.name).filter(Boolean)), pr.draft === true, checks]);
    }
  }
  async process(repo: string, number: number, threadId: string, sha: string): Promise<'pending' | 'green' | 'failed'> {
    const client = this.deps.clientFor(repo);
    const checks = await client.checkRuns(repo, sha);
    const state = checksState(checks);
    await this.deps.pool.query('UPDATE prs SET checks_state=$3,updated_at=now() WHERE repo=$1 AND number=$2', [repo, number, state]);
    const key = this.key(repo, number);
    if (state === 'pending') return state;
    if (state === 'green') {
      if (!this.greenRecorded.has(key)) {
        this.greenRecorded.add(key);
        await this.deps.store.appendEvents(threadId as Event['threadId'], [{ threadId: threadId as Event['threadId'], runId: null, kind: 'ci.passed', source: 'github', trust: 'trusted', payload: { repo, number, sha } }]);
      }
      if (!this.greenSent.has(key) && !this.greenWaking.has(key)) {
        this.greenWaking.add(key);
        try {
          if (await this.wakeIfActive(threadId, `CI passed for ${repo}#${number}`)) this.greenSent.add(key);
        } finally {
          this.greenWaking.delete(key);
        }
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
      if (await this.wakeIfActive(threadId, `CI failed for ${repo}#${number}. Autofix attempt ${current.attempt}. Log tail:\n${log}`)) this.attempts.set(key, [...prior, current]);
    } else if (!this.terminalSent.has(key)) {
      this.terminalSent.add(key);
      const id = `apr_${Math.random().toString(16).slice(2)}`;
      await this.deps.pool.query(`INSERT INTO approvals (id,thread_id,kind,question,options,blocking,state) VALUES ($1,$2,'decision',$3,$4,true,'open')`, [id, threadId, `CI autofix stopped: ${decision.stop}`, JSON.stringify([{ id: 'continue', label: 'Continue manually' }, { id: 'stop', label: 'Stop' }])]);
      await this.deps.store.appendEvents(threadId as Event['threadId'], [{ threadId: threadId as Event['threadId'], runId: null, kind: 'approval.requested', source: 'kernel', trust: 'trusted', payload: { approvalId: id, kind: 'decision', reason: decision.stop } }]);
    }
    return state;
  }
  async pollOnce(): Promise<void> {
    const installs = await this.deps.pool.query(`SELECT repositories FROM github_installations WHERE revoked_at IS NULL`).catch(() => ({ rows: [] as never[] }));
    const repos = [...new Set(installs.rows.flatMap((r: any) => Array.isArray(r.repositories) ? r.repositories : []))];
    for (const repo of repos) await this.syncRepo(String(repo)).catch(() => {});
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
