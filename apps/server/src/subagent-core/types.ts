import type { Thread, ThreadId } from '@flotilla/core/types';

/** Kernel depth limit: a root thread's subagents are level 1; 'Subagent 1.3.2' is level 3 and cannot nest further. */
export const SUBAGENT_MAX_DEPTH = 3;
export type SubagentState = 'draft' | 'working' | 'waiting' | 'idle' | 'done' | 'failed';
/** shared = reads the parent's workspace read-only; fresh = own container, volume and branch (writers). */
export type SubagentPlacement = 'shared' | 'fresh';
/** parallel = from the project base, claimed paths must be disjoint; stacked = branches from the previous sibling's branch. */
export type SubagentMode = 'parallel' | 'stacked';
/** The child's cap is a slice of what the parent has left after earlier slices; never more. */
export interface SubagentBudget { requestedUsd: number | null; grantedUsd: number | null }
export interface Subagent {
  id: ThreadId; parentId: ThreadId; address: string; label: string; depth: number;
  title: string; prompt: string; state: SubagentState; placement: SubagentPlacement; mode: SubagentMode;
  paths: string[]; stackedOn: ThreadId | null; baseBranch: string | null; branch: string | null;
  engine: Thread['engine']; budget: SubagentBudget; summary: string | null; question: string | null;
  createdAt: string; startedAt: string | null;
}
export interface SubagentDraft {
  title: string; prompt: string; placement: SubagentPlacement; mode?: SubagentMode; paths?: string[];
  engine?: Partial<Thread['engine']>; maxUsd?: number | null;
}
export interface SubagentProgress { subagent: Subagent; text: string; tools: string[] }
export interface SubagentDiff { branch: string; base: string; patch: string }
