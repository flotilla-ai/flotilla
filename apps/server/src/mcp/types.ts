import { ApiFailure } from '../api-platform/types.js';

export type McpTransport = 'http' | 'stdio';
/** Write shape. Header values may hold `${VAR}` placeholders resolved from the thread's env vars at run time. */
export type McpAuthInput =
  | { kind: 'none' }
  | { kind: 'headers'; headers: { name: string; value: string }[] }
  | { kind: 'oauth'; authorizeUrl: string; tokenUrl: string; clientId: string; clientSecret?: string; scopes?: string[] };
/** Read shape: names and configured-state only, never values. */
export type McpAuth =
  | { kind: 'none' }
  | { kind: 'headers'; headers: { name: string; configured: true; variables: string[] }[] }
  | { kind: 'oauth'; authorizeUrl: string; tokenUrl: string; clientId: string; clientSecretConfigured: boolean; scopes: string[]; redirectUri: string; connection: 'none' | 'pending' | 'connected'; flowId: string | null; expiresAt: string | null };
export type McpStatus = 'untested' | 'ok' | 'failing' | 'needs-auth' | 'pending-browser' | 'disabled';
export type McpTestStep = { name: 'config' | 'auth' | 'connect' | 'initialize' | 'tools'; ok: boolean | null; detail: string };
export type McpTestResult = { ok: boolean; at: string; steps: McpTestStep[]; failingStep: McpTestStep['name'] | null; httpStatus: number | null; checklist: string[]; tools: string[] };
export type McpServerInput = { key: string; name?: string; transport: McpTransport; url?: string; command?: string[]; env?: Record<string, string>; projectId?: string | null; enabled?: boolean; auth?: McpAuthInput };
export type McpServer = { id: string; key: string; name: string; transport: McpTransport; url: string | null; command: string[] | null; env: { name: string; configured: true }[]; projectId: string | null; enabled: boolean; status: McpStatus; auth: McpAuth; lastTest: McpTestResult | null; toolPrefix: string };
export type McpImport = { source: 'claude-json' | 'codex-toml' | 'url' | 'command'; servers: McpServerInput[]; warnings: string[] };
export type McpProposal =
  | { action: 'add'; server: McpServerInput }
  | { action: 'rename'; serverId: string; key: string }
  | { action: 'enable'; serverId: string }
  | { action: 'widen'; serverId: string };
/** Claude Code `--mcp-config` shape; the keys are the per-server tool prefixes. */
export type McpAdapterConfig = { mcpServers: Record<string, { type: 'http'; url: string; headers: Record<string, string> } | { type: 'stdio'; command: string; args: string[]; env: Record<string, string> }> };

export const MCP_KEY = /^[a-z][a-z0-9-]{0,31}$/;
/** Native tool names the agent sees: `mcp__<key>__<tool>` (Claude Code convention). */
export const toolName = (key: string, tool: string) => `mcp__${key}__${tool}`;
export const placeholders = (value: string) => [...value.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]);
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 32) || 'mcp';
export const FORBIDDEN_CHECKLIST = [
  'The API key or token belongs to an account with access to this server',
  'The OAuth scopes or key permissions include the tools you need',
  'The server allows requests from this Flotilla host (IP allowlist / egress)',
  'Reconnect or rotate the key, then press Test again'
];

const httpUrl = (u: unknown): string => {
  try { const url = new URL(String(u)); if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString(); } catch { /* invalid */ }
  throw new ApiFailure('ValidationFailed', 'url must be an http(s) URL');
};
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');
const record = (x: unknown): Record<string, string> => {
  if (x === undefined) return {};
  if (!x || typeof x !== 'object' || Object.values(x).some((v) => typeof v !== 'string')) throw new ApiFailure('ValidationFailed', 'env must map names to strings');
  return x as Record<string, string>;
};

export function parseServerInput(raw: unknown): McpServerInput {
  const b = (raw ?? {}) as Record<string, any>;
  if (typeof b.key !== 'string' || !MCP_KEY.test(b.key)) throw new ApiFailure('ValidationFailed', 'key must match [a-z][a-z0-9-]{0,31}; it prefixes this server\'s tool names');
  if (b.transport !== 'http' && b.transport !== 'stdio') throw new ApiFailure('ValidationFailed', 'transport must be http (Streamable HTTP) or stdio');
  const out: McpServerInput = { key: b.key, name: typeof b.name === 'string' ? b.name : b.key, transport: b.transport, projectId: typeof b.projectId === 'string' ? b.projectId : null, enabled: b.enabled !== false, env: record(b.env) };
  if (b.transport === 'http') out.url = httpUrl(b.url);
  else if (!strings(b.command) || !b.command.length) throw new ApiFailure('ValidationFailed', 'stdio servers need command: string[]'); else out.command = b.command;
  const a = (b.auth ?? { kind: 'none' }) as Record<string, any>;
  if (a.kind === 'none') out.auth = { kind: 'none' };
  else if (a.kind === 'headers' && Array.isArray(a.headers) && a.headers.every((h: any) => /^[A-Za-z0-9-]{1,64}$/.test(h?.name) && typeof h.value === 'string')) out.auth = { kind: 'headers', headers: a.headers.map((h: any) => ({ name: h.name, value: h.value })) };
  else if (a.kind === 'oauth' && typeof a.clientId === 'string' && a.clientId) out.auth = { kind: 'oauth', authorizeUrl: httpUrl(a.authorizeUrl), tokenUrl: httpUrl(a.tokenUrl), clientId: a.clientId, ...(typeof a.clientSecret === 'string' ? { clientSecret: a.clientSecret } : {}), scopes: strings(a.scopes) ? a.scopes : [] };
  else throw new ApiFailure('ValidationFailed', 'auth must be none, headers [{name,value}], or oauth {authorizeUrl,tokenUrl,clientId,clientSecret?,scopes?}');
  if (out.auth.kind === 'oauth' && out.transport !== 'http') throw new ApiFailure('ValidationFailed', 'OAuth is only for remote (http) servers');
  return out;
}

