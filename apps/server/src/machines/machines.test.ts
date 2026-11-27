import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Docker from 'dockerode';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KernelDenied } from '@flotilla/core/types';
import { copyCliHome } from './cliHome.js';
import { DockerMachineDriver } from './dockerDriver.js';
import { assertIsolated } from './isolation.js';
import { reconcile } from './reaper.js';

const goodContainer = {
  Name: '/flt-x',
  Config: { User: 'node' },
  HostConfig: { CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], Binds: [], Mounts: [], PidsLimit: 256, Memory: 1, Privileged: false },
  NetworkSettings: { Networks: { 'flt-thr': {} } }
};
const goodNetwork = { Internal: true, Containers: { a: { Name: 'flt-x' }, b: { Name: 'gate' } } };

describe('machine isolation unit checks', () => {
  it('accepts a hardened inspect fixture', () => expect(() => assertIsolated(goodContainer, goodNetwork)).not.toThrow());
  it.each([
    [{ Config: { User: 'root' } }, 'root'],
    [{ HostConfig: { ...goodContainer.HostConfig, CapDrop: [] } }, 'CapDrop'],
    [{ HostConfig: { ...goodContainer.HostConfig, SecurityOpt: [] } }, 'privileges'],
    [{ HostConfig: { ...goodContainer.HostConfig, Binds: ['/var/run/docker.sock:/var/run/docker.sock'] } }, 'docker'],
    [{ HostConfig: { ...goodContainer.HostConfig, PidsLimit: 0 } }, 'pids'],
    [{ HostConfig: { ...goodContainer.HostConfig, Memory: 0 } }, 'memory'],
    [{ HostConfig: { ...goodContainer.HostConfig, Privileged: true } }, 'privileged'],
    [{ NetworkSettings: { Networks: { a: {}, b: {} } } }, 'network']
  ])('rejects bad fixture %#', (patch, text) => {
    const bad = { ...goodContainer, ...patch, HostConfig: { ...goodContainer.HostConfig, ...(patch as {HostConfig?: object}).HostConfig } };
    expect(() => assertIsolated(bad, goodNetwork)).toThrow(KernelDenied);
    expect(() => assertIsolated(bad, goodNetwork)).toThrow(text as string);
  });
  it('rejects non-internal networks and extra members', () => {
    expect(() => assertIsolated(goodContainer, { ...goodNetwork, Internal: false })).toThrow('internal');
    expect(() => assertIsolated(goodContainer, { Internal: true, Containers: { a: { Name: 'evil' }, b: { Name: 'flt-x' }, c: { Name: 'gate' } } })).toThrow('member');
  });
});

describe('reaper reconciliation', () => {
  it('removes orphans and restarts missing running threads', () => {
    expect(reconcile([{ id: 'thr_live', state: 'running' }], [
      { id: 'c1', labels: { 'flotilla.thread': 'thr_orphan' }, state: 'running' },
      { id: 'c2', labels: { 'flotilla.thread': 'thr_live' }, state: 'exited' }
    ])).toEqual([
      { action: 'remove-orphan', containerId: 'c1', threadId: 'thr_orphan' },
      { action: 'restart', containerId: 'c2', threadId: 'thr_live' }
    ]);
  });
});

describe('pool machine limits', () => {
  const created: Docker.ContainerCreateOptions[] = [];
  const fake = { listContainers: async () => [], listNetworks: async () => [], createNetwork: async () => ({ id: 'net' }), createVolume: async () => ({}),
    createContainer: async (o: Docker.ContainerCreateOptions) => { created.push(o); return { id: 'c1', start: async () => undefined }; } } as unknown as Docker;
  it('CAPY-218: memory limit has no swap headroom and the kernel OOM killer stays on, so the largest process is killed instead of the machine freezing', async () => {
    await new DockerMachineDriver(fake).startThreadContainer({ threadId: 'thr_oom', code: 'OOM-1', image: 'img', cpus: 1, memMb: 512, env: {} });
    expect(created[0].HostConfig).toMatchObject({ Memory: 512 * 1024 * 1024, MemorySwap: 512 * 1024 * 1024, OomKillDisable: false, Init: true });
  });
  it('CAPY-219: the pool only runs Linux; macOS/iOS requests are refused and pointed at a paired device', async () => {
    expect(DockerMachineDriver.platforms).toEqual(['linux']);
    await expect(new DockerMachineDriver(fake).startThreadContainer({ threadId: 'thr_mac', code: 'MAC-1', image: 'img', cpus: 1, memMb: 512, env: {}, platform: 'macos' })).rejects.toThrow('paired device (BYOM)');
    expect(created).toHaveLength(1);
  });
});

