import type { AdapterId, AuthMethod } from '@flotilla/core/types';

export const reasoningEfforts = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = (typeof reasoningEfforts)[number];
/** Capy's gateways/coding plans are operator-supplied providers of kind `gateway`; `custom` is any OpenAI-compatible endpoint. */
export type ConnectionKind = 'subscription' | 'gateway' | 'api-key' | 'custom';
/** Capy credits have no self-hosted equivalent: the last stop in connection order is Flotilla's free models. */
export type ModelBadge = 'subscription' | 'key' | 'free';
/** `openai-models` = `GET <baseUrl>/models`; `catalog` = the adapter's catalog rows (vendor CLIs list nothing offline). */
export type Discovery = 'openai-models' | 'catalog';
export type Provider = { id: string; name: string; kind: ConnectionKind; adapter: AdapterId | null; auth: AuthMethod; baseUrl: string | null; discovery: Discovery };
export type ListPrice = { inputMicroUsdPerMTok: number; outputMicroUsdPerMTok: number };
export type ModelCatalogEntry = { adapter: AdapterId; model: string; displayName: string; provider: string; listPrice: ListPrice | null; byok: boolean; zdr: boolean; free: boolean; efforts: ReasoningEffort[] };
export type ConnectionStatus = 'connected' | 'needs-login' | 'failed';
export type Connection = {
  id: string; scope: 'user' | 'org' | 'free'; provider: string; kind: ConnectionKind | 'free'; adapter: AdapterId; label: string; position: number;
  enabled: boolean; status: ConnectionStatus; baseUrl: string | null; hasKey: boolean; loginCommand: string[] | null;
  /** (available ∪ custom) − excluded: newly listed models are covered automatically. */
  models: string[]; availableModels: string[]; excludedModels: string[]; customModels: string[]; checkedAt: string | null;
};
/** Flotilla model choice = adapter + model id (+ effort), optionally pinned to one connection. */
export type ModelSelection = { adapter: AdapterId; model: string | null; effort: ReasoningEffort | null; connectionId: string | null };
export type ResolvedSelection = ModelSelection & { connectionId: string; badge: ModelBadge; connectionLabel: string };
export type AccessCheck = { status: ConnectionStatus; models: string[]; loginCommand: string[] | null; error: string | null };
export type PickerItem = { key: string; adapter: AdapterId; model: string; displayName: string; efforts: ReasoningEffort[]; badge: ModelBadge; connectionId: string; tooltip: string; favorite: number | null; shortcut: string | null };
