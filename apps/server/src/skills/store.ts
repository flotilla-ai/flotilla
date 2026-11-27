import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { ApiFailure } from '../api-platform/types.js';
import { BUILTIN_SKILLS, IMPORT_ORIGINS, MAX_BYTES, MAX_FILES, REPO_SKILL_DIRS, SKILL_HOME, invocationNote, parseInvocations, resolveSkills, safeRel, skillPath, skillsTar, type Skill, type SkillInvocation, type SkillSource, type SkillSourceKind } from './types.js';

type Row = Record<string, any>;
type CopyIn = { copyIn?(containerId: string, dir: string, tar: Buffer): Promise<void> };
export type SkillWrite = { source: 'drive' | 'plugin'; projectId?: string | null; plugin?: string | null; folder: string; files: Record<string, string>; origin?: string };
const toSource = (r: Row): SkillSource => r.source === 'repo' ? { kind: 'repo', projectId: r.project_id, dir: r.repo_dir } : r.source === 'plugin' ? { kind: 'plugin', plugin: r.plugin } : { kind: 'drive', scope: r.project_id ? 'project' : 'user', projectId: r.project_id };
const toSkill = (r: Row): Omit<Skill, 'load'> => ({ id: r.id, name: r.name, description: '', source: toSource(r), origin: r.origin, files: r.files });
/** Lists `<dir>/<folder>/<file>` regular files (no symlinks, < 64 KB) under the repo skill dirs as `path<TAB>base64`. */
const SCAN = `cd "$1" 2>/dev/null || exit 0; for d in ${REPO_SKILL_DIRS.join(' ')}; do [ -d "$d" ] || continue; find "$d" -mindepth 2 -maxdepth 5 -type f -size -64k | head -n 400 | while IFS= read -r f; do printf '%s\\t%s\\n' "$f" "$(base64 -w0 < "$f")"; done; done`;

function checkSize(files: Record<string, string>): void {
  if (Object.keys(files).length > MAX_FILES || Object.values(files).reduce((n, f) => n + Buffer.byteLength(f), 0) > MAX_BYTES) throw new ApiFailure('ValidationFailed', `a skill folder is limited to ${MAX_FILES} files and 256 KB`);
}

