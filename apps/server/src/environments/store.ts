import pg from 'pg';
import type { ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { ApiFailure } from '../api-platform/types.js';
import { EnvironmentExecutor, type EnvironmentMachine, type ExecutorOptions, type ProcessReport } from './executor.js';
import { SETUP_FILES, choosePhase, parseEnvironmentSpec, parseSetupFile, type EnvironmentSource, type EnvironmentSpec, type EnvironmentVersion, type ProcessState, type RunResult } from './types.js';

type Row = Record<string, any>;
const toVersion = (r: Row): EnvironmentVersion => ({ projectId: r.project_id, version: r.version, spec: parseEnvironmentSpec(r.spec), source: r.source, createdBy: r.created_by, threadId: r.thread_id, note: r.note, verification: r.verification, createdAt: r.created_at?.toISOString() ?? null });
const same = (a: EnvironmentSpec, b: EnvironmentSpec) => JSON.stringify(a) === JSON.stringify(b);
export type EnvironmentMenu = {
  setup: { name: string; state: ProcessState }[];
  services: { name: string; state: ProcessState; readinessPort: number | null; preview: boolean }[];
  commands: { name: string; state: ProcessState; description: string }[];
  terminals: { name: string; state: ProcessState }[];
};
type CopyOut = { copyOut(containerId: string, path: string): Promise<Buffer>; transport(containerId: string): ProcessTransport };
const MAX_SETUP_FILE = 64 * 1024;
/** Size of a regular (non-symlink) file inside the machine, or null; checked before `copyOut` buffers it. */
async function fileSize(t: ProcessTransport, path: string): Promise<number | null> {
  const h = t.spawn(['bash', '-c', 'test -f "$1" && test ! -L "$1" && stat -c %s "$1"', '_', path], { cwd: '/', env: {} });
  let out = ''; const drain = (async () => { for await (const l of h.stdout) out += l; })(); void (async () => { for await (const _ of h.stderr); })();
  const [{ code }] = await Promise.all([h.exit, drain]);
  return code === 0 && /^\d+$/.test(out.trim()) ? Number(out.trim()) : null;
}
function untarFirst(tar: Buffer): string | null {
  if (tar.length < 512 || tar.subarray(0, 100).every((b) => b === 0)) return null;
  return tar.subarray(512, 512 + parseInt(tar.subarray(124, 135).toString(), 8)).toString('utf8');
}

export class EnvironmentStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  constructor(private readonly databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }

  async ownedProject(userId: string, projectId: string): Promise<string> {
    if (!(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId]))[0]) throw new ApiFailure('NotFound', 'project not found');
    return projectId;
  }
  /** The thread's project; an environment is always reached through the caller's own thread. */
  async ownedThread(userId: string, threadId: string): Promise<string | null> {
    const [t] = await this.q('SELECT project_id FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]);
    if (!t) throw new ApiFailure('NotFound', 'thread not found');
    return t.project_id;
  }
  async threadProject(userId: string, threadId: string): Promise<string> {
    const projectId = await this.ownedThread(userId, threadId);
    if (!projectId) throw new ApiFailure('Conflict', 'thread has no project environment');
    return projectId;
  }
  async current(projectId: string): Promise<EnvironmentVersion> {
    const [r] = await this.q('SELECT * FROM environment_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1', [projectId]);
    return r ? toVersion(r) : { projectId, version: 0, spec: parseEnvironmentSpec({}), source: 'user', createdBy: null, threadId: null, note: '', verification: null, createdAt: null };
  }
  async history(projectId: string): Promise<EnvironmentVersion[]> {
    return (await this.q('SELECT * FROM environment_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 100', [projectId])).map(toVersion);
  }
  /** Appends a version (whole-spec replace). `baseVersion` guards against overwriting a newer edit. */
  async replace(projectId: string, spec: EnvironmentSpec, by: { source: EnvironmentSource; actor?: string | null; threadId?: string | null; note?: string; baseVersion?: number }): Promise<EnvironmentVersion> {
    const cur = await this.current(projectId);
    if (by.baseVersion !== undefined && by.baseVersion !== cur.version) throw new ApiFailure('Conflict', `environment changed: current version is ${cur.version}`);
    try {
      const [r] = await this.q(`INSERT INTO environment_versions (project_id,version,spec,source,created_by,thread_id,note) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [projectId, cur.version + 1, JSON.stringify(spec), by.source, by.actor ?? null, by.threadId ?? null, (by.note ?? '').slice(0, 500)]);
      return toVersion(r);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new ApiFailure('Conflict', 'environment changed concurrently');
      throw err;
    }
  }
  async report(threadId: string, r: ProcessReport): Promise<void> {
    await this.q(`INSERT INTO environment_processes (thread_id,kind,name,state,exit_code,output,head) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (thread_id,kind,name) DO UPDATE SET state=EXCLUDED.state, exit_code=EXCLUDED.exit_code, output=EXCLUDED.output, head=coalesce(EXCLUDED.head, environment_processes.head), updated_at=now()`,
    [threadId, r.kind, r.name, r.state, r.exitCode, r.output, r.head ?? null]);
  }
  executor(threadId: string, machine: EnvironmentMachine, opts: ExecutorOptions = {}): EnvironmentExecutor {
    return new EnvironmentExecutor(threadId, machine, { ...opts, report: (r) => this.report(threadId, r) });
  }
  /** Machine boot seam: runs initialize (fresh clone) or refresh (checkout moved), then the startup entries. */
  async prepare(threadId: string, machine: EnvironmentMachine, at: { freshClone: boolean; head: string | null }, opts: ExecutorOptions = {}): Promise<RunResult | null> {
    const [t] = await this.q('SELECT project_id FROM threads WHERE id=$1', [threadId]);
    if (!t?.project_id) return null;
    const lastHead = (await this.q(`SELECT max(head) h FROM environment_processes WHERE thread_id=$1 AND kind='setup'`, [threadId]))[0]?.h ?? null;
    const phase = choosePhase({ ...at, lastHead });
    const { spec } = await this.current(t.project_id);
    const ex = this.executor(threadId, machine, opts);
    const result = phase ? await ex.setup(spec, phase, at.head) : null;
    await ex.startServices(spec);
    return result;
  }
  async menu(threadId: string): Promise<EnvironmentMenu> {
    const [t] = await this.q('SELECT project_id FROM threads WHERE id=$1', [threadId]);
    const { spec } = t?.project_id ? await this.current(t.project_id) : { spec: parseEnvironmentSpec({}) };
    const rows = await this.q('SELECT kind,name,state FROM environment_processes WHERE thread_id=$1', [threadId]);
    const state = (kind: string, name: string): ProcessState => rows.find((r) => r.kind === kind && r.name === name)?.state ?? 'idle';
    return {
      setup: rows.filter((r) => r.kind === 'setup').map((r) => ({ name: r.name, state: r.state })),
      services: spec.startup.map((e) => ({ name: e.name, state: state('startup', e.name), readinessPort: e.readinessPort, preview: e.preview })),
      commands: spec.commands.map((c) => ({ name: c.name, state: state('command', c.name), description: c.description })),
      terminals: []
    };
  }
  /** Agent environment tools. Boundaries: only the calling thread's project, whole-spec validated replace, stale-base refusal, no deletes. */
  async tool(threadId: string, projectId: string, name: string, args: Record<string, unknown>, machine: () => EnvironmentMachine, opts: ExecutorOptions = {}): Promise<unknown> {
    if (name === 'environment.read') return this.current(projectId);
    if (name === 'environment.replace') {
      const baseVersion = Number.isInteger(args.baseVersion) ? args.baseVersion as number : undefined;
      if (baseVersion === undefined) throw new ApiFailure('ValidationFailed', 'baseVersion is required (read the environment first)');
      return this.replace(projectId, parseEnvironmentSpec(args.spec), { source: 'agent', threadId, note: typeof args.note === 'string' ? args.note : '', baseVersion });
    }
    if (name === 'environment.verify') {
      const m = machine(); const cur = await this.current(projectId);
      const r = await this.executor(threadId, m, opts).setup(cur.spec, 'initialize');
      const verification = { state: r.state === 'passed' ? 'passed' : r.state === 'timeout' ? 'timeout' : 'failed', phase: 'initialize', exitCode: r.exitCode, at: new Date().toISOString() };
      if (cur.version) await this.q('UPDATE environment_versions SET verification=$3 WHERE project_id=$1 AND version=$2', [projectId, cur.version, JSON.stringify(verification)]);
      return { version: cur.version, verification, output: r.output };
    }
    throw new ApiFailure('NotFound', `unknown environment tool ${name}`);
  }
  /** After a run: a committed `.flotilla/setup.json` (preferred) or `.capy/setup.json` becomes a new version when it differs. */
  async importFromMachine(x: { thread: { id: string; project_id: string | null }; containerId: string; driver: CopyOut }): Promise<EnvironmentVersion | null> {
    if (!x.thread.project_id) return null;
    for (const path of SETUP_FILES) {
      const full = `/workspace/repo/${path}`;
      const size = await fileSize(x.driver.transport(x.containerId), full).catch(() => null);
      if (size === null || size > MAX_SETUP_FILE) continue;
      const content = await x.driver.copyOut(x.containerId, full).then(untarFirst).catch(() => null);
      if (content === null) continue;
      const spec = parseSetupFile(path, content);
      if (same(spec, (await this.current(x.thread.project_id)).spec)) return null;
      return this.replace(x.thread.project_id, spec, { source: 'repo-file', threadId: x.thread.id, note: path });
    }
    return null;
  }
}

const stores = new Map<string, EnvironmentStore>();
export function environmentStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): EnvironmentStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new EnvironmentStore(databaseUrl)));
  return store;
}
