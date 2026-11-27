import { randomBytes } from 'node:crypto';
import { PassThrough } from 'node:stream';
import type Docker from 'dockerode';
import type { ProcessHandle, ProcessTransport } from '@flotilla/core/types';

async function* lines(stream: PassThrough): AsyncIterable<string> {
  let rest = '';
  for await (const chunk of stream) {
    rest += chunk.toString();
    let at = rest.indexOf('\n');
    while (at >= 0) { yield rest.slice(0, at); rest = rest.slice(at + 1); at = rest.indexOf('\n'); }
  }
  if (rest) yield rest;
}

class DockerHandle implements ProcessHandle {
  stdout: AsyncIterable<string>;
  stderr: AsyncIterable<string>;
  exit: Promise<{ code: number | null; signal: string | null }>;
  constructor(private readonly docker: Docker, private readonly containerId: string, readonly execId: string, exec: Docker.Exec, stream: NodeJS.ReadableStream) {
    const out = new PassThrough(); const err = new PassThrough();
    this.docker.modem.demuxStream(stream, out, err);
    stream.on('end', () => { out.end(); err.end(); });
    stream.on('close', () => { out.end(); err.end(); });
    this.stdout = lines(out); this.stderr = lines(err);
    this.exit = new Promise((resolve) => {
      stream.on('end', async () => {
        const info = await exec.inspect();
        resolve({ code: info.ExitCode ?? null, signal: null });
      });
      stream.on('error', () => resolve({ code: null, signal: null }));
    });
  }
  async signal(sig: 'SIGINT' | 'SIGTERM' | 'SIGKILL'): Promise<void> {
    const exec = await this.docker.getContainer(this.containerId).exec({ Cmd: ['/opt/flotilla/bin/flotilla-exec', '--signal', sig, this.execId], AttachStdout: false, AttachStderr: false });
    await exec.start({});
  }
}

export class DockerExecTransport implements ProcessTransport {
  constructor(private readonly docker: Docker, private readonly containerId: string) {}
  spawn(argv: string[], opts: { cwd: string; env: Record<string, string> }): ProcessHandle {
    const id = randomBytes(8).toString('hex');
    let resolveHandle!: (h: ProcessHandle) => void; let rejectHandle!: (e: unknown) => void;
    const promise = new Promise<ProcessHandle>((r, reject) => { resolveHandle = r; rejectHandle = reject; });
    void (async () => {
      const exec = await this.docker.getContainer(this.containerId).exec({
        Cmd: ['/opt/flotilla/bin/flotilla-exec', id, '--', ...argv], WorkingDir: opts.cwd,
        Env: Object.entries(opts.env).map(([k, v]) => `${k}=${v}`), AttachStdout: true, AttachStderr: true
      });
      const stream = await exec.start({ hijack: true, stdin: false });
      stream.end();
      resolveHandle(new DockerHandle(this.docker, this.containerId, id, exec, stream));
    })().catch(rejectHandle);
    const lazy = async <T>(fn: (h: ProcessHandle) => T): Promise<T> => fn(await promise);
    const exit = lazy((h) => h.exit).then((x) => x);
    void exit.catch(() => undefined);
    return {
      stdout: (async function* () { yield* (await promise).stdout; })(),
      stderr: (async function* () { yield* (await promise).stderr; })(),
      exit,
      signal: async (sig) => { await lazy((h) => h.signal(sig)); }
    };
  }
}
