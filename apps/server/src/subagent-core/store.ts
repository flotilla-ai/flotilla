import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Thread } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';
import { GitHubClient } from '../github/client.js';
import { mirrorPath } from '../git/mirror.js';
import { defaultRunner } from '../routes/threads.route.js';
import { onAfterRun, onPlacement, type RunPlacement, type ThreadRunner } from '../runner/runner.js';
import { SUBAGENT_MAX_DEPTH, type Subagent, type SubagentDiff, type SubagentDraft, type SubagentProgress, type SubagentState } from './types.js';

type Row = Record<string, any>;
type Deps = { runner: ThreadRunner; mirrorRoot?: string; github?: () => Pick<GitHubClient, 'openOrFindPr'> | null };
const exec = promisify(execFile);
const STATE: Record<string, SubagentState> = { queued: 'working', working: 'working', paused: 'waiting', waiting: 'done', idle: 'idle', failed: 'failed', archived: 'done' };
const norm = (p: string) => p.replace(/^\.\//, '').replace(/\/+$/, '');
const overlaps = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const text = (v: unknown, name: string) => { if (typeof v !== 'string' || !v.trim()) throw new ApiFailure('ValidationFailed', `${name} is required`); return v.trim(); };
const SELECT = `SELECT s.*, t.title, t.status, t.engine, t.branch, t.project_id, t.owner_id, t.created_at AS t_created FROM subagents s JOIN threads t ON t.id=s.thread_id`;

/** Subagents are child threads (parent_id) with a draft phase, explicit placement/mode, a budget slice and a parent wake. */
export class SubagentStore {
  constructor(readonly deps: Deps) {}
  get pool() { return this.deps.runner.pool; }

  install(): () => void {
    const offs = [onPlacement((thread) => this.placement(thread.id as string)), onAfterRun(({ thread, runId, state }) => this.finished(thread.id as string, runId, state))];
    return () => offs.forEach((off) => off());
  }

  async create(parentId: string, userId: string, draft: SubagentDraft): Promise<Subagent> {
    const parent = await this.deps.runner.assertOwner(parentId, userId);
    const title = text(draft.title, 'title'); const prompt = text(draft.prompt, 'prompt');
    if (draft.placement !== 'shared' && draft.placement !== 'fresh') throw new ApiFailure('ValidationFailed', 'placement must be chosen: shared or fresh');
    const mode = draft.mode ?? 'parallel';
    if (mode !== 'parallel' && mode !== 'stacked') throw new ApiFailure('ValidationFailed', 'mode must be parallel or stacked');
    if (draft.placement === 'shared' && mode === 'stacked') throw new ApiFailure('ValidationFailed', 'shared subagents are read-only and cannot stack');
    if (draft.paths !== undefined && (!Array.isArray(draft.paths) || draft.paths.some((p) => typeof p !== 'string' || !norm(p)))) throw new ApiFailure('ValidationFailed', 'paths must be non-empty strings');
    const paths = (draft.paths ?? []).map(norm);
    const up = (await this.pool.query('SELECT address, depth FROM subagents WHERE thread_id=$1', [parentId])).rows[0] as Row | undefined;
    const depth = (up?.depth ?? 0) + 1;
    if (depth > SUBAGENT_MAX_DEPTH) throw new ApiFailure('Forbidden', `subagents nest at most ${SUBAGENT_MAX_DEPTH} levels`);
    const siblings = (await this.pool.query('SELECT thread_id, ordinal, mode, placement, paths, granted_usd FROM subagents WHERE parent_id=$1 ORDER BY ordinal', [parentId])).rows as Row[];
    if (mode === 'parallel' && draft.placement === 'fresh') {
      const clash = siblings.filter((s) => s.mode === 'parallel' && s.placement === 'fresh').flatMap((s) => s.paths as string[]).find((p) => paths.some((q) => overlaps(p, q)));
      if (clash) throw new ApiFailure('Conflict', `parallel subagents need disjoint files; ${clash} is already claimed`);
    }
    const prev = siblings.at(-1);
    if (mode === 'stacked' && !prev) throw new ApiFailure('ValidationFailed', 'stacked subagents build on a previous sibling');
    const engine = await this.engine(parent, userId, draft.engine);
    const requested = draft.maxUsd ?? null;
    if (requested !== null && !(typeof requested === 'number' && requested > 0)) throw new ApiFailure('ValidationFailed', 'maxUsd must be positive');
    const cap = (parent.budget as { maxUsd: number | null }).maxUsd;
    let granted = requested;
    if (cap !== null) {
      const left = cap - (parent.spent as { usd: number }).usd - siblings.reduce((n, s) => n + (s.granted_usd ?? 0), 0);
      if (left <= 0) throw new ApiFailure('Forbidden', 'parent budget has nothing left for a subagent');
      granted = Math.min(requested ?? left, left);
    }
    const ordinal = (prev?.ordinal ?? 0) + 1; const address = up ? `${up.address}.${ordinal}` : String(ordinal);
    const child = await this.deps.runner.createThread({ ownerId: userId, parentId, projectId: parent.project_id as string | null, title, prompt, engine, maxUsd: granted, draft: true });
    await this.pool.query(`INSERT INTO subagents (thread_id,parent_id,ordinal,address,depth,prompt,placement,mode,paths,stacked_on,requested_usd,granted_usd) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [child.id, parentId, ordinal, address, depth, prompt, draft.placement, mode, JSON.stringify(paths), mode === 'stacked' ? prev!.thread_id : null, requested, granted]);
    return this.get(child.id as string, userId);
  }

  async update(id: string, userId: string, patch: { title?: string; prompt?: string }): Promise<Subagent> {
    const s = await this.row(id, userId);
    if (s.started_at) throw new ApiFailure('Conflict', 'only drafts can be edited');
    if (patch.title !== undefined) await this.pool.query('UPDATE threads SET title=$2,updated_at=now() WHERE id=$1', [id, text(patch.title, 'title')]);
    if (patch.prompt !== undefined) await this.pool.query('UPDATE subagents SET prompt=$2 WHERE thread_id=$1', [id, text(patch.prompt, 'prompt')]);
    return this.get(id, userId);
  }

  async start(id: string, userId: string): Promise<Subagent> {
    const s = await this.row(id, userId);
    if (s.started_at) throw new ApiFailure('Conflict', 'subagent already started');
    const up = (await this.pool.query('SELECT started_at FROM subagents WHERE thread_id=$1', [s.parent_id])).rows[0] as Row | undefined;
    if (up && !up.started_at) throw new ApiFailure('Conflict', 'start the parent subagent first');
    const base = s.stacked_on ? (await this.pool.query('SELECT branch FROM threads WHERE id=$1', [s.stacked_on])).rows[0]?.branch as string | null : null;
    if (s.stacked_on && !base) throw new ApiFailure('Conflict', 'the previous subagent has no branch to stack on yet');
    if (base && !(await this.published(s.project_id, base))) throw new ApiFailure('Conflict', 'the previous subagent has not published its branch yet');
    const claimed = await this.pool.query('UPDATE subagents SET started_at=now(), base_branch=$2 WHERE thread_id=$1 AND started_at IS NULL RETURNING 1', [id, base]);
    if (!claimed.rowCount) throw new ApiFailure('Conflict', 'subagent already started');
    const runner = this.deps.runner;
    await this.pool.query(`UPDATE threads SET status='queued',updated_at=now() WHERE id=$1`, [id]);
    await runner.deps.store.appendEvents(id as Thread['id'], [{ runId: null, kind: 'user.message', source: 'user', trust: 'trusted', payload: { text: s.prompt, by: userId } }] as never);
    await runner.inbox.add({ threadId: id, text: s.prompt, mode: 'queue', by: userId, ownerId: userId });
    const view = await this.get(id, userId);
    runner.kick(id);
    return view;
  }

  async feedback(id: string, userId: string, body: string): Promise<Subagent> {
    const s = await this.row(id, userId);
    if (!s.started_at) throw new ApiFailure('Conflict', 'start the draft instead');
    if (!this.deps.runner.running.has(id)) await this.pool.query(`UPDATE threads SET status='queued',updated_at=now() WHERE id=$1`, [id]);
    const view = await this.get(id, userId);
    await this.deps.runner.message(id, text(body, 'text'), 'queue', userId);
    return view;
  }

  async get(id: string, userId: string): Promise<Subagent> { return this.view(await this.row(id, userId)); }
  async list(parentId: string, userId: string): Promise<Subagent[]> {
    await this.deps.runner.assertOwner(parentId, userId);
    return (await this.pool.query(`${SELECT} WHERE s.parent_id=$1 AND t.owner_id=$2 ORDER BY s.ordinal`, [parentId, userId])).rows.map((r) => this.view(r));
  }

  async progress(id: string, userId: string): Promise<SubagentProgress> {
    const subagent = await this.get(id, userId);
    const run = (await this.pool.query('SELECT id FROM runs WHERE thread_id=$1 ORDER BY ordinal DESC LIMIT 1', [id])).rows[0]?.id ?? null;
    const ev = (await this.pool.query(`SELECT kind, payload FROM events WHERE thread_id=$1 AND run_id=$2 AND kind IN ('agent.delta','agent.tool_call') ORDER BY seq`, [id, run])).rows;
    return { subagent, text: ev.filter((e) => e.kind === 'agent.delta').map((e) => e.payload.text).join(''), tools: ev.filter((e) => e.kind === 'agent.tool_call').map((e) => e.payload.name as string) };
  }

  async diff(id: string, userId: string): Promise<SubagentDiff> {
    const { s, project } = await this.branched(id, userId);
    const base = s.base_branch ?? project.repo.baseBranch;
    const mirror = mirrorPath(this.deps.mirrorRoot ?? '/data/mirrors', project as never);
    const out = await exec('git', ['--git-dir', mirror, 'diff', '--no-color', `${base}...${s.branch}`, '--'], { maxBuffer: 64 * 1024 * 1024 }).catch(() => { throw new ApiFailure('Conflict', 'subagent branch is not in the project mirror yet'); });
    return { branch: s.branch, base, patch: out.stdout };
  }

  async openPr(id: string, userId: string): Promise<{ number: number; url: string }> {
    const { s, project } = await this.branched(id, userId);
    const github = (this.deps.github ?? (() => (process.env.GITHUB_TOKEN ? new GitHubClient(process.env.GITHUB_TOKEN) : null)))();
    if (!github) throw new ApiFailure('Conflict', 'GitHub is not configured');
    const repo = project.repo.fullName as string;
    const pr = await github.openOrFindPr(repo, s.branch, s.base_branch ?? project.repo.baseBranch, s.title);
    const prs = ((await this.pool.query('SELECT prs FROM threads WHERE id=$1', [id])).rows[0].prs as Row[]).filter((p) => !(p.repo === repo && p.number === pr.number));
    await this.pool.query('UPDATE threads SET prs=$2 WHERE id=$1', [id, JSON.stringify([...prs, { repo, number: pr.number, owned: true }])]);
    await this.pool.query('INSERT INTO prs (repo,number,thread_id,head_branch,owned) VALUES ($1,$2,$3,$4,true) ON CONFLICT (repo,number) DO UPDATE SET thread_id=$3, head_branch=$4, owned=true', [repo, pr.number, id, s.branch]);
    await this.deps.runner.deps.store.appendEvents(id as Thread['id'], [{ runId: null, kind: 'pr.opened', source: 'github', trust: 'trusted', payload: { repo, number: pr.number, url: pr.html_url } }] as never);
    return { number: pr.number, url: pr.html_url };
  }

  /** Shared children run in the nearest non-shared ancestor's workspace, read-only; stacked children start from the previous sibling's branch. */
  async placement(threadId: string): Promise<RunPlacement | null> {
    const s = (await this.pool.query('SELECT s.placement, s.parent_id, s.base_branch, t.owner_id FROM subagents s JOIN threads t ON t.id=s.thread_id WHERE s.thread_id=$1', [threadId])).rows[0] as Row | undefined;
    if (!s) return null;
    if (s.placement === 'fresh') return s.base_branch ? { baseBranch: s.base_branch } : null;
    let owner = s.parent_id as string;
    for (let up: Row | undefined; (up = (await this.pool.query(`SELECT parent_id FROM subagents WHERE thread_id=$1 AND placement='shared'`, [owner])).rows[0]);) owner = up.parent_id;
    const host = (await this.pool.query('SELECT owner_id FROM threads WHERE id=$1', [owner])).rows[0] as Row | undefined;
    if (host?.owner_id !== s.owner_id) throw new Error('the shared workspace now belongs to another owner');
    return { workspaceFrom: owner };
  }

  /** A finished run wakes the parent with the summary; a budget pause surfaces the open question; failures are reported. */
  async finished(threadId: string, runId: string, state: string): Promise<void> {
    const s = (await this.pool.query(`${SELECT} WHERE s.thread_id=$1`, [threadId])).rows[0] as Row | undefined;
    if (!s) return;
    const name = `Subagent ${s.address} "${s.title}"`;
    if (state === 'completed') {
      const summary = ((await this.pool.query(`SELECT string_agg(payload->>'text', '' ORDER BY seq) t FROM events WHERE thread_id=$1 AND run_id=$2 AND kind='agent.delta'`, [threadId, runId])).rows[0].t ?? '').slice(-4000);
      await this.pool.query('UPDATE subagents SET summary=$2, question=NULL WHERE thread_id=$1', [threadId, summary]);
      await this.deps.runner.message(s.parent_id, `${name} finished. Summary:\n${summary}`, 'queue');
    } else if (state === 'paused_budget' || state === 'run_out') {
      const question = (await this.pool.query(`SELECT a.question FROM approvals a JOIN threads t ON t.id=a.thread_id WHERE a.thread_id=$1 AND a.state='open' ORDER BY (t.needs_you ? a.id) DESC LIMIT 1`, [threadId])).rows[0]?.question as string | undefined;
      if (!question) return;
      await this.pool.query('UPDATE subagents SET question=$2 WHERE thread_id=$1', [threadId, question]);
      await this.deps.runner.message(s.parent_id, `${name} is blocked and asks: ${question}`, 'queue');
    } else if (state === 'failed') await this.deps.runner.message(s.parent_id, `${name} failed.`, 'queue');
  }

  private async engine(parent: Row, userId: string, want: SubagentDraft['engine']): Promise<Thread['engine']> {
    const from = parent.engine as Thread['engine'];
    if (!want) return from;
    const same = !want.adapter || want.adapter === from.adapter;
    const next = { adapter: want.adapter ?? from.adapter, model: want.model ?? (same ? from.model : null), effort: want.effort ?? (same ? from.effort : null), connectionId: want.connectionId ?? (same ? from.connectionId : null) };
    const resolved = this.deps.runner.deps.resolveEngine ? await this.deps.runner.deps.resolveEngine(userId, next) : next;
    return { adapter: resolved.adapter as Thread['engine']['adapter'], model: resolved.model, effort: (resolved.effort as string | null) ?? null, connectionId: resolved.connectionId, ...('contextWindow' in resolved && resolved.contextWindow ? { contextWindow: resolved.contextWindow } : {}) } as Thread['engine'];
  }
  private async branched(id: string, userId: string): Promise<{ s: Row; project: Row }> {
    const s = await this.row(id, userId);
    const project = s.project_id ? (await this.pool.query('SELECT * FROM projects WHERE id=$1', [s.project_id])).rows[0] : null;
    if (!project || !s.branch) throw new ApiFailure('Conflict', 'subagent has no project branch');
    return { s, project };
  }
  private async published(projectId: string | null, branch: string): Promise<boolean> {
    const project = projectId ? (await this.pool.query('SELECT * FROM projects WHERE id=$1', [projectId])).rows[0] : null;
    if (!project) return false;
    const mirror = mirrorPath(this.deps.mirrorRoot ?? '/data/mirrors', project as never);
    return exec('git', ['--git-dir', mirror, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).then(() => true, () => false);
  }
  private async row(id: string, userId: string): Promise<Row> {
    const s = (await this.pool.query(`${SELECT} WHERE s.thread_id=$1`, [id])).rows[0] as Row | undefined;
    if (!s || s.owner_id !== userId) throw new ApiFailure('NotFound', 'subagent not found');
    return s;
  }
  private view(s: Row): Subagent {
    return { id: s.thread_id, parentId: s.parent_id, address: s.address, label: `Subagent ${s.address}`, depth: s.depth, title: s.title, prompt: s.prompt,
      state: s.started_at ? STATE[s.status] ?? 'working' : 'draft', placement: s.placement, mode: s.mode, paths: s.paths, stackedOn: s.stacked_on, baseBranch: s.base_branch,
      branch: s.branch, engine: s.engine, budget: { requestedUsd: s.requested_usd, grantedUsd: s.granted_usd }, summary: s.summary, question: s.question,
      createdAt: new Date(s.created_at).toISOString(), startedAt: s.started_at ? new Date(s.started_at).toISOString() : null };
  }
}

let singleton: SubagentStore | null = null;
export function subagentCore(): SubagentStore { return (singleton ??= new SubagentStore({ runner: defaultRunner(), mirrorRoot: process.env.FLOTILLA_MIRROR_ROOT })); }
