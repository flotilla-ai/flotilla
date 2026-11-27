/** Events that can wake a thread; each has a per-user/org response. */
export type WakeEventKind = 'review' | 'comment' | 'merge' | 'conflict' | 'agent' | 'thread-message' | 'timer' | 'job';
export type WakeResponse = 'react' | 'context' | 'ignore';
/** React = start a turn; context = keep for the next turn; ignore = drop. Personal settings override org field by field. */
export interface EventResponsePolicy { responses: Record<WakeEventKind, WakeResponse>; bots: string[]; allowBots: string[]; mergeWindowDays: number }
export type WakeSettingsPatch = Partial<Omit<EventResponsePolicy, 'responses'>> & { responses?: Partial<EventResponsePolicy['responses']> };
export type WatchKind = 'timer' | 'pr' | 'thread' | 'job';
/** Anything a thread is waiting on: a PR, another thread, a background job. Timers are subscriptions with `fireAt`. */
export interface WakeSubscription { id: string; threadId: string; kind: WatchKind; target: string; label: string; url: string | null; fireAt: string | null; state: 'active' | 'fired' | 'stopped'; payload: Record<string, unknown>; createdAt: string }
export type WakeTimer = WakeSubscription & { kind: 'timer'; fireAt: string };
export interface WaitState { threadId: string; waiting: boolean; label: string | null; href: string | null; watches: WakeSubscription[] }
export type WakeOutcome = 'woken' | 'context' | 'held' | 'ignored' | 'capped';
export interface WakeFrom { userId: string | null; threadId?: string | null }
export interface BackgroundJobSpec { kind: 'command' | 'transfer'; argv: string[]; timeoutSec?: number; maxUsd?: number | null; label?: string }
export interface JobResult { code: number | null; output: string }
export type JobExecutor = (threadId: string, spec: BackgroundJobSpec, signal: AbortSignal) => Promise<JobResult>;
export interface ThreadPeek { thread: { id: string; code: string; title: string; status: string }; prs: { repo: string; number: number }[]; history: { seq: number; kind: string; text: string; at: string }[]; fileId?: string }

export const WAKE_KINDS: WakeEventKind[] = ['review', 'comment', 'merge', 'conflict', 'agent', 'thread-message', 'timer', 'job'];
export const DEFAULT_POLICY: EventResponsePolicy = { responses: Object.fromEntries(WAKE_KINDS.map((k) => [k, 'react'])) as EventResponsePolicy['responses'], bots: [], allowBots: [], mergeWindowDays: 3 };
export const TIMER_MAX_SEC = 7 * 24 * 3600;
export const JOB_DEFAULT_SEC = 30 * 60;
export const JOB_MAX_SEC = 6 * 3600;
