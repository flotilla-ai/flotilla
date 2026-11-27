import { onAfterRun } from '../runner/runner.js';
import { snapshotStore, type SnapshotDriver } from '../snapshots/store.js';

/** Hourly rebuild check: a completed run on a project with snapshots enabled may capture its machine as the project image. */
export default {
  name: 'snapshots',
  async start() {
    const unregister = onAfterRun(async ({ thread, project, state, containerId, driver }) => {
      if (state !== 'completed' || !('docker' in driver) || !('transport' in driver)) return;
      await snapshotStore().afterRun({ thread: thread as never, project, containerId, driver: driver as unknown as SnapshotDriver }).catch((err) => console.warn('snapshots build', (err as Error).message));
    });
    return async () => { unregister(); };
  }
};
