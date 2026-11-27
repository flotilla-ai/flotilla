import { readFileSync } from 'node:fs';
import type { AgentAdapterManifest } from '@flotilla/core/types';
import { ApiFailure } from '../api-platform/types.js';
import { reasoningEfforts, type AccessCheck, type ModelCatalogEntry, type Provider, type ReasoningEffort } from './types.js';

/** Built-in free models (the fake adapter). Real vendor rows and list prices come from the operator's `FLOTILLA_MODEL_CATALOG` file. */
const builtIn: ModelCatalogEntry[] = [
  { adapter: 'fake', model: 'fake-small', displayName: 'Fake small', provider: 'flotilla', listPrice: { inputMicroUsdPerMTok: 0, outputMicroUsdPerMTok: 0 }, byok: false, zdr: true, free: true, efforts: ['none', 'low', 'medium', 'high'] },
  { adapter: 'fake', model: 'fake-large', displayName: 'Fake large', provider: 'flotilla', listPrice: { inputMicroUsdPerMTok: 0, outputMicroUsdPerMTok: 0 }, byok: false, zdr: true, free: true, efforts: [...reasoningEfforts] }
];
export const FREE_CONNECTION = { id: 'free', adapter: 'fake', label: 'Flotilla free models' } as const;

export type Catalog = { models: ModelCatalogEntry[]; providers: Provider[] };
/** `{ models?: ModelCatalogEntry[], providers?: Provider[] }` (gateways/coding plans the operator configures). */
export function loadCatalog(manifests: AgentAdapterManifest[], env: NodeJS.ProcessEnv = process.env): Catalog {
  const file = env.FLOTILLA_MODEL_CATALOG ? JSON.parse(readFileSync(env.FLOTILLA_MODEL_CATALOG, 'utf8')) as Partial<Catalog> : {};
  const models = [...builtIn, ...(file.models ?? [])];
  for (const m of models) if (m.efforts.some((e) => !reasoningEfforts.includes(e))) throw new Error(`model catalog: ${m.adapter}:${m.model} has an unknown effort`);
  return { models, providers: [...providersFrom(manifests), ...(file.providers ?? [])] };
}

/** One provider per adapter auth method: vendor-login = subscription (device/browser login inside the CLI), api-key = key provider. */
export function providersFrom(manifests: AgentAdapterManifest[]): Provider[] {
  const out: Provider[] = [];
  for (const m of manifests) for (const auth of m.auth) {
    if (auth.kind === 'vendor-login') out.push({ id: `${m.id}-subscription`, name: `${m.displayName} subscription`, kind: 'subscription', adapter: m.id, auth, baseUrl: null, discovery: 'catalog' });
    if (auth.kind === 'api-key') out.push({ id: `${m.id}-api-key`, name: `${m.displayName} API key`, kind: 'api-key', adapter: m.id, auth, baseUrl: null, discovery: 'catalog' });
  }
  out.push({ id: 'custom-openai', name: 'Custom OpenAI-compatible endpoint', kind: 'custom', adapter: null, auth: { kind: 'api-key', envVar: '' }, baseUrl: null, discovery: 'openai-models' });
  return out;
}

export function parseEffort(raw: unknown): ReasoningEffort | null {
  if (raw === undefined || raw === null) return null;
  if (!reasoningEfforts.includes(raw as ReasoningEffort)) throw new ApiFailure('ValidationFailed', `effort must be one of ${reasoningEfforts.join(', ')}`);
  return raw as ReasoningEffort;
}

/** Lists what a connection would offer, without persisting anything. Subscriptions cannot be listed offline: the CLI owns the login. */
export async function checkAccess(provider: Provider, input: { apiKey: string | null; baseUrl: string | null }, catalog: Catalog, fetchImpl: typeof fetch = fetch): Promise<AccessCheck> {
  const adapterModels = catalog.models.filter((m) => m.adapter === provider.adapter).map((m) => m.model);
  if (provider.kind === 'subscription') return { status: 'needs-login', models: adapterModels, loginCommand: provider.auth.kind === 'vendor-login' ? provider.auth.command : null, error: null };
  if (!input.apiKey) throw new ApiFailure('ValidationFailed', `${provider.name} needs an apiKey`);
  if (provider.discovery === 'catalog') return { status: 'connected', models: adapterModels, loginCommand: null, error: null };
  const base = input.baseUrl ?? provider.baseUrl;
  if (!base || !/^https?:\/\//.test(base)) throw new ApiFailure('ValidationFailed', 'baseUrl must be an http(s) URL');
  try {
    const res = await fetchImpl(`${base.replace(/\/+$/, '')}/models`, { headers: { authorization: `Bearer ${input.apiKey}` }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { status: 'failed', models: [], loginCommand: null, error: `HTTP ${res.status}` };
    const body = await res.json() as { data?: { id?: unknown }[] };
    return { status: 'connected', models: [...new Set((body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string'))], loginCommand: null, error: null };
  } catch (err) {
    return { status: 'failed', models: [], loginCommand: null, error: (err as Error).name === 'TimeoutError' ? 'timeout' : 'unreachable' };
  }
}
