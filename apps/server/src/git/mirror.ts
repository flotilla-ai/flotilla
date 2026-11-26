import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Project, Thread } from '@flotilla/core/types';
import { assertPushAllowed } from '@flotilla/core/kernel/branchGuard';
import { KernelDenied } from '@flotilla/core/types';
import type { ProcessTransport } from '@flotilla/core/types';

const exec = promisify(execFile);
export type GitDriver = {
  copyIn(containerId: string, dir: string, tar: Buffer): Promise<void>;
  copyOut(containerId: string, path: string): Promise<Buffer>;
  transport(containerId: string): ProcessTransport;
};
export type GitProject = Pick<Project, 'id' | 'repo' | 'trust'> & { token?: string };
export type GitThread = Pick<Thread, 'id' | 'code' | 'title' | 'branch'> & { containerId: string };

const locks = new Map<string, Promise<unknown>>();
async function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  locks.set(key, next.catch(() => undefined));
  return next;
}
function envWithToken(project: GitProject): NodeJS.ProcessEnv {
  if (!project.token) return { ...process.env, GIT_CONFIG_NOSYSTEM: '1' };
  return { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.extraHeader', GIT_CONFIG_VALUE_0: `Authorization: Bearer ${project.token}` };
}
async function git(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return exec('git', args, { cwd: opts.cwd, maxBuffer: 256 * 1024 * 1024, env: { ...(opts.env ?? process.env), HOME: opts.env?.HOME ?? process.env.HOME } });
}
export function mirrorPath(root: string, project: GitProject): string { return join(root, `${project.id}.git`); }
export async function ensureMirror(project: GitProject, root = '/data/mirrors'): Promise<string> {
  const path = mirrorPath(root, project);
  const env = envWithToken(project);
  const raw = project.repo.fullName;
  const url = raw.startsWith('http') || raw.startsWith('/') || raw.startsWith('file:') ? raw : `https://github.com/${raw}.git`;
  try { await git(['--git-dir', path, 'rev-parse', '--is-bare-repository'], { env }); }
  catch { await git(['clone', '--bare', url, path], { env }); }
  await git(['--git-dir', path, 'fetch', '--prune', 'origin', '+refs/heads/*:refs/heads/*'], { env });
  return path;
}
async function collect(iter: AsyncIterable<string>): Promise<string> { let out = ''; for await (const x of iter) out += x; return out; }
async function runTransport(transport: ProcessTransport, argv: string[], cwd: string): Promise<void> {
  const h = transport.spawn(argv, { cwd, env: {} });
  const [stdout, stderr, exit] = await Promise.all([collect(h.stdout), collect(h.stderr), h.exit]);
  if (exit.code !== 0) throw new Error(`${argv.join(' ')} failed: ${stderr || stdout}`);
}
function slug(title: string): string { return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'work'; }
async function tarOne(file: string, inner: string): Promise<Buffer> { return (await exec('tar', ['-C', join(file, '..'), '-cf', '-', inner], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 } as never)).stdout as unknown as Buffer; }

export async function seedWorkspace(thread: GitThread, project: GitProject, driver: GitDriver, root = '/data/mirrors'): Promise<{ branch: string }> {
  const mirror = await ensureMirror(project, root);
  const tmp = mkdtempSync(join(tmpdir(), 'flt-seed-'));
  try {
    const bundle = join(tmp, 'seed.bundle');
    await git(['--git-dir', mirror, 'bundle', 'create', bundle, project.repo.baseBranch]);
    const tar = await tarOne(bundle, 'seed.bundle');
    await driver.copyIn(thread.containerId, '/tmp', tar);
    const transport = driver.transport(thread.containerId);
    await runTransport(transport, ['git', 'clone', '--branch', project.repo.baseBranch, '/tmp/seed.bundle', '/workspace/repo'], '/workspace');
    const branch = thread.branch ?? `flotilla/${thread.code}-${slug(thread.title)}`;
    await runTransport(transport, ['git', 'switch', '-c', branch], '/workspace/repo');
    return { branch };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

function branchOwnedByThread(branch: string, thread: GitThread): boolean {
  return branch.startsWith(`flotilla/${thread.code}-`);
}
async function mirrorDefaultBranch(mirror: string, fallback: string, env: NodeJS.ProcessEnv): Promise<string> {
  try {
    const head = (await git(['--git-dir', mirror, 'symbolic-ref', '--short', 'HEAD'], { env })).stdout.trim();
    return head.replace(/^refs\/heads\//, '') || fallback;
  } catch { return fallback; }
}
export async function collectAndPush(thread: GitThread, project: GitProject, driver: GitDriver, root = '/data/mirrors'): Promise<{ pushedSha: string }> {
  return serialized(project.repo.fullName, async () => {
    const mirror = await ensureMirror(project, root);
    const transport = driver.transport(thread.containerId);
    await runTransport(transport, ['git', 'bundle', 'create', '/tmp/thread.bundle', '--glob=refs/heads/flotilla/*'], '/workspace/repo');
    const tar = await driver.copyOut(thread.containerId, '/tmp/thread.bundle');
    const tmp = mkdtempSync(join(tmpdir(), 'flt-push-'));
    try {
      const inputTar = join(tmp, 'in.tar');
      await import('node:fs').then((fs) => fs.writeFileSync(inputTar, tar));
      await exec('tar', ['-xf', inputTar, '-C', tmp]);
      const bundle = join(tmp, 'thread.bundle');
      const prefix = `refs/incoming/${thread.id}`;
      await git(['--git-dir', mirror, 'fetch', bundle, `+refs/heads/*:${prefix}/*`], { env: envWithToken(project) });
      const refs = (await git(['--git-dir', mirror, 'for-each-ref', '--format=%(refname) %(objectname)', prefix])).stdout.trim().split('\n').filter(Boolean);
      if (!refs.length) throw new Error('no flotilla refs in bundle');
      let sha = '';
      const cleanEnv = { ...envWithToken(project), HOME: tmp, GIT_CONFIG_NOSYSTEM: '1' };
      const defaultBranch = await mirrorDefaultBranch(mirror, project.repo.baseBranch, envWithToken(project));
      const parsed = refs.map((line) => {
        const [ref, object] = line.split(' ');
        const branch = ref.slice(prefix.length + 1);
        assertPushAllowed(branch, { baseBranch: project.repo.baseBranch, defaultBranch });
        if (!branchOwnedByThread(branch, thread)) throw new KernelDenied('protected-branch', `refusing push to foreign thread branch ${branch}`);
        return { ref, object, branch };
      });
      for (const item of parsed) {
        await git(['--git-dir', mirror, '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', 'push', 'origin', `${item.ref}:refs/heads/${item.branch}`], { env: cleanEnv });
        sha = item.object;
      }
      return { pushedSha: sha };
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
}

export async function checkVisibility(project: GitProject): Promise<{ forceUntrusted: boolean; kernelDenied?: 'scope' }> {
  const res = await fetch(`https://api.github.com/repos/${project.repo.fullName}`);
  if (!res.ok) return { forceUntrusted: false };
  const body = await res.json() as { private?: boolean };
  return body.private === false && project.trust === 'trusted' ? { forceUntrusted: true, kernelDenied: 'scope' } : { forceUntrusted: false };
}
