import { randomBytes } from 'node:crypto';
import type Docker from 'dockerode';
import pg from 'pg';
import type { ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { ApiFailure } from '../api-platform/types.js';
import { environmentStore } from '../environments/store.js';
import type { RunResult } from '../environments/types.js';
import { buildSnapshot } from './builder.js';
import { failurePrompt, parseSnapshotSpec, rebuildDue, type BootPlan, type SnapshotBuild, type SnapshotSpec, type SnapshotTier } from './types.js';

type Row = Record<string, any>;
export type SnapshotDriver = { docker: Docker; transport(containerId: string): ProcessTransport };
const toBuild = (r: Row): SnapshotBuild => ({ id: r.id, projectId: r.project_id, threadId: r.thread_id, environmentVersion: r.environment_version, tier: r.tier, state: r.state, failedStep: r.failed_step, usedGb: r.used_gb, images: r.images, steps: r.steps, createdAt: r.created_at?.toISOString() ?? null, finishedAt: r.finished_at?.toISOString() ?? null });
export const projectRepos = (project: Row | null | undefined): string[] => (project?.repo?.fullName ? [project.repo.fullName] : []);

export class SnapshotStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  constructor(private readonly databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }
  async ownedProject(userId: string, projectId: string): Promise<Row> {
    const [p] = await this.q('SELECT * FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId]);
    if (!p) throw new ApiFailure('NotFound', 'project not found');
    return p;
  }
  async spec(projectId: string): Promise<{ spec: SnapshotSpec | null; requested: boolean; lastCheckAt: Date | null }> {
    const [r] = await this.q('SELECT * FROM snapshot_specs WHERE project_id=$1', [projectId]);
    return { spec: r?.spec ?? null, requested: r?.requested ?? false, lastCheckAt: r?.last_check_at ?? null };
  }
  async putSpec(project: Row, raw: unknown): Promise<SnapshotSpec> {
    const spec = parseSnapshotSpec(raw, projectRepos(project));
    await this.q(`INSERT INTO snapshot_specs (project_id,spec) VALUES ($1,$2) ON CONFLICT (project_id) DO UPDATE SET spec=EXCLUDED.spec, updated_at=now()`, [project.id, JSON.stringify(spec)]);
    return spec;
  }
  async requestRebuild(projectId: string): Promise<void> {
    if (!(await this.q('UPDATE snapshot_specs SET requested=true WHERE project_id=$1 RETURNING 1', [projectId]))[0]) throw new ApiFailure('Conflict', 'snapshots are not configured for this project');
  }
  async history(projectId: string): Promise<SnapshotBuild[]> {
    return (await this.q('SELECT * FROM snapshot_builds WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50', [projectId])).map(toBuild);
  }
  async build(projectId: string, id: string): Promise<SnapshotBuild & { ask: string | null }> {
    const [r] = await this.q('SELECT * FROM snapshot_builds WHERE project_id=$1 AND id=$2', [projectId, id]);
    if (!r) throw new ApiFailure('NotFound', 'snapshot build not found');
    const b = toBuild(r);
    return { ...b, ask: failurePrompt(b) };
  }
  /** Boot from the newest good image (else the base image); a newer failed build only adds a repair prompt. */
  async bootPlan(projectId: string, base = process.env.FLOTILLA_THREAD_IMAGE ?? 'flotilla-thread:dev'): Promise<BootPlan> {
    const [good] = (await this.q(`SELECT * FROM snapshot_builds WHERE project_id=$1 AND state='succeeded' ORDER BY created_at DESC LIMIT 1`, [projectId])).map(toBuild);
    const [last] = (await this.q(`SELECT * FROM snapshot_builds WHERE project_id=$1 AND state<>'running' ORDER BY created_at DESC LIMIT 1`, [projectId])).map(toBuild);
    const prompt = last?.state === 'failed' ? failurePrompt(last) : null;
    return { image: good?.images[0]?.ref ?? base, buildId: good?.id ?? null, repair: prompt ? { buildId: last.id, prompt } : null };
  }
  /** Hourly rebuild check after a completed run: when due, the run's machine is set up, scrubbed, verified and captured. */
  async afterRun(x: { thread: { id: string; project_id: string | null }; project: Row | null; containerId: string; driver: SnapshotDriver }, opts: { now?: Date; capacityGb?: Record<SnapshotTier, number> } = {}): Promise<SnapshotBuild | null> {
    const projectId = x.thread.project_id; if (!projectId || !x.project) return null;
    const now = opts.now ?? new Date();
    const cur = await this.spec(projectId); const env = await environmentStore(this.databaseUrl).current(projectId);
    const [good] = await this.q(`SELECT environment_version v FROM snapshot_builds WHERE project_id=$1 AND state='succeeded' ORDER BY created_at DESC LIMIT 1`, [projectId]);
    if (!rebuildDue({ ...cur, lastGoodEnvironmentVersion: good?.v ?? null, environmentVersion: env.version, now })) return null;
    const claimed = await this.q('UPDATE snapshot_specs SET last_check_at=$2, requested=false WHERE project_id=$1 AND last_check_at IS NOT DISTINCT FROM $3 AND requested=$4 RETURNING 1', [projectId, now, cur.lastCheckAt, cur.requested]);
    if (!claimed[0]) return null;
    const spec = cur.spec!; const id = `snb_${randomBytes(8).toString('hex')}`;
    await this.q(`INSERT INTO snapshot_builds (id,project_id,thread_id,environment_version,tier,state,created_at) VALUES ($1,$2,$3,$4,$5,'running',$6)`, [id, projectId, x.thread.id, env.version, spec.tier, now]);
    const setup = async (): Promise<RunResult> => {
      const [done] = await this.q(`SELECT output FROM environment_processes WHERE thread_id=$1 AND kind='setup' AND state='passed' ORDER BY updated_at DESC LIMIT 1`, [x.thread.id]);
      if (done) return { state: 'passed', exitCode: 0, output: done.output };
      const machine = { transport: x.driver.transport(x.containerId), caps: { repoDir: '/workspace/repo', sudo: false }, env: {} };
      return environmentStore(this.databaseUrl).executor(x.thread.id, machine).setup(env.spec, 'initialize');
    };
    const r = await buildSnapshot({ docker: x.driver.docker, containerId: x.containerId, projectId, buildId: id, spec, repo: x.project.repo ?? null, setup, capacityGb: opts.capacityGb })
      .catch((err) => ({ state: 'failed' as const, failedStep: 'capture' as const, usedGb: null, images: [], steps: [{ step: 'capture' as const, state: 'failed' as const, output: `snapshot build crashed: ${(err as Error).message}`.slice(0, 500), ms: 0 }] }));
    const [row] = await this.q(`UPDATE snapshot_builds SET state=$2, failed_step=$3, used_gb=$4, images=$5, steps=$6, finished_at=now() WHERE id=$1 RETURNING *`, [id, r.state, r.failedStep, r.usedGb, JSON.stringify(r.images), JSON.stringify(r.steps)]);
    return toBuild(row);
  }
}

const stores = new Map<string, SnapshotStore>();
export function snapshotStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): SnapshotStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new SnapshotStore(databaseUrl)));
  return store;
}
