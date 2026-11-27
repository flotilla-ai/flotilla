import { PassThrough } from 'node:stream';
import type Docker from 'dockerode';
import { scrubString } from '@flotilla/core/kernel/scrub';
import type { RunResult } from '../environments/types.js';
import { SNAPSHOT_STEPS, checkDiskBudget, tiersToCapture, type SnapshotImage, type SnapshotSpec, type SnapshotStep, type SnapshotStepLog, type SnapshotTier } from './types.js';

export type SnapshotInput = {
  docker: Docker; containerId: string; projectId: string; buildId: string; spec: SnapshotSpec;
  repo: { fullName: string; baseBranch?: string } | null; setup(): Promise<RunResult>; capacityGb?: Record<SnapshotTier, number>;
};
export type SnapshotResult = { state: 'succeeded' | 'failed'; failedStep: SnapshotStep | null; usedGb: number | null; images: SnapshotImage[]; steps: SnapshotStepLog[] };
export const snapshotRepo = (projectId: string) => `flotilla-snapshot/${projectId.toLowerCase().replace(/[^a-z0-9._-]/g, '-')}`;
const SECRET_NAME = /TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_?KEY|PRIVATE/i;
const SCAN_DIRS = '/workspace /root /home /run /tmp';
const TAIL = 8 * 1024;

async function sh(docker: Docker, id: string, script: string, env: Record<string, string> = {}): Promise<{ code: number | null; out: string }> {
  const ex = await docker.getContainer(id).exec({ Cmd: ['sh', '-c', script], Env: Object.entries(env).map(([k, v]) => `${k}=${v}`), AttachStdout: true, AttachStderr: true });
  const stream = await ex.start({ hijack: true, stdin: false });
  const pass = new PassThrough(); let out = '';
  pass.on('data', (c: Buffer) => { out = (out + c.toString()).slice(-TAIL); });
  docker.modem.demuxStream(stream, pass, pass);
  await new Promise<void>((r) => { stream.on('end', r); stream.on('close', r); stream.on('error', () => r()); });
  return { code: (await ex.inspect()).ExitCode ?? null, out };
}
/** Values handed to the machine: `/run/flotilla/secrets.env` plus secret-named container env vars. */
async function knownSecrets(docker: Docker, id: string, env: string[]): Promise<Record<string, string>> {
  const known: Record<string, string> = {};
  for (const e of env) { const at = e.indexOf('='); if (at > 0 && SECRET_NAME.test(e.slice(0, at)) && e.length - at > 8) known[e.slice(0, at)] = e.slice(at + 1); }
  const tar = await (async () => { const s = await docker.getContainer(id).getArchive({ path: '/run/flotilla/secrets.env' }); const c: Buffer[] = []; for await (const x of s) c.push(Buffer.from(x)); return Buffer.concat(c); })().catch(() => null);
  const body = tar && tar.length >= 512 ? tar.subarray(512, 512 + parseInt(tar.subarray(124, 135).toString(), 8)).toString('utf8') : '';
  for (const m of body.matchAll(/^export ([A-Za-z_][A-Za-z0-9_]*)='((?:[^']|'\\'')*)'$/gm)) known[m[1]] = m[2].replace(/'\\''/g, "'");
  return known;
}

