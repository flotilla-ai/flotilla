import { ApiFailure } from '../api-platform/types.js';

export type SetupPhaseName = 'initialize' | 'refresh';
export type SetupPhase = { script: string; timeoutSec: number };
export type StartupEntry = { name: string; command: string; readinessPort: number | null; preview: boolean };
export type NamedCommand = { name: string; command: string; description: string };
export type EnvironmentSpec = { setup: Record<SetupPhaseName, SetupPhase>; startup: StartupEntry[]; commands: NamedCommand[] };
export type EnvironmentSource = 'user' | 'agent' | 'repo-file';
export type Verification = { state: 'passed' | 'failed' | 'timeout'; phase: SetupPhaseName; exitCode: number | null; at: string };
export type EnvironmentVersion = { projectId: string; version: number; spec: EnvironmentSpec; source: EnvironmentSource; createdBy: string | null; threadId: string | null; note: string; verification: Verification | null; createdAt: string | null };
export type ProcessKind = 'setup' | 'startup' | 'command';
export type ProcessState = 'idle' | 'running' | 'ready' | 'passed' | 'failed' | 'timeout' | 'stopped';
export type RunResult = { state: ProcessState; exitCode: number | null; output: string };
/** What the machine offers; the executor never branches on machine or adapter names. */
export type MachineCapabilities = { repoDir: string; sudo: boolean };

export const DEFAULT_TIMEOUT: Record<SetupPhaseName, number> = { initialize: 900, refresh: 300 };
const NAME = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/;
const MAX_SCRIPT = 64 * 1024;
const MAX_ENTRIES = 32;
const fail = (msg: string): never => { throw new ApiFailure('ValidationFailed', msg); };
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {});
const script = (x: unknown, what: string): string => {
  if (x === undefined || x === null) return '';
  if (typeof x !== 'string' || Buffer.byteLength(x) > MAX_SCRIPT) return fail(`${what} must be a string up to 64 KiB`);
  return x;
};
function names<T extends { name: string }>(items: T[], what: string): T[] {
  if (items.length > MAX_ENTRIES) fail(`at most ${MAX_ENTRIES} ${what}`);
  const seen = new Set<string>();
  for (const i of items) { if (!NAME.test(i.name)) fail(`${what}: invalid name`); if (seen.has(i.name)) fail(`${what}: duplicate name ${i.name}`); seen.add(i.name); }
  return items;
}
const list = (x: unknown, what: string): Record<string, unknown>[] => (x === undefined ? [] : Array.isArray(x) ? x.map(obj) : fail(`${what} must be an array`));

/** Validates an `EnvironmentSpec`, filling defaults (initialize 900 s, refresh 300 s). */
export function parseEnvironmentSpec(raw: unknown): EnvironmentSpec {
  const r = obj(raw); const setup = obj(r.setup);
  const phase = (name: SetupPhaseName): SetupPhase => {
    const p = obj(setup[name]); const timeoutSec = p.timeoutSec ?? DEFAULT_TIMEOUT[name];
    if (!Number.isInteger(timeoutSec) || (timeoutSec as number) < 60 || (timeoutSec as number) > 3600) fail(`${name} timeoutSec must be an integer in 60-3600`);
    return { script: script(p.script, `${name} script`), timeoutSec: timeoutSec as number };
  };
  const startup = names(list(r.startup, 'startup entries').map((e) => {
    const port = e.readinessPort ?? null;
    if (port !== null && (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535)) fail('readinessPort must be 1-65535');
    return { name: String(e.name ?? ''), command: script(e.command, 'startup command') || fail('startup entries need a command'), readinessPort: port as number | null, preview: e.preview === true };
  }), 'startup entries');
  const commands = names(list(r.commands, 'commands').map((c) => ({ name: String(c.name ?? ''), command: script(c.command, 'command') || fail('commands need a command'), description: typeof c.description === 'string' ? c.description.slice(0, 200) : '' })), 'commands');
  return { setup: { initialize: phase('initialize'), refresh: phase('refresh') }, startup, commands };
}

export const SETUP_FILES = ['.flotilla/setup.json', '.capy/setup.json'] as const;
/** `.flotilla/setup.json` is an `EnvironmentSpec`; `.capy/setup.json` is mapped for migration (field names are inferred, see DECISIONS-LOG). */
export function parseSetupFile(path: string, content: string): EnvironmentSpec {
  let raw: unknown;
  try { raw = JSON.parse(content); } catch { return fail(`${path} is not valid JSON`); }
  if (path !== '.capy/setup.json') return parseEnvironmentSpec(raw);
  const r = obj(raw); const setup = { ...obj(r.setup), ...r };
  const phase = (x: unknown) => (typeof x === 'string' ? { script: x } : { script: obj(x).script ?? obj(x).command, timeoutSec: obj(x).timeoutSec ?? obj(x).timeout });
  return parseEnvironmentSpec({
    setup: { initialize: phase(setup.initialize), refresh: phase(setup.refresh) },
    startup: list(r.startup ?? r.startupEntries ?? r.services, 'startup entries').map((e) => ({ name: e.name, command: e.command, readinessPort: e.readinessPort ?? e.port ?? null, preview: e.preview === true })),
    commands: list(r.commands, 'commands').map((c) => ({ name: c.name, command: c.command, description: c.description }))
  });
}

/** Fresh clone runs `initialize`; a moved checkout runs `refresh`; otherwise nothing. */
export function choosePhase(x: { freshClone: boolean; head: string | null; lastHead: string | null }): SetupPhaseName | null {
  if (x.freshClone) return 'initialize';
  return x.head !== x.lastHead ? 'refresh' : null;
}
