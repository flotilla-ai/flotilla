export type GithubPr = { number: number; head: { ref: string; sha: string }; base: { ref: string }; html_url: string };
export type CheckRun = { status: string; conclusion: string | null; name: string; details_url?: string; output?: { text?: string } };
export class GitHubClient {
  constructor(readonly token: string, readonly baseUrl = 'https://api.github.com') {}
  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { authorization: `Bearer ${this.token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' } });
    if (!res.ok) throw new Error(`github ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }
  findPr(repo: string, branch: string): Promise<GithubPr | null> {
    return this.req<GithubPr[]>(`/repos/${repo}/pulls?state=open&head=${encodeURIComponent(branch)}`).then((x) => x[0] ?? null);
  }
  async openOrFindPr(repo: string, branch: string, base: string, title: string): Promise<GithubPr> {
    const existing = await this.findPr(repo, branch); if (existing) return existing;
    try { return await this.req<GithubPr>(`/repos/${repo}/pulls`, { method: 'POST', body: JSON.stringify({ title, head: branch, base }) }); }
    catch { const raced = await this.findPr(repo, branch); if (raced) return raced; throw new Error('open PR failed'); }
  }
  checkRuns(repo: string, sha: string): Promise<CheckRun[]> { return this.req<{ check_runs: CheckRun[] }>(`/repos/${repo}/commits/${sha}/check-runs`).then((x) => x.check_runs); }
  async checkLog(repo: string, run: CheckRun): Promise<string> {
    if (run.output?.text) return run.output.text.split('\n').slice(-200).join('\n');
    if (!run.details_url) return '';
    const path = run.details_url.replace(/^https:\/\/api\.github\.com/, '').replace(/^https:\/\/github\.com/, '');
    if (!path.startsWith('/repos/')) return '';
    const res = await fetch(`${this.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.token}`, accept: 'application/vnd.github+json' } });
    if (!res.ok) return '';
    const text = await res.text(); return text.split('\n').slice(-200).join('\n');
  }
}
export function checksState(checks: CheckRun[]): 'pending' | 'green' | 'failed' {
  if (checks.some((x) => x.status !== 'completed')) return 'pending';
  return checks.every((x) => ['success', 'neutral', 'skipped'].includes(x.conclusion ?? '')) ? 'green' : 'failed';
}
export function errorSignature(log: string): string {
  const lines = log.split('\n').map((x) => x.trim()).filter((x) => /error|failed|failure|exception/i.test(x));
  return (lines[0] ?? log.trim().split('\n').at(-1) ?? 'unknown').replace(/0x[0-9a-f]+|\b\d+\b/gi, '#').slice(0, 200);
}
