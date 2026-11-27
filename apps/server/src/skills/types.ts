import { tarFile } from '../captain/tools/mcpConfig.js';

export type SkillSourceKind = 'builtin' | 'repo' | 'drive' | 'plugin';
export const REPO_SKILL_DIRS = ['.agents/skills', '.claude/skills'] as const;
export type RepoSkillDir = (typeof REPO_SKILL_DIRS)[number];
export type SkillSource =
  | { kind: 'builtin' }
  | { kind: 'repo'; projectId: string; dir: RepoSkillDir }
  | { kind: 'drive'; scope: 'user' | 'project'; projectId: string | null }
  | { kind: 'plugin'; plugin: string };
export type SkillLoadState = { state: 'loaded' } | { state: 'not-loaded'; reason: string } | { state: 'replaced'; by: SkillSourceKind };
/** One SKILL.md folder; `files` are folder-relative paths (SKILL.md plus any supporting files). */
export type Skill = { id: string; name: string; description: string; source: SkillSource; origin: string; files: Record<string, string>; load: SkillLoadState };
export type SkillTrigger = '$' | '/' | '@' | 'words';
export type SkillInvocation = { name: string; trigger: SkillTrigger; source: SkillSourceKind; path: string };
export const IMPORT_ORIGINS = ['claude-code', 'cursor', 'skills-cli'] as const;

/** Agent-native user skill folders under the thread user's home; every loaded skill is copied into each. */
export const SKILL_HOME = '/home/node';
export const MOUNT_ROOTS = ['.agents/skills', '.claude/skills', '.codex/skills'] as const;
export const MAX_BYTES = 256 * 1024;
export const MAX_FILES = 200;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `name` and `description` from SKILL.md YAML frontmatter (plain, quoted, or `>`/`|` block scalars). */
export function parseSkillMd(text: string): { name: string; description: string } | { error: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text ?? '');
  if (!m) return { error: 'SKILL.md has no frontmatter' };
  const fields: Record<string, string> = {}; const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]); if (!kv) continue;
    let v = kv[2].trim();
    if (/^[>|][-+]?$/.test(v)) { const block: string[] = []; while (i + 1 < lines.length && /^(\s+|$)/.test(lines[i + 1]) && !/^\S/.test(lines[i + 1])) block.push(lines[++i].trim()); v = block.filter(Boolean).join(v.startsWith('>') ? ' ' : '\n'); }
    else if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    fields[kv[1]] = v;
  }
  if (!fields.name) return { error: 'frontmatter has no name' };
  if (!fields.description) return { error: 'frontmatter has no description' };
  return { name: fields.name, description: fields.description };
}

/** Why a skill folder cannot load, or its frontmatter. */
export function validateSkill(folder: string, files: Record<string, string>): { name: string; description: string } | { error: string } {
  if (typeof files['SKILL.md'] !== 'string') return { error: 'missing SKILL.md' };
  const meta = parseSkillMd(files['SKILL.md']); if ('error' in meta) return meta;
  if (!NAME.test(meta.name) || meta.name.length > 64) return { error: `name "${meta.name}" must be lowercase letters, digits and hyphens (max 64)` };
  if (meta.name !== folder) return { error: `name "${meta.name}" does not match folder "${folder}"` };
  if (meta.description.length > 1024) return { error: 'description is longer than 1024 characters' };
  if (Object.values(files).reduce((n, f) => n + Buffer.byteLength(f), 0) > MAX_BYTES) return { error: 'skill folder is larger than 256 KB' };
  if (Object.keys(files).some((p) => `.claude/skills/${folder}/${p}`.length > 100)) return { error: 'file path too long to mount' };
  return meta;
}

