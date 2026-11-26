import type Docker from 'dockerode';
import { createThreadNetwork } from './network.js';
import { DockerExecTransport } from './transport.js';
import type { ProcessTransport } from '@flotilla/core/types';

export type StartThreadInput = {
  threadId: string; code: string; image: string; cpus: number; memMb: number; env: Record<string, string>;
  roMounts?: { source: string; target: string }[]; cliHome?: { userVolume: string; threadVolume: string };
};

export class DockerMachineDriver {
  constructor(readonly docker: Docker) {}

  async startThreadContainer(input: StartThreadInput): Promise<{ containerId: string }> {
    const network = await createThreadNetwork(this.docker, input.threadId);
    const volumeName = `flt-workspace-${input.threadId}`;
    await this.docker.createVolume({ Name: volumeName, Labels: { 'flotilla.thread': input.threadId } }).catch(() => undefined);
    const env = { ...input.env, HTTPS_PROXY: 'http://gate:3128', HTTP_PROXY: 'http://gate:3128', NO_PROXY: 'flotilla-tools' };
    const container = await this.docker.createContainer({
      name: `flt-${input.code}`, Image: input.image, User: 'node', Tty: false, Cmd: ['sleep', 'infinity'],
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`), WorkingDir: '/workspace',
      Labels: { 'flotilla.thread': input.threadId },
      HostConfig: {
        Init: true, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], Privileged: false,
        PidsLimit: 256, Memory: input.memMb * 1024 * 1024, NanoCpus: Math.round(input.cpus * 1e9),
        NetworkMode: network.id,
        Mounts: [
          { Type: 'volume', Source: volumeName, Target: '/workspace' },
          ...(input.cliHome ? [{ Type: 'volume' as const, Source: input.cliHome.threadVolume, Target: '/home/node/.claude' }] : []),
          ...(input.roMounts ?? []).map((m) => ({ Type: 'bind' as const, Source: m.source, Target: m.target, ReadOnly: true }))
        ]
      }
    });
    await container.start();
    return { containerId: container.id };
  }

  transport(containerId: string): ProcessTransport { return new DockerExecTransport(this.docker, containerId); }

  async copyIn(containerId: string, dir: string, tar: Buffer): Promise<void> {
    await this.docker.getContainer(containerId).putArchive(tar, { path: dir });
  }

  async copyOut(containerId: string, path: string): Promise<Buffer> {
    const stream = await this.docker.getContainer(containerId).getArchive({ path });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async stop(containerId: string): Promise<void> { await this.docker.getContainer(containerId).stop({ t: 5 }).catch(() => undefined); }

  async remove(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect().catch(() => null);
    await container.remove({ force: true }).catch(() => undefined);
    for (const name of Object.keys(info?.NetworkSettings?.Networks ?? {})) {
      const network = this.docker.getNetwork(name);
      const inspect = await network.inspect().catch(() => null);
      for (const attached of Object.keys(inspect?.Containers ?? {})) {
        await network.disconnect({ Container: attached, Force: true }).catch(() => undefined);
      }
      await network.remove().catch(() => undefined);
    }
  }
}
