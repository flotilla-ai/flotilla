import { onBeforePrompt } from '../runner/runner.js';
import { skillStore } from '../skills/store.js';

/** Mounts loaded skills into each run's machine and expands $/ /@/plain-word invocations in the prompt. */
export default {
  name: 'skills',
  async start() {
    const unregister = onBeforePrompt((input) => skillStore().prepareRun(input));
    return async () => { unregister(); };
  }
};
