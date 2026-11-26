import type { CheckMonitor } from './monitor.js';
let monitor: CheckMonitor | null = null;
export function setCheckMonitor(x: CheckMonitor | null): void { monitor = x; }
export function getCheckMonitor(): CheckMonitor | null { return monitor; }