/** setup → repos (workspace copy, repo choice, disk budget) → scrub → verify → capture (`docker commit`, one tag per tier). */
export async function buildSnapshot(input: SnapshotInput): Promise<SnapshotResult> {
  const { docker } = input;
  const source = await docker.getContainer(input.containerId).inspect();
  const volume = source.Mounts?.find((m) => m.Destination === '/workspace')?.Name;
  const known = await knownSecrets(docker, input.containerId, source.Config?.Env ?? []);
  const clean = (s: string) => scrubString(s, known).slice(-TAIL);
  const tmp = `${snapshotRepo(input.projectId)}-tmp:${input.buildId.toLowerCase()}`;
  const steps: SnapshotStepLog[] = []; let failedStep: SnapshotStep | null = null; let usedGb: number | null = null; let images: SnapshotImage[] = [];
  let box: Docker.Container | null = null; const blank: string[] = [];
  const step = async (name: SnapshotStep, fn: () => Promise<string>) => {
    if (failedStep) { steps.push({ step: name, state: 'skipped', output: '', ms: 0 }); return; }
    const t = Date.now();
    try { steps.push({ step: name, state: 'passed', output: clean(await fn()), ms: Date.now() - t }); } catch (err) { failedStep = name; steps.push({ step: name, state: 'failed', output: clean((err as Error).message), ms: Date.now() - t }); }
  };
  const run = async (script: string, env: Record<string, string> = {}) => { const r = await sh(docker, box!.id, script, env); if (r.code !== 0) throw new Error(r.out || `exit ${r.code}`); return r.out; };
  try {
    await step('setup', async () => { const r = await input.setup(); if (r.state !== 'passed') throw new Error(`setup ${r.state} (exit ${r.exitCode})\n${r.output}`); return r.output; });
    await step('repos', async () => {
      if (!volume) throw new Error('thread machine has no /workspace volume');
      await docker.getContainer(input.containerId).commit({ repo: tmp.split(':')[0], tag: tmp.split(':')[1], pause: true });
      box = await docker.createContainer({ Image: tmp, Cmd: ['sleep', 'infinity'], Labels: { 'flotilla.snapshot': input.buildId }, NetworkDisabled: true,
        HostConfig: { NetworkMode: 'none', CapDrop: ['ALL'], CapAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER'], SecurityOpt: ['no-new-privileges'], Mounts: [{ Type: 'volume', Source: volume, Target: '/flotilla-src', ReadOnly: true }] } });
      await box.start();
      const keep = !!input.repo && input.spec.repos.includes(input.repo.fullName);
      const base = input.repo?.baseBranch && /^[\w./-]+$/.test(input.repo.baseBranch) ? input.repo.baseBranch : '';
      const du = await run(`cp -a /flotilla-src/. /workspace/ && ${keep ? `if [ -n "${base}" ] && [ -d /workspace/repo/.git ] && command -v git >/dev/null; then git -C /workspace/repo checkout -q -f --detach "${base}" || true; fi` : 'rm -rf /workspace/repo'} && du -sk /workspace | cut -f1`);
      usedGb = ((await docker.getImage(tmp).inspect()).Size + Number(du.trim().split('\n').pop()) * 1024) / 1e9;
      const over = checkDiskBudget(usedGb, input.spec.tier, input.capacityGb);
      if (over) throw new Error(over);
      return `repos: ${keep ? input.repo!.fullName : 'none'}; ${usedGb.toFixed(3)} GB of the ${input.spec.tier} GB tier`;
    });
    await step('scrub', async () => {
      await run('find /run/flotilla -mindepth 1 -delete 2>/dev/null; rm -f /tmp/seed.bundle /tmp/thread.bundle; for h in /root /home/*; do rm -f "$h/.bash_history" "$h/.git-credentials" 2>/dev/null; done; true');
      for (const e of source.Config?.Env ?? []) { const [k] = e.split('='); const v = e.slice(k.length + 1); if (SECRET_NAME.test(k) || Object.values(known).some((s) => v.includes(s))) blank.push(k); }
      return `removed secrets file, git bundles, shell history, git credentials; cleared env ${blank.join(', ') || '(none)'}`;
    });
    await step('verify', async () => {
      const values = Object.values(known);
      if (!values.length) return 'no secret values were given to this machine';
      const env = Object.fromEntries(values.map((v, i) => [`FLT_SCAN_${i}`, v]));
      const found = await sh(docker, box!.id, `for i in $(seq 0 ${values.length - 1}); do eval "v=\\$FLT_SCAN_$i"; grep -rlsF --exclude-dir=flotilla-src -e "$v" ${SCAN_DIRS}; done | sort -u`, env);
      if (found.out.trim()) throw new Error(`secret values still present after scrub, capture refused:\n${found.out.trim()}`);
      return `scanned ${SCAN_DIRS} for ${values.length} secret value(s): none found`;
    });
    await step('capture', async () => {
      const tiers = tiersToCapture(input.spec, usedGb!, input.capacityGb); const repo = snapshotRepo(input.projectId);
      const tag = (t: SnapshotTier) => `${input.buildId.toLowerCase()}-${t}gb`;
      const img = await box!.commit({ repo, tag: tag(tiers[0]), changes: blank.map((k) => `ENV ${k}=`) }) as { Id: string };
      const env = (await docker.getImage(img.Id).inspect()).Config?.Env ?? [];
      if (env.some((e) => Object.values(known).some((s) => e.includes(s)))) { await docker.getImage(img.Id).remove({ force: true }); throw new Error('image config still carries a secret value; image removed'); }
      for (const t of tiers.slice(1)) await docker.getImage(img.Id).tag({ repo, tag: tag(t) });
      images = tiers.map((t) => ({ tier: t, ref: `${repo}:${tag(t)}` }));
      return `committed ${images.map((i) => i.ref).join(', ')}`;
    });
  } finally {
    if (box) await (box as Docker.Container).remove({ force: true }).catch(() => undefined);
    await docker.getImage(tmp).remove({ force: true }).catch(() => undefined);
  }
  for (const s of SNAPSHOT_STEPS) if (!steps.some((x) => x.step === s)) steps.push({ step: s, state: 'skipped', output: '', ms: 0 });
  return { state: failedStep ? 'failed' : 'succeeded', failedStep, usedGb, images, steps };
}
