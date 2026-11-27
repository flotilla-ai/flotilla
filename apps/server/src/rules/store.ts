import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { ProcessTransport } from '@flotilla/core/types';
import { migrate } from '../db/migrate.js';
import { ApiFailure } from '../api-platform/types.js';
import { DEFAULT_MAX_TOKENS, KERNEL_RULES, MAX_RULE_TEXT, buildBundle, type ContextBreakdown, type ExperimentFlags, type ExperimentScope, type InstructionScope, type MemoryEntry, type MemoryExperiment, type RepoFile, type RulesBundle } from './types.js';

type Row = Record<string, any>;
const MAX_FILE = 256 * 1024;
const MAX_MEMORY = 50;
const ORG = 'org';
const FIND = `find . \\( -name .git -o -name node_modules \\) -prune -o -type f \\( -name AGENTS.md -o -name CLAUDE.md -o -path './.capy/rules/*.md' -o -path './.capy/rules/*.mdc' -o -path './.cursor/rules/*.md' -o -path './.cursor/rules/*.mdc' -o -path ./.cursorrules -o -path ./.windsurfrules -o -path ./.clinerules -o -path ./GEMINI.md -o -path ./.github/copilot-instructions.md \\) -size -${MAX_FILE / 1024}k -print | sort | head -200 | while IFS= read -r f; do printf '%s\\t' "$f"; base64 -w0 "$f"; echo; done`;