export class SkillStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  constructor(private readonly databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }
  async ownedProject(userId: string, projectId: string | null | undefined): Promise<string | null> {
    if (!projectId) return null;
    if (!(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId]))[0]) throw new ApiFailure('NotFound', 'project not found');
    return projectId;
  }
  async ownedThread(userId: string, threadId: string): Promise<void> {
    if (!(await this.q('SELECT 1 FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]))[0]) throw new ApiFailure('NotFound', 'thread not found');
  }

  /** Every skill visible to the user (in a project: plus its repo and Drive project skills) with its load state. */
  async list(userId: string, projectId: string | null): Promise<Skill[]> {
    const rows = await this.q(`SELECT * FROM skills WHERE (owner_id=$1 AND project_id IS NULL) OR (project_id=$2 AND (source='repo' OR owner_id=$1)) ORDER BY id`, [userId, projectId]);
    const disabled = new Set((await this.q('SELECT source,name FROM skill_disabled WHERE owner_id=$1', [userId])).map((r) => `${r.source}:${r.name}`));
    return resolveSkills([...BUILTIN_SKILLS, ...rows.map(toSkill)], disabled);
  }
  async save(userId: string, w: SkillWrite): Promise<Skill> {
    checkSize(w.files);
    const projectId = await this.ownedProject(userId, w.projectId);
    const [r] = await this.q(`INSERT INTO skills (id,owner_id,project_id,source,plugin,origin,name,files) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT ON CONSTRAINT skills_folder DO UPDATE SET files=EXCLUDED.files, origin=EXCLUDED.origin, updated_at=now() RETURNING id`,
    [`skl_${randomBytes(8).toString('base64url')}`, userId, projectId, w.source, w.source === 'plugin' ? w.plugin : null, w.origin ?? '', w.folder, JSON.stringify(w.files)]);
    return (await this.list(userId, projectId)).find((s) => s.id === r.id)!;
  }
  /** Copies skill folders from another tool's layout (`…/skills/<folder>/<file>` or `<folder>/<file>`) into Drive skills. */
  async import(userId: string, input: { from: string; projectId?: string | null; files: { path: string; content: string }[] }): Promise<Skill[]> {
    if (!IMPORT_ORIGINS.includes(input.from as never)) throw new ApiFailure('ValidationFailed', `from must be one of ${IMPORT_ORIGINS.join(', ')}`);
    if (input.files.length > 200 || input.files.reduce((n, f) => n + (typeof f?.content === 'string' ? Buffer.byteLength(f.content) : 0), 0) > 2 * 1024 * 1024) throw new ApiFailure('ValidationFailed', 'import is limited to 200 files and 2 MB');
    const folders = new Map<string, Record<string, string>>();
    for (const f of input.files) {
      const segs = typeof f?.path === 'string' && typeof f.content === 'string' ? safeRel(f.path) : null;
      if (!segs) throw new ApiFailure('ValidationFailed', 'each file needs a relative path and string content');
      const root = segs.indexOf('skills'); const rest = segs.slice(root >= 0 && root <= segs.length - 3 ? root + 1 : 0);
      if (rest.length < 2) throw new ApiFailure('ValidationFailed', `${f.path} is not inside a skill folder`);
      folders.set(rest[0], { ...folders.get(rest[0]), [rest.slice(1).join('/')]: f.content });
    }
    for (const files of folders.values()) checkSize(files);
    const out: Skill[] = [];
    for (const [folder, files] of folders) out.push(await this.save(userId, { source: 'drive', projectId: input.projectId, folder, files, origin: input.from }));
    return out;
  }
  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.q(`DELETE FROM skills WHERE id=$1 AND owner_id=$2 AND source<>'repo' RETURNING id`, [id, userId]))[0]) throw new ApiFailure('NotFound', 'skill not found');
  }
  async setDisabled(userId: string, source: SkillSourceKind, name: string, disabled: boolean): Promise<void> {
    await this.q(disabled ? 'INSERT INTO skill_disabled (owner_id,source,name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING' : 'DELETE FROM skill_disabled WHERE owner_id=$1 AND source=$2 AND name=$3', [userId, source, name]);
  }
  async resolve(userId: string, projectId: string | null, text: string): Promise<(SkillInvocation & { skill: Skill })[]> {
    const loaded = (await this.list(userId, projectId)).filter((s) => s.load.state === 'loaded');
    const by = new Map(loaded.map((s) => [s.name, s]));
    return parseInvocations(text, new Set(by.keys())).map((i) => ({ ...i, source: by.get(i.name)!.source.kind, path: skillPath(i.name), skill: by.get(i.name)! }));
  }
  async invocations(threadId: string): Promise<Row[]> {
    return (await this.q('SELECT name,source,trigger,run_id,created_at FROM skill_invocations WHERE thread_id=$1 ORDER BY id', [threadId])).map((r) => ({ name: r.name, source: r.source, trigger: r.trigger, runId: r.run_id, at: r.created_at.toISOString() }));
  }

  /** Replaces the project's cached repo skills with what the thread checkout has in `.agents/skills` and `.claude/skills`. */
  async scanRepo(projectId: string, transport: ProcessTransport, repoDir: string): Promise<void> {
    const h = transport.spawn(['bash', '-c', SCAN, '_', repoDir], { cwd: '/', env: {} });
    const lines: string[] = []; const drain = (async () => { for await (const l of h.stdout) lines.push(l); })(); void (async () => { for await (const _ of h.stderr); })();
    const [{ code }] = await Promise.all([h.exit, drain]); if (code !== 0) return;
    const found = new Map<string, Record<string, string>>();
    for (const line of lines) {
      const [path, b64 = ''] = line.split('\t'); const dir = REPO_SKILL_DIRS.find((d) => path.startsWith(`${d}/`)); const segs = dir && safeRel(path.slice(dir.length + 1));
      if (!dir || !segs || segs.length < 2) continue;
      const body = Buffer.from(b64, 'base64'); if (body.includes(0)) continue; // binary assets cannot be stored as jsonb text
      const key = `${dir}\t${segs[0]}`; found.set(key, { ...found.get(key), [segs.slice(1).join('/')]: body.toString('utf8') });
    }
    const [p] = await this.q('SELECT owner_id FROM projects WHERE id=$1', [projectId]); if (!p) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN'); await client.query(`DELETE FROM skills WHERE project_id=$1 AND source='repo'`, [projectId]);
      for (const [key, files] of found) { const [dir, name] = key.split('\t'); await client.query(`INSERT INTO skills (id,owner_id,project_id,source,repo_dir,origin,name,files) VALUES ($1,$2,$3,'repo',$4,'repo',$5,$6)`, [`skl_${randomBytes(8).toString('base64url')}`, p.owner_id, projectId, dir, name, JSON.stringify(files)]); }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK').catch(() => undefined); throw err; } finally { client.release(); }
  }
  /** Before each run: refresh repo skills, mount every loaded skill into the agent-native folders, and point the agent at invoked ones. */
  async prepareRun(input: { thread: Row; project: Row | null; runId: string; containerId: string; driver: unknown; transport: ProcessTransport; cwd: string; prompt: string; text: string }): Promise<string> {
    const projectId = (input.thread.project_id as string | null) ?? null;
    if (input.project && projectId) await this.scanRepo(projectId, input.transport, input.cwd).catch((err) => console.warn('skills repo scan', (err as Error).message));
    const loaded = (await this.list(input.thread.owner_id, projectId)).filter((s) => s.load.state === 'loaded');
    const driver = input.driver as CopyIn;
    if (driver.copyIn && loaded.length) await driver.copyIn.call(driver, input.containerId, SKILL_HOME, skillsTar(loaded));
    const by = new Map(loaded.map((s) => [s.name, s]));
    const invs: SkillInvocation[] = parseInvocations(input.text, new Set(by.keys())).map((i) => ({ ...i, source: by.get(i.name)!.source.kind, path: skillPath(i.name) }));
    for (const i of invs) await this.q('INSERT INTO skill_invocations (thread_id,run_id,name,source,trigger) VALUES ($1,$2,$3,$4,$5)', [input.thread.id, input.runId, i.name, i.source, i.trigger]);
    return invocationNote(invs, loaded) + input.prompt;
  }
}

const stores = new Map<string, SkillStore>();
export function skillStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): SkillStore {
  let store = stores.get(databaseUrl);
  if (!store) stores.set(databaseUrl, (store = new SkillStore(databaseUrl)));
  return store;
}
