import { createHash, randomBytes } from 'node:crypto';
export type IssuedRunToken = { token: string; runId: string; captainId: string };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export class RunTokenService {
  private readonly byHash = new Map<string, IssuedRunToken>();
  issue(runId: string, captainId: string): IssuedRunToken {
    const issued = { token: randomBytes(32).toString('base64url'), runId, captainId };
    this.byHash.set(hash(issued.token), issued); return issued;
  }
  authenticate(token: string | undefined): IssuedRunToken | null { return token ? this.byHash.get(hash(token)) ?? null : null; }
  endRun(runId: string): void { for (const [h, x] of this.byHash) if (x.runId === runId) this.byHash.delete(h); }
}
