import { Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { ensureMirror, remoteAllowed, type GitProject } from '../git/mirror.js';
import { describeMirror } from '../projects/describe.js';
import type { Project, ProjectRepoRole, ProjectRepository, ProjectSource, ProjectVisibility, RepoSuggestion } from '../projects/types.js';

type Row = Record<string, unknown>;
export type ProjectsDeps = {
  mirrorRoot?: string;
  mirror?: (project: GitProject, root: string) => Promise<string>;
  recentRepos?: (userId: string) => Promise<RepoSuggestion[]>;
};
class Invalid extends Error { constructor(message: string, readonly status: 400 | 404 | 409 = 400) { super(message); } }

function camel(row: Row): Row { return Object.fromEntries(Object.entries(row).map(([k,v]) => [k.replace(/_([a-z])/g, (_,x) => x.toUpperCase()), v])); }
function view(row: Row): Project { const { threadSeq: _seq, ...rest } = camel(row); return rest as unknown as Project; }
function userId(c: unknown): string { return (c as { get(key: string): string }).get('userId'); }
const hex = (n: number) => randomBytes(n).toString('hex');
const GITHUB_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const CODE = /^[A-Z][A-Z0-9]{1,5}$/;
const ICON = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\u200d|\ufe0f|\u20e3)*$/u;

