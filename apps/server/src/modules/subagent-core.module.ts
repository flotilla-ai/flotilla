import { subagentCore } from '../subagent-core/store.js';

export default {
  name: 'subagent-core',
  async start() {
    const uninstall = subagentCore().install();
    return async () => uninstall();
  }
};
