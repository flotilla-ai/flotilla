import { onAfterRun, onBeforeRun } from '../runner/runner.js';
import { driveStore } from '../drive-core/store.js';

/** Drive is copied onto the thread machine before each run and the thread's edits are saved after it. */
export default {
  name: 'drive-core',
  async start() {
    const before = onBeforeRun((ctx) => driveStore().mount(ctx));
    const after = onAfterRun(async (ctx) => { await driveStore().writeBack(ctx); });
    return async () => { before(); after(); };
  }
};
