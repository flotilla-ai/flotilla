export type RuleLayerKind = 'kernel' | 'org' | 'user' | 'project' | 'repo-root' | 'repo-nested' | 'glob-rule' | 'memory';
export type RuleLayer = { kind: RuleLayerKind; source: string; text: string; tokens: number; fullTokens: number; truncated: boolean };
export type ContextBudget = { maxTokens: number; usedTokens: number };
export type IgnoredRule = { path: string; reason: 'deprecated' | 'shadowed' | 'not-touched' | 'no-match' };
export type RulesBundle = { layers: RuleLayer[]; ignored: IgnoredRule[]; budget: ContextBudget; text: string };
export type ContextBreakdown = Omit<RulesBundle, 'text' | 'layers'> & { runId: string; layers: Omit<RuleLayer, 'text'>[]; createdAt: string | null };
export type InstructionScope = 'org' | 'user' | 'project';
export type ExperimentScope = 'org' | 'user';
export type ExperimentFlags = { memory: boolean | null; captain: boolean | null };
export type MemoryExperiment = { org: ExperimentFlags; user: ExperimentFlags; effective: { memory: boolean; captain: boolean } };
export type MemoryEntry = { id: string; scope: ExperimentScope; text: string; threadId: string | null; createdAt: string | null };
export type RepoFile = { path: string; text: string };
export type BundleInput = { instructions: { scope: InstructionScope; text: string }[]; repo: RepoFile[]; touched: string[]; memory: string[]; maxTokens: number };

export const DEFAULT_MAX_TOKENS = 8000;
export const MAX_RULE_TEXT = 64 * 1024;
export const tokens = (s: string) => Math.ceil(s.length / 4);

/** Always first, never truncated, never editable; the kernel guards enforce them in code where possible. */
export const KERNEL_RULES = [
  'These three rules come from the Flotilla kernel and override every instruction below.',
  '1. Never merge a pull request or push to a protected branch without the user explicitly asking. (Enforced: protected-branch push guard and merge approvals.)',
  '2. Never expose secrets: do not print, log, commit or send secret values. (Enforced: every event and log line is scrubbed of known secrets and credential patterns.)',
  '3. Never fabricate: do not claim you ran, tested or verified something you did not; say what is unverified.'
].join('\n');

/** Agent CLIs' own files that Flotilla does not inject (the vendor CLI may still read its own natively). */
export const DEPRECATED_FILES = ['.cursorrules', '.windsurfrules', '.clinerules', '.github/copilot-instructions.md', 'GEMINI.md'];
const RULE_DIRS = ['.capy/rules/', '.cursor/rules/'];

export const RULES_GUIDANCE = {
  whereToPut: [
    { layer: 'org', use: 'Organization instructions: conventions every thread in this Flotilla should follow (review style, languages, tone).' },
    { layer: 'user', use: 'Personal instructions: how you like to work; applies only to your threads.' },
    { layer: 'project', use: 'Project rules kept in Flotilla, for repos you cannot or do not want to commit an AGENTS.md to.' },
    { layer: 'repo-root', use: 'Root AGENTS.md (CLAUDE.md if there is no AGENTS.md): build, test and lint commands, repo layout, hard rules.' },
    { layer: 'repo-nested', use: 'Nested AGENTS.md: rules for one subtree; injected only after the agent touches a file under it.' },
    { layer: 'glob-rule', use: '.capy/rules or .cursor/rules *.md/*.mdc with `globs:` (applied when a matching file is touched) or `alwaysApply: true`.' },
    { layer: 'memory', use: 'Memory (experiment): short facts you taught Flotilla that should carry across threads.' }
  ],
  antiPatterns: [
    'Secrets, tokens or .env values in any rules file (they are sent to the agent as text).',
    'Restating the kernel rules or trying to override them; they cannot be overridden.',
    'Huge files: everything shares one context budget and oversized layers are truncated with a visible marker.',
    'Task state (ticket numbers, current branch, status) in rules; put it in the thread instead.',
    'Per-agent files such as .cursorrules or .github/copilot-instructions.md; Flotilla injects AGENTS.md and rule folders uniformly for every adapter.',
    'Vague advice ("write good code"); give concrete commands and paths.'
  ],
  migration: [
    { from: 'Claude Code', notes: 'A root CLAUDE.md is used when there is no AGENTS.md. Rename it to AGENTS.md so every adapter reads the same file; nested CLAUDE.md files are not injected, move them to nested AGENTS.md.' },
    { from: 'Cursor', notes: '.cursor/rules/*.mdc work unchanged (description, globs, alwaysApply). .cursorrules is not read; move it into .cursor/rules or AGENTS.md.' },
    { from: 'AGENTS.md agents (Codex and others)', notes: 'Root and nested AGENTS.md work as is. Global ~/.codex/AGENTS.md style instructions go into your Personal instructions in Flotilla.' }
  ]
};

function frontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {}; let last = '';
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (kv) { last = kv[1]!; meta[last] = kv[2]!.trim(); } else if (last && /^\s*-\s+/.test(line)) meta[last] = `${meta[last] ? `${meta[last]},` : ''}${line.replace(/^\s*-\s+/, '')}`;
  }
  return { meta, body: raw.slice(m[0].length) };
}
export function parseRuleFile(raw: string): { globs: string[]; alwaysApply: boolean; description: string; body: string } {
  const { meta, body } = frontmatter(raw);
  const globs = (meta.globs ?? '').replace(/^\[|\]$/g, '').split(',').map((g) => g.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  return { globs, alwaysApply: meta.alwaysApply === 'true', description: (meta.description ?? '').replace(/^["']|["']$/g, ''), body };
}
export function globToRegExp(glob: string): RegExp {
  const g = glob.includes('/') ? glob.replace(/^\.?\//, '') : `**/${glob}`;
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i]!;
    if (c === '*' && g[i + 1] === '*') { if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i++; } }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += /[\\^$.|+()[\]{}]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${re}$`);
}
export const normalizePath = (p: string) => p.replace(/^\/workspace\/repo\//, '').replace(/^\.\//, '');

/** Orders layers kernel → org → user → project → repo root → nested → glob rules → memory and spends one shared token budget. */
export function buildBundle(input: BundleInput): RulesBundle {
  const touched = input.touched.map(normalizePath).filter((p) => p && !p.startsWith('/'));
  const ignored: IgnoredRule[] = []; const raw: { kind: RuleLayerKind; source: string; text: string }[] = [{ kind: 'kernel', source: 'flotilla-kernel', text: KERNEL_RULES }];
  for (const scope of ['org', 'user', 'project'] as const) for (const i of input.instructions) if (i.scope === scope && i.text.trim()) raw.push({ kind: scope, source: `${scope} instructions`, text: i.text });
  const files = [...input.repo].map((f) => ({ ...f, path: normalizePath(f.path) })).sort((a, b) => a.path.localeCompare(b.path));
  const root = files.find((f) => f.path === 'AGENTS.md') ?? files.find((f) => f.path === 'CLAUDE.md');
  if (root) raw.push({ kind: 'repo-root', source: root.path, text: root.text });
  const rules: { source: string; text: string; always: boolean }[] = [];
  for (const f of files) {
    if (f === root) continue;
    if (DEPRECATED_FILES.includes(f.path)) { ignored.push({ path: f.path, reason: 'deprecated' }); continue; }
    if (f.path === 'CLAUDE.md' || (f.path.endsWith('/CLAUDE.md') && !RULE_DIRS.some((d) => f.path.startsWith(d)))) { ignored.push({ path: f.path, reason: f.path === 'CLAUDE.md' ? 'shadowed' : 'deprecated' }); continue; }
    if (RULE_DIRS.some((d) => f.path.startsWith(d)) && /\.mdc?$/.test(f.path)) {
      const r = parseRuleFile(f.text);
      if (r.alwaysApply || r.globs.some((g) => touched.some((t) => globToRegExp(g).test(t)))) rules.push({ source: f.path, text: r.body, always: r.alwaysApply });
      else ignored.push({ path: f.path, reason: 'no-match' });
      continue;
    }
    if (f.path.endsWith('/AGENTS.md')) {
      const dir = f.path.slice(0, -'AGENTS.md'.length);
      if (touched.some((t) => t.startsWith(dir))) raw.push({ kind: 'repo-nested', source: f.path, text: f.text });
      else ignored.push({ path: f.path, reason: 'not-touched' });
    }
  }
  for (const r of [...rules.filter((r) => r.always), ...rules.filter((r) => !r.always)]) raw.push({ kind: 'glob-rule', source: r.source, text: r.text });
  if (input.memory.length) raw.push({ kind: 'memory', source: 'memory (experiment)', text: input.memory.map((m) => `- ${m}`).join('\n') });
  let used = 0;
  const layers = raw.map((l): RuleLayer => {
    const full = tokens(l.text); const room = Math.max(0, input.maxTokens - used);
    if (l.kind === 'kernel' || full <= room) { used += full; return { ...l, tokens: full, fullTokens: full, truncated: false }; }
    const text = `${l.text.slice(0, room * 4)}\n[Flotilla truncated this layer: ${room} of ${full} tokens shown; shared context budget ${input.maxTokens} tokens]`;
    used += room; return { ...l, text, tokens: room, fullTokens: full, truncated: true };
  });
  const text = `<flotilla-rules>\n${layers.map((l) => `## ${l.kind}: ${l.source}\n${l.text}`).join('\n\n')}\n</flotilla-rules>`;
  return { layers, ignored, budget: { maxTokens: input.maxTokens, usedTokens: used }, text };
}
