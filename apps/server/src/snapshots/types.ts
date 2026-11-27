import { ApiFailure } from '../api-platform/types.js';

export const SNAPSHOT_TIERS = [64, 128, 256] as const;
export type SnapshotTier = (typeof SNAPSHOT_TIERS)[number];
/** Per project: which repos go into the image, the disk tier, and whether smaller tiers are captured too. */
export type SnapshotSpec = { enabled: boolean; repos: string[]; tier: SnapshotTier; alsoSmaller: boolean };
export type SnapshotStep = 'setup' | 'repos' | 'scrub' | 'verify' | 'capture';
export const SNAPSHOT_STEPS: readonly SnapshotStep[] = ['setup', 'repos', 'scrub', 'verify', 'capture'];
export type SnapshotStepLog = { step: SnapshotStep; state: 'passed' | 'failed' | 'skipped'; output: string; ms: number };
export type SnapshotImage = { tier: SnapshotTier; ref: string };
export type SnapshotBuildState = 'running' | 'succeeded' | 'failed';
export type SnapshotBuild = {
  id: string; projectId: string; threadId: string | null; environmentVersion: number; tier: SnapshotTier; state: SnapshotBuildState;
  failedStep: SnapshotStep | null; usedGb: number | null; images: SnapshotImage[]; steps: SnapshotStepLog[]; createdAt: string | null; finishedAt: string | null;
};
/** What a new machine for the project boots from; a failed setup or build never blocks boot. */
export type BootPlan = { image: string; buildId: string | null; repair: { buildId: string; prompt: string } | null };

export const REBUILD_CHECK_MS = 60 * 60 * 1000;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const fail = (msg: string): never => { throw new ApiFailure('ValidationFailed', msg); };

export function parseSnapshotSpec(raw: unknown, projectRepos: string[]): SnapshotSpec {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('snapshot spec must be an object');
  const r = raw as Record<string, unknown>;
  const tier = r.tier ?? 64;
  if (!SNAPSHOT_TIERS.includes(tier as SnapshotTier)) fail(`tier must be one of ${SNAPSHOT_TIERS.join(', ')} GB`);
  const repos = r.repos === undefined ? [...projectRepos] : Array.isArray(r.repos) ? r.repos : fail('repos must be an array');
  for (const x of repos) if (typeof x !== 'string' || !REPO.test(x) || !projectRepos.includes(x)) fail(`repo ${String(x)} is not in this project`);
  return { enabled: r.enabled !== false, repos: [...new Set(repos as string[])], tier: tier as SnapshotTier, alsoSmaller: r.alsoSmaller === true };
}

/** Disk-budget validation: the image must fit the chosen tier. */
export function checkDiskBudget(usedGb: number, tier: SnapshotTier, capacityGb: Record<SnapshotTier, number> = { 64: 64, 128: 128, 256: 256 }): string | null {
  return usedGb > capacityGb[tier] ? `snapshot needs ${usedGb.toFixed(2)} GB but the ${tier} GB tier holds ${capacityGb[tier]} GB; choose fewer repos or a larger tier` : null;
}
/** The chosen tier, plus every smaller tier the image also fits when `alsoSmaller` is set. */
export function tiersToCapture(spec: SnapshotSpec, usedGb: number, capacityGb?: Record<SnapshotTier, number>): SnapshotTier[] {
  if (checkDiskBudget(usedGb, spec.tier, capacityGb)) return [];
  return SNAPSHOT_TIERS.filter((t) => t === spec.tier || (spec.alsoSmaller && t < spec.tier && !checkDiskBudget(usedGb, t, capacityGb))).reverse();
}

/** Hourly rebuild check: at most once per hour (unless requested), rebuild when no good build matches the current environment. */
export function rebuildDue(x: { spec: SnapshotSpec | null; requested: boolean; lastCheckAt: Date | null; lastGoodEnvironmentVersion: number | null; environmentVersion: number; now: Date }): boolean {
  if (!x.spec?.enabled) return false;
  if (!x.requested && x.lastCheckAt && x.now.getTime() - x.lastCheckAt.getTime() < REBUILD_CHECK_MS) return false;
  return x.requested || x.lastGoodEnvironmentVersion === null || x.lastGoodEnvironmentVersion < x.environmentVersion;
}

/** "Ask why it failed": a prompt carrying the failed step's log, for the agent that repairs the setup with the environment tools. */
export function failurePrompt(b: Pick<SnapshotBuild, 'id' | 'projectId' | 'environmentVersion' | 'failedStep' | 'steps'>): string | null {
  const step = b.steps.find((s) => s.state === 'failed');
  if (!step) return null;
  return [`Snapshot build ${b.id} for project ${b.projectId} (environment v${b.environmentVersion}) failed at step "${step.step}". Explain why it failed and fix it.`,
    'Use environment.read, then environment.replace with that baseVersion, then environment.verify. Never print secret values.',
    '', 'Step log (scrubbed):', step.output.slice(-4000)].join('\n');
}
