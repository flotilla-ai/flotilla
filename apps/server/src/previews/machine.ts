import { PassThrough } from 'node:stream';
import Docker from 'dockerode';
import type { PreviewMachine } from './types.js';

export function listeningPorts(procNetTcp: string): number[] {
  const ports = new Set<number>();
  for (const line of procNetTcp.split('\n')) {
    const f = line.trim().split(/\s+/);
    if (f[3] === '0A' && f[1]?.includes(':')) ports.add(parseInt(f[1].split(':').pop()!, 16));
  }
  return [...ports].sort((a, b) => a - b);
}

export function dockerPreviewMachine(docker = new Docker()): PreviewMachine {
  const box = (code: string) => docker.getContainer(`flt-${code}`);
  return {
    async state(code) {
      try { return (await box(code).inspect()).State?.Running ? 'awake' : 'asleep'; }
      catch (err) { return (err as { statusCode?: number }).statusCode === 404 ? 'asleep' : 'awake'; }
    },
    async listening(code) {
      const exec = await box(code).exec({ Cmd: ['cat', '/proc/net/tcp', '/proc/net/tcp6'], AttachStdout: true, AttachStderr: false });
      const stream = await exec.start({ hijack: true, stdin: false });
      const out = new PassThrough(); let text = '';
      out.on('data', (d) => { text += d.toString(); });
      docker.modem.demuxStream(stream, out, new PassThrough());
      await new Promise((resolve) => { stream.on('end', resolve); stream.on('close', resolve); stream.on('error', resolve); });
      return listeningPorts(text);
    },
    async run(code, command) {
      const exec = await box(code).exec({ Cmd: ['sh', '-c', 'cd /workspace/repo 2>/dev/null || cd /workspace; exec sh -c "$0"', command], AttachStdout: false, AttachStderr: false });
      await exec.start({ Detach: true });
    }
  };
}
