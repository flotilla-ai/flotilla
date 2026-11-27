import type { CostTotals, ThreadId, ThreadStatus, UserId } from '@flotilla/core/types';

export const TITLE_MAX = 50;
export type Visibility = 'private' | 'shared';
export type RegenerateWhen = 'never' | 'first-message' | 'each-message';
export type TitleGenerator = (input: { messages: string[]; instructions: string[] }) => Promise<string>;

/** One viewer's projection of a thread: shared lifecycle state plus that viewer's membership and read state. */
export interface ThreadLifecycle {
  id: ThreadId; code: string; title: string; titleSource: 'auto' | 'user'; status: ThreadStatus;
  ownerId: UserId; visibility: Visibility; archivedAt: string | null; pinned: boolean; tags: string[]; folder: string | null;
  member: ThreadMember | null; unread: boolean; unreadCount: number; mentions: number;
}
export interface ThreadMember { userId: UserId; joined: boolean; subscribed: boolean; lastReadSeq: number; markedUnread: boolean }
export interface OwnershipTransfer { threadId: ThreadId; from: UserId; to: UserId; via: 'takeover' | 'transfer' }
export type ThreadAction =
  | { action: 'rename'; title: string } | { action: 'regenerate-title' }
  | { action: 'archive' } | { action: 'unarchive' } | { action: 'delete' }
  | { action: 'read' } | { action: 'unread' }
  | { action: 'join' } | { action: 'leave' } | { action: 'subscribe' } | { action: 'unsubscribe' }
  | { action: 'takeover' } | { action: 'transfer'; toUserId: string } | { action: 'visibility'; visibility: Visibility }
  | { action: 'pin' } | { action: 'unpin' } | { action: 'tag'; tag: string } | { action: 'untag'; tag: string } | { action: 'file'; folder: string | null };
export const BULK_ACTIONS = ['archive', 'unarchive', 'delete', 'read', 'unread', 'pin', 'unpin', 'tag', 'untag', 'file'] as const;
export type BulkThreadAction = { threadIds: string[] } & Extract<ThreadAction, { action: (typeof BULK_ACTIONS)[number] }>;
export interface ThreadSettings { titleInstructions: string; regenerateWhen: RegenerateWhen | null; autoArchiveDays: number | null }
export interface ThreadCost {
  threadId: ThreadId; total: CostTotals;
  byKind: { input: number; output: number; cache: number };
  byModel: { model: string | null; inputTokens: number; outputTokens: number; cacheTokens: number; usd: number }[];
  byMachine: { machineId: string | null; machineSec: number; usd: number }[];
}
