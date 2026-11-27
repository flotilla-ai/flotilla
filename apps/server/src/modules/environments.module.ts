import { onAfterRun } from '../runner/runner.js';
import { environmentStore } from '../environments/store.js';

/** A run that commits `.flotilla/setup.json` or `.capy/setup.json` updates the project's environment history. */
export default {
  name: 'environments',
  async start() {
    const unregister = onAfterRun(async ({ thread, state, containerId, driver }) => {
      if (state !== 'completed' || !('copyOut' in driver)) return;
      await environmentStore().importFromMachine({ thread: thread as never, containerId, driver: driver as never }).catch((err) => console.warn('environments import', (err as Error).message));
    });
    return async () => { unregister(); };
  }
};