/** Lists rule files in the checkout (regular files under 256 KiB, no symlinks) through the machine transport. */
export async function readRepoRules(t: ProcessTransport, repoDir: string): Promise<RepoFile[]> {
  const h = t.spawn(['bash', '-c', FIND], { cwd: repoDir, env: {} });
  const out: RepoFile[] = []; void (async () => { for await (const _ of h.stderr); })();
  for await (const line of h.stdout) { const [p, b64] = line.split('\t'); if (p && b64 !== undefined) out.push({ path: p.replace(/^\.\//, ''), text: Buffer.from(b64, 'base64').toString('utf8') }); }
  await h.exit; return out;
}
const PATH_KEYS = new Set(['path', 'file_path', 'filePath', 'notebook_path', 'paths', 'files']);
function paths(x: unknown, key = '', out: string[] = []): string[] {
  if (typeof x === 'string') { if (PATH_KEYS.has(key)) out.push(x); }
  else if (Array.isArray(x)) for (const v of x) paths(v, key, out);
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) paths(v, PATH_KEYS.has(key) ? key : k, out);
  return out;
}
const flags = (r: Row | undefined): ExperimentFlags => ({ memory: r?.memory ?? null, captain: r?.captain ?? null });
const toMemory = (r: Row): MemoryEntry => ({ id: r.id, scope: r.scope, text: r.text, threadId: r.thread_id, createdAt: r.created_at?.toISOString() ?? null });
const text = (x: unknown) => { if (typeof x !== 'string' || Buffer.byteLength(x) > MAX_RULE_TEXT) throw new ApiFailure('ValidationFailed', 'text must be a string up to 64 KiB'); return x; };

export class RulesStore {
  readonly pool: pg.Pool;
  private ready?: Promise<unknown>;
  constructor(private readonly databaseUrl: string, readonly maxTokens = Number(process.env.FLOTILLA_RULES_MAX_TOKENS) || DEFAULT_MAX_TOKENS) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Row[]> {
    this.ready ??= migrate(this.databaseUrl).catch((err) => { this.ready = undefined; throw err; });
    await this.ready;
    return (await this.pool.query(sql, params)).rows;
  }
  private async admin(userId: string) { if ((await this.q('SELECT role FROM users WHERE id=$1', [userId]))[0]?.role !== 'admin') throw new ApiFailure('Forbidden', 'only admins can change org settings'); }
  async ownedProject(userId: string, projectId: string) { if (!(await this.q('SELECT 1 FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId]))[0]) throw new ApiFailure('NotFound', 'project not found'); return projectId; }
  private async ownedThread(userId: string, threadId: string) { if (!(await this.q('SELECT 1 FROM threads WHERE id=$1 AND owner_id=$2', [threadId, userId]))[0]) throw new ApiFailure('NotFound', 'thread not found'); }

  async instructions(scope: InstructionScope, subjectId: string) { const [r] = await this.q('SELECT text,updated_at FROM rules_instructions WHERE scope=$1 AND subject_id=$2', [scope, subjectId]); return { text: (r?.text as string) ?? '', updatedAt: r?.updated_at?.toISOString() ?? null }; }
  async putInstructions(userId: string, scope: InstructionScope, subjectId: string, body: unknown) {
    if (scope === 'org') await this.admin(userId);
    await this.q(`INSERT INTO rules_instructions (scope,subject_id,text,updated_by) VALUES ($1,$2,$3,$4) ON CONFLICT (scope,subject_id) DO UPDATE SET text=EXCLUDED.text, updated_by=EXCLUDED.updated_by, updated_at=now()`, [scope, subjectId, text(body), userId]);
    return this.instructions(scope, subjectId);
  }

  async experiments(userId: string): Promise<MemoryExperiment> {
    const rows = await this.q(`SELECT * FROM rules_experiments WHERE (scope='org' AND subject_id=$2) OR (scope='user' AND subject_id=$1)`, [userId, ORG]);
    const org = flags(rows.find((r) => r.scope === 'org')); const user = flags(rows.find((r) => r.scope === 'user'));
    return { org, user, effective: { memory: user.memory ?? org.memory ?? false, captain: user.captain ?? org.captain ?? false } };
  }
  async setExperiments(userId: string, b: Row): Promise<MemoryExperiment> {
    if (b.scope !== 'org' && b.scope !== 'user') throw new ApiFailure('ValidationFailed', 'scope must be org or user');
    for (const k of ['memory', 'captain']) if (b[k] !== undefined && b[k] !== null && typeof b[k] !== 'boolean') throw new ApiFailure('ValidationFailed', `${k} must be a boolean or null`);
    if (b.scope === 'org') await this.admin(userId);
    const set = (k: string) => (b[k] === undefined ? `rules_experiments.${k}` : `EXCLUDED.${k}`);
    await this.q(`INSERT INTO rules_experiments (scope,subject_id,memory,captain) VALUES ($1,$2,$3,$4) ON CONFLICT (scope,subject_id) DO UPDATE SET memory=${set('memory')}, captain=${set('captain')}, updated_at=now()`, [b.scope, b.scope === 'org' ? ORG : userId, b.memory ?? null, b.captain ?? null]);
    return this.experiments(userId);
  }

  async memory(userId: string): Promise<MemoryEntry[]> {
    return (await this.q(`SELECT * FROM rules_memory WHERE (scope='user' AND subject_id=$1) OR (scope='org' AND subject_id=$2) ORDER BY created_at DESC LIMIT ${MAX_MEMORY}`, [userId, ORG])).map(toMemory);
  }
  async teach(userId: string, b: Row): Promise<MemoryEntry> {
    if (!(await this.experiments(userId)).effective.memory) throw new ApiFailure('Conflict', 'the Memory experiment is off');
    const scope: ExperimentScope = b.scope === 'org' ? 'org' : 'user'; if (scope === 'org') await this.admin(userId);
    const t = text(b.text).trim(); if (!t || t.length > 2000) throw new ApiFailure('ValidationFailed', 'text must be 1-2000 characters');
    if (b.threadId !== undefined) await this.ownedThread(userId, String(b.threadId));
    const [r] = await this.q(`INSERT INTO rules_memory (id,scope,subject_id,text,thread_id,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [`mem_${randomBytes(10).toString('base64url')}`, scope, scope === 'org' ? ORG : userId, t, b.threadId ?? null, userId]);
    return toMemory(r!);
  }
  async forget(userId: string, id: string) {
    const [r] = await this.q('SELECT scope,subject_id FROM rules_memory WHERE id=$1', [id]);
    if (!r || (r.scope === 'user' && r.subject_id !== userId)) throw new ApiFailure('NotFound', 'memory not found');
    if (r.scope === 'org') await this.admin(userId);
    await this.q('DELETE FROM rules_memory WHERE id=$1', [id]);
  }

  /** Builds the run's bundle and records its per-layer token breakdown (never the text). */
  async prepareRun(thread: Row, project: Row | null, runId: string, repo: RepoFile[]): Promise<RulesBundle> {
    const owner = thread.owner_id as string;
    const instructions = [{ scope: 'org' as const, text: (await this.instructions('org', ORG)).text }, { scope: 'user' as const, text: (await this.instructions('user', owner)).text }, ...(project ? [{ scope: 'project' as const, text: (await this.instructions('project', project.id)).text }] : [])];
    const touched = (await this.q(`SELECT payload->'input' AS input FROM events WHERE thread_id=$1 AND kind='agent.tool_call'`, [thread.id])).flatMap((r) => paths(r.input));
    const memory = (await this.experiments(owner)).effective.memory ? (await this.memory(owner)).map((m) => m.text).reverse() : [];
    const bundle = buildBundle({ instructions, repo, touched, memory, maxTokens: this.maxTokens });
    const breakdown = { layers: bundle.layers.map(({ text: _t, ...l }) => l), ignored: bundle.ignored, budget: bundle.budget };
    await this.q(`INSERT INTO rules_context (thread_id,run_id,breakdown) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [thread.id, runId, JSON.stringify(breakdown)]);
    return bundle;
  }
  async context(userId: string, threadId: string): Promise<ContextBreakdown | null> {
    await this.ownedThread(userId, threadId);
    const [r] = await this.q('SELECT run_id,breakdown,created_at FROM rules_context WHERE thread_id=$1 ORDER BY created_at DESC LIMIT 1', [threadId]);
    return r ? { runId: r.run_id, ...r.breakdown, createdAt: r.created_at.toISOString() } : null;
  }
}

/** Runner hook: every adapter gets the same bundle prepended; if loading fails the kernel rules are still sent. */
export function rulesBeforeRun(store: RulesStore | (() => RulesStore), repoDir = '/workspace/repo') {
  return async ({ thread, project, runId, transport }: { thread: Row; project: Row | null; runId: string; transport: ProcessTransport }) => {
    const s = typeof store === 'function' ? store() : store;
    try { return (await s.prepareRun(thread, project, runId, project ? await readRepoRules(transport, repoDir).catch(() => []) : [])).text; }
    catch (err) { console.warn('rules', (err as Error).message); return `<flotilla-rules>\n## kernel: flotilla-kernel\n${KERNEL_RULES}\n</flotilla-rules>`; }
  };
}

let singleton: RulesStore | undefined;
export function rulesStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): RulesStore { singleton ??= new RulesStore(databaseUrl); return singleton; }
