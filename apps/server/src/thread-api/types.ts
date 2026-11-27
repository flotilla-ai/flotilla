import type { ThreadId } from '@flotilla/core/types';
import type { ThreadAction, ThreadLifecycle } from '../thread-lifecycle/types.js';

/** Shared thread state changes; each emits a `thread.status` event (public frame `status`). */
export type ThreadMutation = Extract<ThreadAction, { action: 'rename' | 'archive' | 'unarchive' | 'takeover' | 'regenerate-title' }>;
/** Viewer membership changes; join and leave emit `thread.status`, subscribe/unsubscribe are per-viewer only. */
export type ThreadMembershipMutation = Extract<ThreadAction, { action: 'join' | 'leave' | 'subscribe' | 'unsubscribe' }>;
/** One viewer's read state, returned by `POST /threads/:id/read|unread`; never streamed to other viewers. */
export interface ThreadReadState { threadId: ThreadId; unread: boolean; unreadCount: number; mentions: number; lastReadSeq: number; markedUnread: boolean }

export const THREAD_VERBS = ['archive', 'unarchive', 'takeover', 'regenerate-title', 'join', 'leave', 'subscribe', 'unsubscribe'] as const satisfies readonly (ThreadMutation | ThreadMembershipMutation)['action'][];

export const toReadState = (v: ThreadLifecycle): ThreadReadState => ({
  threadId: v.id, unread: v.unread, unreadCount: v.unreadCount, mentions: v.mentions, lastReadSeq: v.member?.lastReadSeq ?? 0, markedUnread: v.member?.markedUnread ?? false
});