function repoFrom(src: ProjectSource, role: ProjectRepoRole): ProjectRepository {
  const baseBranch = 'baseBranch' in src && src.baseBranch !== undefined ? src.baseBranch : 'main';
  if (typeof baseBranch !== 'string' || !BRANCH.test(baseBranch)) throw new Invalid('invalid baseBranch');
  const repo = { id: `rep_${hex(4)}`, baseBranch, role, machineId: null, description: null, clonedAt: null };
  if (src?.kind === 'github') {
    if (typeof src.fullName !== 'string' || !GITHUB_NAME.test(src.fullName)) throw new Invalid('github source needs owner/repo');
    return { ...repo, provider: 'github', fullName: src.fullName };
  }
  if (src?.kind === 'git-url') {
    let url: URL; try { url = new URL(String(src.url)); } catch { throw new Invalid('invalid git url'); }
    if (!['https:', 'file:'].includes(url.protocol) || url.username || url.password || !remoteAllowed(src.url)) throw new Invalid('git url host not allowed; operators list extra https hosts in FLOTILLA_GIT_HOSTS');
    return { ...repo, provider: 'git', fullName: src.url };
  }
  if (src?.kind === 'folder') {
    const machineId = src.machineId ?? null;
    if (typeof src.path !== 'string' || !src.path.startsWith('/') || src.path.includes('\0')) throw new Invalid('folder source needs an absolute path');
    if (machineId !== null && (typeof machineId !== 'string' || !machineId)) throw new Invalid('invalid machineId');
    if (machineId === null && !remoteAllowed(src.path)) throw new Invalid('server folders need FLOTILLA_ALLOW_LOCAL_GIT_REMOTES=1');
    return { ...repo, provider: 'local', fullName: src.path, machineId };
  }
  throw new Invalid('source.kind must be github, git-url, folder or empty');
}
function icon(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 16 || !ICON.test(value)) throw new Invalid('icon must be an emoji');
  return value;
}
function visibility(value: unknown): ProjectVisibility {
  if (value === undefined) return 'private';
  if (value !== 'private' && value !== 'shared') throw new Invalid('visibility must be private or shared');
  return value;
}
function codeOf(value: unknown): string {
  const code = typeof value === 'string' ? value.toUpperCase() : '';
  if (!CODE.test(code)) throw new Invalid('code must be 2-6 letters/digits starting with a letter');
  return code;
}
function codeBase(name: string): string {
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const base = (words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] ?? '').slice(0, 3)).replace(/^[0-9]+/, '');
  return CODE.test(base) ? base : 'PRJ';
}
const primaryOf = (repo: ProjectRepository | null) => repo && { provider: repo.provider, fullName: repo.fullName, baseBranch: repo.baseBranch };
async function defaultRecentRepos(): Promise<RepoSuggestion[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  const res = await fetch('https://api.github.com/user/repos?sort=pushed&direction=desc&per_page=20', { headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' } });
  if (!res.ok) return [];
  return (await res.json() as { full_name: string; default_branch: string; private: boolean; pushed_at: string }[]).map((r) => ({ fullName: r.full_name, defaultBranch: r.default_branch, private: r.private, pushedAt: r.pushed_at }));
}

export function createProjectsRoute(pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla' }), deps: ProjectsDeps = {}) {
  const app = new Hono();
  const root = deps.mirrorRoot ?? '/data/mirrors';
  const mirror = deps.mirror ?? ensureMirror;
  const recentRepos = deps.recentRepos ?? defaultRecentRepos;
  const fail = (c: { json(body: unknown, status: number): Response }, err: unknown) => {
    if (err instanceof Invalid) return c.json({ error: err.message }, err.status);
    if ((err as { code?: string }).code === '23505') return c.json({ error: 'project code already in use' }, 409);
    throw err;
  };
  const visible = async (id: string, user: string) => (await pool.query("SELECT * FROM projects WHERE id=$1 AND (owner_id=$2 OR visibility='shared')", [id, user])).rows[0] as Row | undefined;
  const owned = async (id: string, user: string) => (await pool.query('SELECT * FROM projects WHERE id=$1 AND owner_id=$2', [id, user])).rows[0] as Row | undefined;
  async function freeCode(name: string): Promise<string> {
    const base = codeBase(name);
    for (let i = 0; i < 100; i++) {
      const code = i ? `${base.slice(0, 6 - String(i + 1).length)}${i + 1}` : base;
      if (!(await pool.query('SELECT 1 FROM projects WHERE code=$1', [code])).rows[0]) return code;
    }
    return `P${hex(3).toUpperCase().slice(0, 5)}`;
  }
  async function materialize(row: Row, repo: ProjectRepository): Promise<ProjectRepository> {
    const path = await mirror({ id: (repo.role === 'primary' ? row.id : `${row.id as string}--${repo.id}`) as never, repo: primaryOf(repo) as never, trust: row.trust as never, token: process.env.GITHUB_TOKEN }, root);
    const patch = { description: await describeMirror(path, repo.baseBranch), clonedAt: new Date().toISOString() };
    await pool.query("UPDATE projects SET repos=(SELECT jsonb_agg(CASE WHEN r->>'id'=$2 THEN r || $3::jsonb ELSE r END ORDER BY o) FROM jsonb_array_elements(repos) WITH ORDINALITY t(r,o)) WHERE id=$1", [row.id, repo.id, JSON.stringify(patch)]);
    return { ...repo, ...patch };
  }

  app.get('/', async (c) => {
    const rows = await pool.query("SELECT * FROM projects WHERE owner_id=$1 OR visibility='shared' ORDER BY created_at,id", [userId(c)]);
    return c.json(rows.rows.map(view));
  });
  app.get('/suggestions', async (c) => {
    const taken = new Set((await pool.query("SELECT r->>'fullName' AS name FROM projects, jsonb_array_elements(repos) r WHERE owner_id=$1 AND r->>'provider'='github'", [userId(c)])).rows.map((r) => r.name as string));
    const repos = (await recentRepos(userId(c)).catch(() => [])).filter((r) => !taken.has(r.fullName));
    return c.json(repos.sort((a, b) => b.pushedAt.localeCompare(a.pushedAt)).slice(0, 10));
  });
  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      if (typeof body.name !== 'string' || !body.name.trim() || (!body.source && !body.repo)) throw new Invalid('name and source required');
      const source = (body.source ?? null) as ProjectSource | null;
      const primary = source ? (source.kind === 'empty' ? null : repoFrom(source, 'primary')) : body.repo?.fullName ? { ...repoFrom({ kind: 'github', fullName: body.repo.fullName, baseBranch: body.repo.baseBranch }, 'primary'), id: 'rep_primary' } : null;
      if (body.lazy !== undefined && (!Array.isArray(body.lazy) || body.lazy.length > 20)) throw new Invalid('lazy must be a list of at most 20 sources');
      const repos = [...(primary ? [primary] : []), ...((body.lazy ?? []) as ProjectSource[]).map((s) => repoFrom(s, 'lazy'))];
      const trust = body.trust === 'trusted' ? (body.confirm === 'private-and-mine' ? 'trusted' : null) : 'untrusted';
      if (!trust) throw new Invalid('trusted requires confirm: private-and-mine');
      const code = body.code === undefined ? await freeCode(body.name) : codeOf(body.code);
      const rows = await pool.query('INSERT INTO projects (id,owner_id,name,repo,trust,egress_allow,budget,repos,source,icon,code,visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [`prj_${hex(8)}`, userId(c), body.name.trim(), JSON.stringify(source ? primaryOf(primary) : body.repo), trust, JSON.stringify(body.egressAllow ?? []), JSON.stringify(body.budget ?? { maxUsd: null, maxTokens: null, maxWallSec: null, scope: 'project', onHit: 'pause-and-ask', warnAt: 0.8 }), JSON.stringify(repos), JSON.stringify(source), icon(body.icon), code, visibility(body.visibility)]);
      if (source && primary && !primary.machineId) void materialize(rows.rows[0], primary).catch(() => undefined);
      return c.json(view(rows.rows[0]), 201);
    } catch (err) { return fail(c, err); }
  });
  app.get('/:id', async (c) => {
    const row = await visible(c.req.param('id'), userId(c));
    return row ? c.json(view(row)) : c.json({ error: 'not found' }, 404);
  });
  app.patch('/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      if (body.trust === 'trusted' && body.confirm !== 'private-and-mine') throw new Invalid('trusted requires confirm: private-and-mine');
      const row = await owned(c.req.param('id'), userId(c));
      if (!row) throw new Invalid('not found', 404);
      if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) throw new Invalid('invalid name');
      const next = [body.name?.trim() ?? row.name, body.icon === undefined ? row.icon : icon(body.icon), body.code === undefined ? row.code : codeOf(body.code), body.visibility === undefined ? row.visibility : visibility(body.visibility)];
      const rows = await pool.query('UPDATE projects SET trust=COALESCE($3,trust), egress_allow=COALESCE($4,egress_allow), budget=COALESCE($5,budget), name=$6, icon=$7, code=$8, visibility=$9 WHERE id=$1 AND owner_id=$2 RETURNING *', [row.id, userId(c), body.trust ?? null, body.egressAllow === undefined ? null : JSON.stringify(body.egressAllow), body.budget === undefined ? null : JSON.stringify(body.budget), ...next]);
      return c.json(view(rows.rows[0]));
    } catch (err) { return fail(c, err); }
  });
  app.post('/:id/repos/:repoId/clone', async (c) => {
    const row = await owned(c.req.param('id'), userId(c));
    const repo = (row?.repos as ProjectRepository[] | undefined)?.find((r) => r.id === c.req.param('repoId'));
    if (!row || !repo) return c.json({ error: 'not found' }, 404);
    if (repo.machineId) return c.json({ error: `repository lives on machine ${repo.machineId}; that machine's runner clones it` }, 409);
    try { return c.json(await materialize(row, repo)); } catch { return c.json({ error: 'clone failed' }, 502); }
  });
  return { basePath: '/api/v1/projects', app, public: false };
}
export default createProjectsRoute();
