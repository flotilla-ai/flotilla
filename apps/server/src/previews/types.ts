export type PreviewAccess = 'private' | 'shared';
export type PreviewStatus = 'live' | 'asleep' | 'starting' | 'not-listening';
export type Preview = {
  threadId: string; code: string; port: number; hostname: string | null; startCommand: string | null;
  access: PreviewAccess; shareUntil: string | null; awakeUntil: string | null;
  url: string; localUrl: string;
};
export type PreviewShare = { url: string; expiresAt: string };
export type PreviewMachine = {
  state(code: string): Promise<'awake' | 'asleep'>;
  listening(code: string): Promise<number[]>;
  run(code: string, command: string): Promise<void>;
};
// Flotilla's own control-plane ports (gate proxy/admin, UI/API, preview origin, tools listener) are never exposed as previews.
export const RESERVED_PORTS = [3128, 3129, 8080, 8081, 8082] as const;
export const KEEP_AWAKE_MS = 5 * 60_000;
export const MAX_AWAKE_MS = 4 * 60 * 60_000;