function splitCommand(line: string): string[] {
  const out: string[] = []; let cur = ''; let quote = ''; let any = false;
  for (const ch of line.trim()) {
    if (quote) { if (ch === quote) quote = ''; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; any = true; continue; }
    if (/\s/.test(ch)) { if (cur || any) out.push(cur); cur = ''; any = false; continue; }
    cur += ch;
  }
  if (quote) throw new ApiFailure('ValidationFailed', 'unterminated quote in command line');
  if (cur || any) out.push(cur);
  return out;
}
const runners = new Set(['npx', 'uvx', 'node', 'python', 'python3', 'bunx', 'pnpm', 'dlx', 'docker', 'run']);
const commandKey = (argv: string[]) => slug((argv.find((a) => !a.startsWith('-') && !runners.has(a)) ?? argv[0]).split('/').pop()!.replace(/@[^@]*$/, '') || argv[0]);
const urlKey = (u: string) => slug(new URL(u).hostname.split('.').filter((p) => !['mcp', 'www', 'api'].includes(p)).slice(0, -1)[0] ?? new URL(u).hostname);

function tomlValue(v: string): unknown {
  const s = v.trim();
  if (s.startsWith("'")) return s.slice(1, s.lastIndexOf("'"));
  return JSON.parse(s.startsWith('{') ? s.replace(/([A-Za-z0-9_-]+)\s*=/g, '"$1":') : s);
}
function fromEntry(key: string, e: Record<string, any>, warnings: string[]): McpServerInput {
  const headers: { name: string; value: string }[] = Object.entries({ ...e.headers, ...e.http_headers }).map(([name, value]) => ({ name, value: String(value) }));
  for (const [name, v] of Object.entries(e.env_http_headers ?? {})) headers.push({ name, value: `\${${v}}` });
  if (typeof e.bearer_token_env_var === 'string') headers.push({ name: 'Authorization', value: `Bearer \${${e.bearer_token_env_var}}` });
  const url = e.url ?? e.serverUrl;
  if (e.type === 'sse') warnings.push(`${key}: legacy SSE transport imported as Streamable HTTP`);
  const auth: McpAuthInput = headers.length ? { kind: 'headers', headers } : { kind: 'none' };
  if (url) return parseServerInput({ key: slug(key), name: key, transport: 'http', url, auth });
  return parseServerInput({ key: slug(key), name: key, transport: 'stdio', command: [e.command, ...(e.args ?? [])], env: e.env, auth });
}

/** Claude Code JSON (`mcpServers`), Codex TOML (`[mcp_servers.x]`), a URL, or a command line. */
export function parseImport(text: string): McpImport {
  const t = text.trim(); const warnings: string[] = [];
  if (t.startsWith('{')) {
    let j: any; try { j = JSON.parse(t); } catch { throw new ApiFailure('ValidationFailed', 'invalid JSON'); }
    const map = (j.mcpServers ?? j) as Record<string, Record<string, unknown>>;
    return { source: 'claude-json', servers: Object.entries(map).map(([k, e]) => fromEntry(k, e, warnings)), warnings };
  }
  if (/^\s*\[mcp_servers\./m.test(t)) {
    const tables = new Map<string, Record<string, any>>(); let cur: Record<string, any> | null = null;
    for (const raw of t.split('\n')) {
      const line = raw.replace(/^\s+|\s+$/g, ''); if (!line || line.startsWith('#')) continue;
      const head = /^\[mcp_servers\.([A-Za-z0-9_-]+)(?:\.([A-Za-z_]+))?\]$/.exec(line);
      if (head) { const e = tables.get(head[1]) ?? {}; tables.set(head[1], e); cur = head[2] ? (e[head[2]] ??= {}) : e; continue; }
      if (line.startsWith('[')) { cur = null; continue; }
      const kv = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
      if (!kv || !cur) continue;
      try { cur[kv[1]] = tomlValue(kv[2]); } catch { warnings.push(`skipped unparsed line: ${kv[1]}`); }
    }
    return { source: 'codex-toml', servers: [...tables].map(([k, e]) => fromEntry(k, e, warnings)), warnings };
  }
  if (/^https?:\/\/\S+$/.test(t)) return { source: 'url', servers: [parseServerInput({ key: urlKey(t), name: new URL(t).hostname, transport: 'http', url: t })], warnings };
  const argv = splitCommand(t); const env: Record<string, string> = {};
  while (argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0])) { const [k, ...v] = argv.shift()!.split('='); env[k] = v.join('='); }
  if (!argv.length) throw new ApiFailure('ValidationFailed', 'nothing to import');
  return { source: 'command', servers: [parseServerInput({ key: commandKey(argv), transport: 'stdio', command: argv, env })], warnings };
}
