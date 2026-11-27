import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { ProcessTransport } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';

export type MachineNetworkMode = 'public' | 'private' | 'oidc';
export interface MachineNetwork { threadId: string; mode: MachineNetworkMode; inbound: 'none-published'; access: string; updatedAt: string | null }
export interface MachineResize { threadId: string; size: string; fresh: boolean; state: string }
export interface BackgroundCommand { id: string; threadId: string; command: string; cwd: string; pid: number | null; state: 'running' | 'exited' | 'stopped'; exitCode: number | null; output: string; createdAt: string; endedAt: string | null }
export interface WorkspaceFile { path: string; size: number }
export interface WorkspaceDriver {
  transport(containerId: string): ProcessTransport;
  listWorkspaceFiles?(threadId: string, path?: string): Promise<WorkspaceFile[]>;
  readWorkspaceFile?(threadId: string, path: string): Promise<string>;
}
const id = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;
const rowToCommand = (r: Record<string, any>): BackgroundCommand => ({ id: r.id, threadId: r.thread_id, command: r.command, cwd: r.cwd, pid: r.pid, state: r.state, exitCode: r.exit_code, output: r.output, createdAt: r.created_at?.toISOString?.() ?? '', endedAt: r.ended_at?.toISOString?.() ?? null });
const cleanPath = (path: string): string => {
  if (path.includes('\0') || path.startsWith('/') || path.split('/').includes('..')) throw new ApiFailure('ValidationFailed', 'path must stay inside the workspace');
  return path.replace(/^\.\//, '');
};
async function output(handle: { stdout: AsyncIterable<string>; stderr: AsyncIterable<string>; exit: Promise<{ code: number | null }> }): Promise<{ code: number | null; text: string }> {
  let text = '';
  const read = async (stream: AsyncIterable<string>) => { for await (const line of stream) text += `${line}\n`; };
  await Promise.all([read(handle.stdout), read(handle.stderr).catch(() => undefined)]);
  return { code: (await handle.exit).code, text };
}
async function execText(transport: ProcessTransport, argv: string[], cwd = '/workspace'): Promise<string> {
  const h = transport.spawn(argv, { cwd, env: {} });
  return (await output(h)).text;
}

/** Machine UX/network slice for pool machines: posture metadata, sleeping workspace reads and shell commands that become durable background rows. */
export class MachineUxStore {
  readonly pool: pg.Pool;
  constructor(databaseUrl: string) { this.pool = new pg.Pool({ connectionString: databaseUrl, max: 3 }); }
  private async q(sql: string, params: unknown[] = []): Promise<Record<string, any>[]> { return (await this.pool.query(sql, params)).rows; }
  async network(threadId: string): Promise<MachineNetwork> {
    const [r] = await this.q('SELECT * FROM machine_networks WHERE thread_id=$1', [threadId]);
    const mode = (r?.mode ?? 'private') as MachineNetworkMode;
    return { threadId, mode, inbound: 'none-published', access: mode === 'public' ? 'authenticated Flotilla session; containers publish no host ports' : mode === 'oidc' ? 'OIDC-required private access' : 'private per-thread Docker network', updatedAt: r?.updated_at?.toISOString?.() ?? null };
  }
  async setNetwork(threadId: string, raw: unknown): Promise<MachineNetwork> {
    const mode = String(raw ?? '');
    if (!['public', 'private', 'oidc'].includes(mode)) throw new ApiFailure('ValidationFailed', 'network mode must be public, private or oidc');
    if (mode === 'oidc' && !process.env.FLOTILLA_OIDC_ISSUER) throw new ApiFailure('Conflict', 'OIDC machine access requires FLOTILLA_OIDC_ISSUER');
    await this.q('INSERT INTO machine_networks (thread_id,mode) VALUES ($1,$2) ON CONFLICT (thread_id) DO UPDATE SET mode=$2,updated_at=now()', [threadId, mode]);
    return this.network(threadId);
  }
  async listFiles(threadId: string, driver: WorkspaceDriver, path = ''): Promise<WorkspaceFile[]> {
    if (!driver.listWorkspaceFiles) throw new ApiFailure('Conflict', 'machine driver cannot read a sleeping workspace');
    return driver.listWorkspaceFiles(threadId, cleanPath(path));
  }
  async readFile(threadId: string, driver: WorkspaceDriver, path: string): Promise<{ path: string; content: string }> {
    if (!driver.readWorkspaceFile) throw new ApiFailure('Conflict', 'machine driver cannot read a sleeping workspace');
    const clean = cleanPath(path);
    if (!clean) throw new ApiFailure('ValidationFailed', 'path is required');
    return { path: clean, content: await driver.readWorkspaceFile(threadId, clean) };
  }
  /** Starts a shell command. If it is still running after timeoutMs, the row stays durable and the command continues in the machine. */
  async runCommand(threadId: string, transport: ProcessTransport, command: string, cwd = '/workspace', timeoutMs = 750): Promise<BackgroundCommand & { autoBackground: boolean }> {
    if (!command.trim()) throw new ApiFailure('ValidationFailed', 'command is required');
    if (!cwd.startsWith('/workspace')) throw new ApiFailure('ValidationFailed', 'cwd must stay inside /workspace');
    const rowId = id('bg'); const safe = rowId.replace(/[^a-zA-Z0-9_]/g, '');
    const dir = `/tmp/flotilla-bg/${safe}`; const encoded = Buffer.from(command).toString('base64');
    await this.q(`INSERT INTO machine_background_commands (id,thread_id,command,cwd,state) VALUES ($1,$2,$3,$4,'running')`, [rowId, threadId, command, cwd]);
    const script = `mkdir -p '${dir}'; printf %s "$CMD_B64" | base64 -d > '${dir}/cmd'; setsid sh -c 'sh "$BGDIR/cmd" >"$BGDIR/out" 2>&1; echo $? >"$BGDIR/exit"' </dev/null >/dev/null 2>&1 & echo $! >'${dir}/pid'`;
    const launcher = transport.spawn(['sh', '-c', script], { cwd, env: { CMD_B64: encoded, BGDIR: dir } });
    const launched = await output(launcher);
    if (launched.code !== 0) {
      await this.q(`UPDATE machine_background_commands SET state='exited',exit_code=coalesce($2,-1),output=$3,ended_at=now() WHERE id=$1`, [rowId, launched.code, launched.text.slice(-8192)]);
      return { ...(rowToCommand((await this.q('SELECT * FROM machine_background_commands WHERE id=$1', [rowId]))[0])), autoBackground: false };
    }
    const deadline = Date.now() + Math.max(1, timeoutMs);
    for (;;) {
      const exitText = (await execText(transport, ['sh', '-c', `cat '${dir}/exit' 2>/dev/null`], cwd)).trim();
      if (/^-?\d+$/.test(exitText)) {
        const out = (await execText(transport, ['sh', '-c', `tail -c 8192 '${dir}/out' 2>/dev/null`], cwd)).slice(-8192);
        await this.q(`UPDATE machine_background_commands SET state='exited',exit_code=$2,output=$3,ended_at=now() WHERE id=$1`, [rowId, Number(exitText), out]);
        return { ...(rowToCommand((await this.q('SELECT * FROM machine_background_commands WHERE id=$1', [rowId]))[0])), autoBackground: false };
      }
      if (Date.now() >= deadline) {
        const pidText = (await execText(transport, ['sh', '-c', `cat '${dir}/pid' 2>/dev/null`], cwd)).trim();
        await this.q('UPDATE machine_background_commands SET pid=$2 WHERE id=$1', [rowId, /^\d+$/.test(pidText) ? Number(pidText) : null]);
        return { ...(rowToCommand((await this.q('SELECT * FROM machine_background_commands WHERE id=$1', [rowId]))[0])), autoBackground: true };
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  private async refreshRunning(threadId: string, transport: ProcessTransport): Promise<void> {
    const rows = await this.q(`SELECT * FROM machine_background_commands WHERE thread_id=$1 AND state='running' ORDER BY created_at DESC LIMIT 50`, [threadId]);
    for (const row of rows) {
      const dir = `/tmp/flotilla-bg/${String(row.id).replace(/[^a-zA-Z0-9_]/g, '')}`;
      const exitText = (await execText(transport, ['sh', '-c', `cat '${dir}/exit' 2>/dev/null`], row.cwd)).trim();
      if (!/^-?\d+$/.test(exitText)) continue;
      const out = (await execText(transport, ['sh', '-c', `tail -c 8192 '${dir}/out' 2>/dev/null`], row.cwd)).slice(-8192);
      await this.q(`UPDATE machine_background_commands SET state='exited',exit_code=$2,output=$3,ended_at=now() WHERE id=$1`, [row.id, Number(exitText), out]);
    }
  }
  async commands(threadId: string, transport?: ProcessTransport): Promise<BackgroundCommand[]> {
    if (transport) await this.refreshRunning(threadId, transport).catch(() => undefined);
    return (await this.q('SELECT * FROM machine_background_commands WHERE thread_id=$1 ORDER BY created_at DESC LIMIT 50', [threadId])).map(rowToCommand);
  }
  async stopCommand(threadId: string, commandId: string, transport: ProcessTransport): Promise<BackgroundCommand> {
    const [r] = await this.q('SELECT * FROM machine_background_commands WHERE id=$1 AND thread_id=$2', [commandId, threadId]);
    if (!r) throw new ApiFailure('NotFound', 'background command not found');
    if (r.state === 'running') {
      const dir = `/tmp/flotilla-bg/${commandId.replace(/[^a-zA-Z0-9_]/g, '')}`;
      await execText(transport, ['sh', '-c', `pid="$(cat '${dir}/pid' 2>/dev/null)"; case "$pid" in ''|*[!0-9]*) exit 0;; esac; kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true; sleep 0.1; kill -KILL -"$pid" 2>/dev/null || true`], r.cwd).catch(() => '');
      await this.q(`UPDATE machine_background_commands SET state='stopped',ended_at=now() WHERE id=$1`, [commandId]);
    }
    return rowToCommand((await this.q('SELECT * FROM machine_background_commands WHERE id=$1', [commandId]))[0]);
  }
}

const stores = new Map<string, MachineUxStore>();
export function machineUxStore(databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres@postgres:5432/flotilla'): MachineUxStore {
  let s = stores.get(databaseUrl); if (!s) stores.set(databaseUrl, (s = new MachineUxStore(databaseUrl))); return s;
}
