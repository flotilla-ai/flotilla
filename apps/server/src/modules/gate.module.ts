import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
export default {
  name: 'gate',
  start() {
    if (process.env.GATE_ADMIN_TOKEN) return () => undefined;
    try {
      mkdirSync('/run/flotilla-gate', { recursive: true });
      const token = randomBytes(24).toString('base64url');
      writeFileSync('/run/flotilla-gate/token', token, { mode: 0o600 });
      process.env.GATE_ADMIN_TOKEN = token;
    } catch { /* read-only local test filesystem */ }
    return () => undefined;
  }
};