const itDocker = process.env.FLOTILLA_DOCKER_IT === '1' ? it : it.skip;
describe('docker integration', () => {
  const docker = new Docker();
  const image = 'flotilla-thread-test';
  const driver = new DockerMachineDriver(docker);
  let gateId = '';
  beforeAll(async () => {
    if (process.env.FLOTILLA_DOCKER_IT !== '1') return;
    execFileSync('docker', ['build', '-q', '-f', 'deploy/thread.Dockerfile', '-t', image, '.'], { cwd: process.cwd().replace('/apps/server',''), stdio: 'pipe' });
    const gate = await docker.createContainer({ Image: image, Cmd: ['sleep', 'infinity'], Labels: { 'flotilla.role': 'gate' }, name: `flt-test-gate-${Date.now()}` });
    gateId = gate.id;
    await gate.start();
  }, 120_000);

  async function collect(iter: AsyncIterable<string>) { let out = ''; for await (const x of iter) out += x; return out; }
  async function execText(containerId: string, argv: string[]) {
    const h = driver.transport(containerId).spawn(argv, { cwd: '/workspace', env: {} });
    return { stdout: await collect(h.stdout), exit: await h.exit };
  }

  itDocker('hardens, isolates, cancels, copies cli home, copies files, and reaps', async () => {
    const suffix = Date.now().toString();
    const a = await driver.startThreadContainer({ threadId: `thra${suffix}`, code: `a${suffix}`, image, cpus: 0.5, memMb: 128, env: {} });
    const b = await driver.startThreadContainer({ threadId: `thrb${suffix}`, code: `b${suffix}`, image, cpus: 0.5, memMb: 128, env: {} });
    try {
      expect((await execText(a.containerId, ['id', '-u'])).stdout.trim()).not.toBe('0');
      expect((await execText(a.containerId, ['sh', '-c', 'command -v sudo || true'])).stdout.trim()).toBe('');
      expect((await execText(a.containerId, ['sh', '-c', 'test ! -e /var/run/docker.sock'])).exit.code).toBe(0);
      expect((await execText(a.containerId, ['wget', '-T', '3', '-q', '-O', '-', 'http://1.1.1.1'])).exit.code).not.toBe(0);
      expect((await execText(a.containerId, ['sh', '-c', 'getent hosts postgres || exit 9'])).exit.code).not.toBe(0);
      const hb = driver.transport(b.containerId).spawn(['sh', '-c', 'node -e "require(\\\'http\\\').createServer((q,r)=>r.end(\\\'x\\\')).listen(3000)"'], { cwd: '/workspace', env: {} });
      await new Promise((r) => setTimeout(r, 500));
      expect((await execText(a.containerId, ['sh', '-c', `wget -T 2 -q -O- http://flt-b${suffix}:3000 || exit 7`])).exit.code).not.toBe(0);
      await hb.signal('SIGKILL');
      const sleep = driver.transport(a.containerId).spawn(['sh', '-c', 'sleep 600 & sleep 600 & wait'], { cwd: '/workspace', env: {} });
      await new Promise((r) => setTimeout(r, 500));
      await sleep.signal('SIGKILL');
      await new Promise((r) => setTimeout(r, 300));
      expect((await execText(a.containerId, ['sh', '-c', 'ps -eo args | grep "[s]leep 600" || true'])).stdout).toBe('');
      const dir = mkdtempSync(join(tmpdir(), 'flt-copy-'));
      writeFileSync(join(dir, 'x'), 'copy-ok');
      const tar = execFileSync('tar', ['-C', dir, '-cf', '-', 'x']);
      await driver.copyIn(a.containerId, '/workspace', tar);
      const outTar = await driver.copyOut(a.containerId, '/workspace/x');
      expect(outTar.length).toBeGreaterThan(0);
      const userVol = `flt-user-${suffix}`; const threadVol = `flt-thread-${suffix}`;
      await docker.createVolume({ Name: userVol });
      const seed = await docker.createContainer({ Image: image, User: 'root', Cmd: ['sh','-c','mkdir -p /src/projects /src/cfg && echo secret >/src/projects/session && echo ok >/src/cfg/config'], HostConfig: { AutoRemove: true, Mounts: [{ Type: 'volume', Source: userVol, Target: '/src' }] } });
      await seed.start(); await seed.wait();
      await copyCliHome(docker, { userVolume: userVol, threadVolume: threadVol, image });
      const check = await docker.createContainer({ Image: image, Cmd: ['sh','-c','test -f /dst/cfg/config && test ! -e /dst/projects'], HostConfig: { AutoRemove: true, Mounts: [{ Type: 'volume', Source: threadVol, Target: '/dst' }] } });
      await check.start();
      expect((await check.wait()).StatusCode).toBe(0);
      const inspect = await docker.getContainer(a.containerId).inspect();
      expect(JSON.stringify(inspect.Mounts)).not.toContain(userVol);
      expect(reconcile([], [{ id: a.containerId, labels: { 'flotilla.thread': `thra${suffix}` }, state: 'running' }])[0].action).toBe('remove-orphan');
    } finally {
      await driver.remove(a.containerId); await driver.remove(b.containerId);
    }
  }, 120_000);

  afterAll(async () => {
    if (gateId) await docker.getContainer(gateId).remove({ force: true }).catch(() => undefined);
  });
});
