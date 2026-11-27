import { onBeforeRun } from '../runner/runner.js';
import { rulesBeforeRun, rulesStore } from '../rules/store.js';

/** Prepends the layered rules bundle (kernel, org, personal, project, repo, memory) to every run prompt. */
export default {
  name: 'rules',
  async start() {
    const unregister = onBeforeRun(rulesBeforeRun(() => rulesStore()));
    return async () => { unregister(); };
  }
};
