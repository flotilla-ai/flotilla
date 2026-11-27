import { machineCore } from '../machines/machine-core.js';
import type { DockerMachineDriver } from '../machines/dockerDriver.js';
import { defaultRunner } from '../routes/threads.route.js';
import { threadLifecycle } from '../thread-lifecycle/store.js';
export default {
  name: 'runner',
  async start() {
    const runner = defaultRunner();
    const resume = async () => { try { await runner.resumePending(); } catch { /* database not ready */ } };
    void runner.recoverClaimed().catch(() => undefined).then(resume); const inbox = setInterval(resume, 2_000);
    const core = machineCore(); const driver = runner.deps.driver as unknown as DockerMachineDriver;
    core.attach({
      driver: { transport: (id) => driver.transport(id), stop: (id) => driver.stop(id), remove: (id) => driver.remove(id), deleteWorkspace: async (t) => { await driver.docker.getVolume(`flt-workspace-${t}`).remove({ force: true }); }, findContainer: async (t) => (await driver.docker.listContainers({ filters: { label: [`flotilla.thread=${t}`] } }))[0]?.Id ?? null },
      emit: async (threadId, payload) => { await runner.deps.store.appendEvents(threadId as never, [{ runId: null, kind: 'machine.state', source: 'kernel', trust: 'trusted', payload }] as never); }
    });
    threadLifecycle().onDelete((threadId) => core.prepareDestroy(threadId));
    void core.reset().catch(() => undefined);
    const timer = setInterval(() => { void core.tick().catch(() => undefined); }, 15_000);
    return async () => { clearInterval(timer); clearInterval(inbox); await runner.drain(); };
  }
};