/** Folder-relative path with no absolute, empty or `..` segments, else null. */
export function safeRel(path: string): string[] | null {
  const segs = path.replace(/\\/g, '/').replace(/^\.\//, '').split('/');
  return path.startsWith('/') || segs.some((s) => !s || s === '..' || s === '.') ? null : segs;
}

const rank = (s: SkillSource) => s.kind === 'repo' ? (s.dir === '.agents/skills' ? 0 : 1) : s.kind === 'drive' ? (s.scope === 'project' ? 2 : 3) : s.kind === 'plugin' ? 4 : 5;
/** Load states: the highest-precedence valid, enabled folder of a name loads (repo > Drive project > Drive personal > plugin > built-in); the rest are replaced by it. */
export function resolveSkills(candidates: Omit<Skill, 'load'>[], disabled: Set<string>): Skill[] {
  const sorted = [...candidates].sort((a, b) => rank(a.source) - rank(b.source) || a.id.localeCompare(b.id));
  const winners = new Map<string, SkillSourceKind>();
  return sorted.map((s) => {
    const meta = validateSkill(s.name, s.files);
    const load: SkillLoadState = 'error' in meta ? { state: 'not-loaded', reason: meta.error }
      : disabled.has(`${s.source.kind}:${s.name}`) ? { state: 'not-loaded', reason: 'turned off' }
      : winners.has(s.name) ? { state: 'replaced', by: winners.get(s.name)! } : { state: 'loaded' };
    if (load.state === 'loaded') winners.set(s.name, s.source.kind);
    return { ...s, description: 'error' in meta ? s.description : meta.description, load };
  });
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Skills a message invokes, in text order: `$name`, `/name`, `@name`, the name as words ("make a deck"), or "<name> skill". */
export function parseInvocations(text: string, names: Set<string>): { name: string; trigger: SkillTrigger }[] {
  const hits: { at: number; name: string; trigger: SkillTrigger }[] = [];
  for (const m of text.matchAll(/(^|\s)([$/@])([a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])/g)) if (names.has(m[3])) hits.push({ at: m.index! + m[1].length, name: m[3], trigger: m[2] as SkillTrigger });
  for (const name of names) {
    const words = name.split('-').map(esc);
    const re = new RegExp(`(?<![\\w$/@-])(?:${words.length > 1 ? `${words.join('[ -]')}|` : ''}${esc(name)}\\s+skill\\b|skill\\s+${esc(name)}(?![\\w-]))`, 'i');
    const m = re.exec(text); if (m) hits.push({ at: m.index, name, trigger: 'words' });
  }
  const seen = new Set<string>();
  return hits.sort((a, b) => a.at - b.at).filter((h) => !seen.has(h.name) && seen.add(h.name)).map(({ name, trigger }) => ({ name, trigger }));
}

export const skillPath = (name: string) => `${SKILL_HOME}/${MOUNT_ROOTS[0]}/${name}/SKILL.md`;
/** Scripts (shebang files) keep a runnable 0755 mode; the header checksum is recomputed. */
function executable(t: Buffer): Buffer {
  t.write('0000755\0', 100); t.write('        ', 148);
  let sum = 0; for (const b of t.subarray(0, 512)) sum += b;
  t.write(sum.toString(8).padStart(6, '0') + '\0 ', 148); return t;
}
/** One tar (extracted at SKILL_HOME) holding every loaded skill folder in each agent-native root. */
export function skillsTar(skills: Skill[]): Buffer {
  const parts: Buffer[] = [];
  for (const s of skills) for (const root of MOUNT_ROOTS) for (const [rel, body] of Object.entries(s.files)) { const t = tarFile(`${root}/${s.name}/${rel}`, body).subarray(0, -1024); parts.push(body.startsWith('#!') ? executable(t) : t); }
  return Buffer.concat([...parts, Buffer.alloc(1024)]);
}
export function invocationNote(invs: SkillInvocation[], skills: Skill[]): string {
  if (!invs.length) return '';
  const desc = new Map(skills.map((s) => [s.name, s.description]));
  return `Skills invoked for this message (read each SKILL.md and follow it):\n${invs.map((i) => `- ${i.name}: ${desc.get(i.name)} (${i.path})`).join('\n')}\n\n`;
}

const builtin = (name: string, description: string, body: string): Omit<Skill, 'load'> => ({ id: `builtin:${name}`, name, description, source: { kind: 'builtin' }, origin: 'flotilla', files: { 'SKILL.md': `---\nname: ${name}\ndescription: ${description}\n---\n${body}\n` } });
export const BUILTIN_SKILLS: Omit<Skill, 'load'>[] = [
  builtin('artifact', 'Build a self-contained HTML artifact (report, chart, diagram) the user can open without a server.', 'Write one HTML file with inline CSS/JS and no external requests. Greys and black; orange only for things that need the user. Save it in the workspace and link its path in your reply.'),
  builtin('flotilla-setup', 'Write and verify the project dev environment (setup scripts, startup services, commands) on this thread machine.', 'Read the current environment with the environment.read tool, write `.flotilla/setup.json` or call environment.replace with the version you read, then run environment.verify and fix failures before reporting.'),
  builtin('find-mcp-server', 'Find an MCP server that gives the thread a missing capability and explain how to add it.', 'Name the capability, look for an official server from the vendor first, check its license and auth, and propose the MCP config entry. Never paste credentials.'),
  builtin('gh-stack', 'Split work into a stack of small dependent GitHub pull requests.', 'Plan the stack bottom-up, one branch per PR based on the previous branch, push each, open each PR against its parent branch, and list the stack in every PR body.'),
  builtin('make-a-deck', 'Make a slide deck as an HTML file.', 'Outline first (one idea per slide), then write one HTML file with a slide per section, keyboard navigation and print styles.'),
  builtin('make-a-page', 'Make a single web page (landing page, doc page) as static files.', 'Write semantic HTML and one CSS file, check it at mobile and desktop widths, and preview it before reporting.'),
  builtin('make-a-prototype', 'Make a clickable UI prototype to try an idea quickly.', 'Use the project stack if there is one, else a single Vite app. Fake data, real interactions; start a preview and share it.'),
  builtin('paper', 'Draw designs and diagrams on a Paper canvas.', 'Sketch the layout in boxes first, then refine. Export the result as an image into the workspace and link it.'),
  builtin('spreadsheets', 'Create, read and edit spreadsheets (CSV, XLSX).', 'Keep raw data and formulas separate, never overwrite the input file, and summarize what changed with row counts.')
];
