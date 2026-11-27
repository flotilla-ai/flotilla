import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const README = /^readme(\.(md|markdown|rst|txt))?$/i;
const WANTED = new Set(['package.json', 'Cargo.toml', 'pyproject.toml']);
const MAX = 160;

function tomlDescription(text = ''): string | null { return text.match(/^\s*description\s*=\s*(["'])(.*?)\1\s*$/m)?.[2] ?? null; }
function sentence(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const first = clean.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? clean;
  if (first.length > MAX) return `${first.slice(0, MAX - 1).replace(/\s+\S*$/, '')}…`;
  return /[.!?]$/.test(first) ? first : `${first}.`;
}
function readmeProse(md: string): string | null {
  const body = md.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '');
  for (const para of body.split(/\n\s*\n/)) {
    const lines = para.split('\n').filter((l) => !/^\s*(#|=+\s*$|-+\s*$|>|\||[-*+]\s|!\[|\[!\[)/.test(l));
    const text = lines.join(' ').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();
    if (/[a-z]{3}/i.test(text)) return text;
  }
  return null;
}

export function describeRepo(files: Record<string, string>): string | null {
  let manifest: unknown = null;
  try { manifest = (JSON.parse(files['package.json'] ?? 'null') as { description?: unknown } | null)?.description; } catch { manifest = null; }
  const fromManifest = (typeof manifest === 'string' && manifest.trim()) || tomlDescription(files['Cargo.toml']) || tomlDescription(files['pyproject.toml']);
  if (fromManifest) return sentence(fromManifest);
  const readme = Object.keys(files).find((f) => README.test(f));
  const prose = readme ? readmeProse(files[readme]) : null;
  return prose ? sentence(prose) : null;
}

export async function describeMirror(mirror: string, branch: string): Promise<string | null> {
  const git = (args: string[]) => exec('git', ['--git-dir', mirror, '-c', 'core.fsmonitor=false', ...args], { maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });
  const ref = await git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).then(() => `refs/heads/${branch}`, () => 'HEAD');
  const names = (await git(['ls-tree', '--name-only', ref])).stdout.split('\n').filter((n) => WANTED.has(n) || README.test(n));
  const files: Record<string, string> = {};
  for (const name of names) files[name] = (await git(['show', `${ref}:${name}`])).stdout.slice(0, 64 * 1024);
  return describeRepo(files);
}
