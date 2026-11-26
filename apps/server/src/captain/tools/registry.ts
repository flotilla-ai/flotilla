import type { RunTokenService } from './tokens.js';
let service: RunTokenService | null = null;
export function setRunTokenService(x: RunTokenService | null): void { service = x; }
export function getRunTokenService(): RunTokenService | null { return service; }
