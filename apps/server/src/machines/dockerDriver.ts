import type Docker from 'dockerode';
import { createThreadNetwork } from './network.js';
import { DockerExecTransport } from './transport.js';
import { gateClient } from '../gateClient/index.js';
import { KernelDenied, type ProcessTransport } from '@flotilla/core/types';

export type StartThreadInput = {
  threadId: string; code: string; image: string; cpus: number; memMb: number; env: Record<string, string>;
  roMounts?: { source: string; target: string }[]; cliHome?: { userVolume: string; threadVolume: string };
  egressAllow?: string[]; gate?: { adminUrl: string; token: string }; platform?: string;
  /** Shared placement: mount this thread's workspace read-only instead of a fresh volume. */
  workspaceFrom?: string;
};

export class DockerMachineDriver {
  static readonly platforms = ['linux'] as const;
  constructor(readonly docker: Docker) {}

  async startThreadContainer(input: StartThreadInput): Promise<{ containerId: string }> {
    if (input.platform && input.platform !== 'linux') throw new KernelDenied('scope', `pool machines are Linux containers only; run ${input.platform} on a paired device (BYOM)`);
    for (const old of await this.docker.listContainers({ all: true, filters: { name: [`flt-${input.code}`] } })) {
      const exact = old.Names?.includes(`/flt-${input.code}`) && old.Labels?.['flotilla.thread'] === input.threadId;
      if (exact) await this.docker.getContainer(old.Id).remove({ force: true }).catch(() => undefined);
    }
    const network = await createThreadNetwork(this.docker, input.threadId);
    const volumeName = `flt-workspace-${input.workspaceFrom ?? input.threadId}`;
    if (!input.workspaceFrom) await this.docker.createVolume({ Name: volumeName, Labels: { 'flotilla.thread': input.threadId } }).catch(() => undefined);
    const env = { ...input.env, HTTPS_PROXY: 'http://gate:3128', HTTP_PROXY: 'http://gate:3128', NO_PROXY: 'flotilla-tools' };
    const container = await this.docker.createContainer({
      name: `flt-${input.code}`, Image: input.image, User: 'node', Tty: false, Cmd: ['sleep', 'infinity'],
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`), WorkingDir: '/workspace',
      Labels: { 'flotilla.thread': input.threadId },
      HostConfig: {
        Init: true, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], Privileged: false,
        PidsLimit: 256, Memory: input.memMb * 1024 * 1024, MemorySwap: input.memMb * 1024 * 1024, OomKillDisable: false, NanoCpus: Math.round(input.cpus * 1e9),
        NetworkMode: network.id,
        Mounts: [
          { Type: 'volume', Source: volumeName, Target: '/workspace', ReadOnly: Boolean(input.workspaceFrom) },
          ...(input.cliHome ? [{ Type: 'volume' as const, Source: input.cliHome.threadVolume, Target: '/home/node/.claude' }] : []),
          ...(input.roMounts ?? []).map((m) => ({ Type: 'bind' as const, Source: m.source, Target: m.target, ReadOnly: true }))
        ]
      }
    });
    await container.start();
    if (input.egressAllow) {
      const inspect = await network.inspect().catch(() => null);
      const gateIds = new Set((await this.docker.listContainers({ all: true, filters: { label: ['flotilla.role=gate'] } })).map((x) => x.Id));
      const gateIp = Object.entries(inspect?.Containers ?? {}).find(([id]) => gateIds.has(id))?.[1]?.IPv4Address?.split('/')[0];
      await gateClient(input.gate?.adminUrl, input.gate?.token).putNetwork(`flt-${input.threadId}`, input.egressAllow, gateIp).catch(() => undefined);
    }
    return { containerId: container.id };
  }

  transport(containerId: string): ProcessTransport { return new DockerExecTransport(this.docker, containerId); }

  async copyIn(containerId: string, dir: string, tar: Buffer): Promise<void> {
    await this.docker.getContainer(containerId).putArchive(tar, { path: dir });
  }

  async copyOut(containerId: string, path: string, maxBytes = Infinity): Promise<Buffer> {
    const stream = await this.docker.getContainer(containerId).getArchive({ path });
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of stream) { size += chunk.length; if (size > maxBytes) { (stream as NodeJS.ReadableStream & { destroy(): void }).destroy(); throw new Error(`${path} is larger than ${maxBytes} bytes`); } chunks.push(Buffer.from(chunk)); }
    return Buffer.concat(chunks);
  }

  async stop(containerId: string): Promise<void> { await this.docker.getContainer(containerId).stop({ t: 5 }).catch(() => undefined); }

  async remove(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect().catch(() => null);
    await container.remove({ force: true }).catch(() => undefined);
    const gateIds = new Set((await this.docker.listContainers({ all: true, filters: { label: ['flotilla.role=gate'] } })).map((x) => x.Id));
    for (const name of Object.keys(info?.NetworkSettings?.Networks ?? {})) {
      const network = this.docker.getNetwork(name);
      const inspect = await network.inspect().catch(() => null);
      const attached = Object.entries(inspect?.Containers ?? {});
      // A wake may have started the replacement on the same thread network while the old
      // container was being removed. Leave that network and its gate rules intact.
      if (attached.some(([id]) => !gateIds.has(id))) continue;
      await gateClient().deleteNetwork(name).catch(() => undefined);
      for (const [attachedId] of attached) await network.disconnect({ Container: attachedId, Force: true }).catch(() => undefined);
      await network.remove().catch(() => undefined);
    }
  }
}
