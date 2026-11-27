import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';
process.env.FLOTILLA_ALLOW_LOCAL_GIT_REMOTES='1';
import { collectAndPush, seedWorkspace, type GitDriver, type GitProject, type GitThread } from './mirror.js';

const sh = (cmd: string, cwd?: string) => execFileSync('sh', ['-c', cmd], { cwd, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
function lines(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  return (async function* () { let rest=''; for await (const c of stream) { rest += c.toString(); const parts=rest.split('\n'); rest=parts.pop()!; for (const p of parts) yield p; } if (rest) yield rest; })();
}
class FakeDriver implements GitDriver {
  constructor(readonly root: string, readonly mutateBundleArgs?: (args: string[]) => string[]) { mkdirSync(join(root,'tmp'),{recursive:true}); }
  path(p: string) { if (p.startsWith('/tmp/')) return join(this.root,'tmp',p.slice(5)); if (p === '/workspace') return this.root; return join(this.root,p.replace(/^\/workspace\/?/,'')); }
  async copyIn(_id: string, dir: string, tar: Buffer): Promise<void> {
    const target = join(this.root, dir === '/tmp' ? 'tmp' : dir.replace(/^\//,'')); mkdirSync(target,{recursive:true}); writeFileSync(join(target,'in.tar'),tar); execFileSync('tar',['-xf',join(target,'in.tar'),'-C',target]); rmSync(join(target,'in.tar'));
  }
  async copyOut(_id: string, path: string): Promise<Buffer> {
    const actual = this.path(path); return execFileSync('tar',['-C',join(actual,'..'),'-cf','-',path.split('/').pop()!]);
  }
  transport(): ProcessTransport {
    return { spawn: (argv, opts) => {
      argv = argv.map((a) => a.startsWith('/tmp/') ? join(this.root, 'tmp', a.slice(5)) : a.startsWith('/workspace') ? join(this.root, a.slice(11)) : a);
      if (argv[0]==='git' && argv.includes(join(this.root,'tmp/thread.bundle')) && this.mutateBundleArgs) argv = this.mutateBundleArgs(argv);
      const cwd = opts.cwd === '/workspace' ? this.root : join(this.root, opts.cwd.replace(/^\/workspace\/?/, ''));
      mkdirSync(cwd,{recursive:true});
      const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...process.env, ...opts.env }, detached: true, stdio: ['ignore','pipe','pipe'] });
      return {
        stdout: lines(child.stdout!), stderr: lines(child.stderr!),
        exit: new Promise((r) => child.once('exit',(code,signal)=>r({code,signal}))),
        signal: async (sig) => { if (child.pid) process.kill(-child.pid,sig); }
      } satisfies ProcessHandle;
    } };
  }
}
let base=''; let remote=''; let mirrors=''; const project = { id:'prj_t', repo:{provider:'github' as const,fullName:'',baseBranch:'main'}, trust:'untrusted' as const, token:'secret-token' } satisfies GitProject;
const thread = { id:'thr_t', code:'FLO-1', title:'test work', branch:null, containerId:'fake' } satisfies GitThread;
beforeAll(() => {
  base=mkdtempSync(join(tmpdir(),'flt-git-')); remote=join(base,'remote.git'); mirrors=join(base,'mirrors');
  const src=join(base,'src'); mkdirSync(src,{recursive:true});
  sh('git init -b main && git config user.email a@x && git config user.name a && echo seed > README.md && git add . && git commit -m init',src);
  sh(`git clone --bare ${src} ${remote}`);
  project.repo.fullName=remote;
},20_000);
afterAll(()=>{ try { rmSync(base,{recursive:true,force:true}); } catch { /* temp cleanup races git children */ } });

describe('git mirror', () => {
  it('seeds a workspace bundle onto a flotilla branch', async () => {
    const root=mkdtempSync(join(base,'seed-')); const driver=new FakeDriver(root);
    const out=await seedWorkspace(thread,project,driver,mirrors);
    expect(out.branch).toBe('flotilla/FLO-1-test-work');
    expect(readFileSync(join(root,'repo/README.md'),'utf8')).toContain('seed');
    expect(sh('git branch --show-current',join(root,'repo')).trim()).toBe(out.branch);
  },20_000);

  it('collects and pushes without token in mirror config or agent hooks/config running', async () => {
    const root=mkdtempSync(join(base,'push-')); const driver=new FakeDriver(root);
    await seedWorkspace(thread,project,driver,mirrors);
    const repo=join(root,'repo');
    sh('git config user.email a@x && git config user.name a && echo change >> README.md && git add . && git commit -m work',repo);
    for (const f of ['hook','ssh','fs','cred']) writeFileSync(join(base,`${f}.sh`),`#!/bin/sh\n[ -z "$FLOTILLA_UNDER_TEST" ] || touch ${base}/flotilla-${f}-ran\n`);
    sh(`chmod +x ${base}/hook.sh ${base}/ssh.sh ${base}/fs.sh ${base}/cred.sh && cp ${base}/hook.sh ${repo}/.git/hooks/pre-push`);
    writeFileSync(join(repo,'.git/config'),`\n[core]\n\tsshCommand = ${base}/ssh.sh\n\tfsmonitor = ${base}/fs.sh\n[credential]\n\thelper = ${base}/cred.sh\n`,{flag:'a'});
    process.env.FLOTILLA_UNDER_TEST='1';
    let out: Awaited<ReturnType<typeof collectAndPush>>;
    try { out = await collectAndPush(thread,project,driver,mirrors); } finally { delete process.env.FLOTILLA_UNDER_TEST; }
    expect(out.pushedSha).toMatch(/^[0-9a-f]{40}$/);
    expect(sh(`git --git-dir ${remote} rev-parse refs/heads/flotilla/FLO-1-test-work`).trim()).toBe(out.pushedSha);
    expect(['hook','ssh','fs','cred'].map((f)=>[f,existsSync(join(base,`flotilla-${f}-ran`))])).toEqual([['hook',false],['ssh',false],['fs',false],['cred',false]]);
    expect(readFileSync(join(mirrors,'prj_t.git/config'),'utf8')).not.toContain('secret-token');
  },30_000);

  it('refuses protected refs even if a bundle contains them', async () => {
    const root=mkdtempSync(join(base,'bad-')); const driver=new FakeDriver(root,(argv)=>[...argv,'refs/heads/main']);
    await seedWorkspace(thread,project,driver,mirrors);
    sh('git config user.email a@x && git config user.name a && echo bad >> README.md && git add . && git commit -m bad',join(root,'repo'));
    await expect(collectAndPush(thread,project,driver,mirrors)).rejects.toThrow('protected-branch');
  },30_000);
  it('seeds and pushes a configured custom branch prefix', async () => {
    const root=mkdtempSync(join(base,'custom-')); const driver=new FakeDriver(root); const custom={...thread,id:'thr_custom' as never,branch:null};
    const seeded=await seedWorkspace(custom,project,driver,mirrors,'feature');
    expect(seeded.branch).toBe('feature/FLO-1-test-work');
    sh('git config user.email a@x && git config user.name a && echo custom >> README.md && git add . && git commit -m custom',join(root,'repo'));
    const out=await collectAndPush({...custom,branch:seeded.branch},project,driver,mirrors);
    expect(out.pushedSha).toMatch(/^[0-9a-f]{40}$/);
    expect(sh(`git --git-dir ${remote} rev-parse refs/heads/feature/FLO-1-test-work`).trim()).toBe(out.pushedSha);
  },30_000);

  it('rejects a bundle for a branch owned by another thread code', async () => {
    const root=mkdtempSync(join(base,'foreign-')); const driver=new FakeDriver(root);
    await seedWorkspace(thread,project,driver,mirrors);
    sh('git config user.email a@x && git config user.name a && echo foreign >> README.md && git add . && git commit -m foreign',join(root,'repo'));
    await expect(collectAndPush({...thread,id:'thr_foreign',code:'FLO-2'},project,driver,mirrors)).rejects.toThrow('foreign thread branch');
  },30_000);

});
