import { KernelDenied } from '../types.js';

export function assertPushAllowed(branch: string, ctx: { baseBranch: string; defaultBranch: string }): void {
  const protectedBranch = branch === ctx.baseBranch || branch === ctx.defaultBranch || branch === 'main' || branch === 'master' || branch === 'develop' || branch.startsWith('release/');
  if (protectedBranch || !branch.startsWith('flotilla/')) {
    throw new KernelDenied('protected-branch', `refusing push to ${branch}`);
  }
}
