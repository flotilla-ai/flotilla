import { createHash } from 'node:crypto';
export type ConsequentialKind = 'send' | 'publish' | 'purchase' | 'delete' | 'permission' | 'credential-entry' | 'legal-accept';
export type ActionClass = { class: 'read' } | { class: 'write-local' } | { class: 'consequential'; kind: ConsequentialKind };
export type ActionInput = { tool: string; url?: string; text?: string; fieldTypes?: string[]; method?: string };
export type ActionRules = { askFirst?: string[]; allow?: string[] };
export type GateDecision = { decision: 'allow' | 'ask' | 'deny'; reason: string; signature: string };

const patterns: Array<[ConsequentialKind, RegExp]> = [
  ['credential-entry', /password|passcode|one[- ]time|otp|2fa|totp|credential/i],
  ['purchase', /buy|place order|checkout|pay\b|submit payment|purchase/i],
  ['delete', /delete|remove|trash|destroy|erase/i],
  ['legal-accept', /accept terms|agree to|terms of service|legal accept/i],
  ['permission', /grant access|permission|authorize|allow access|confirm/i],
  ['publish', /publish|post\b|share publicly|comment\b/i],
  ['send', /send|reply|email|message|dm\b/i]
];
const hardAsk = new Set<ConsequentialKind>(['credential-entry', 'purchase', 'delete']);

export function safeActionTarget(url: string | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.username = ''; u.password = ''; u.hash = '';
    const params = new URLSearchParams();
    for (const [key, value] of u.searchParams) params.append(key, createHash('sha256').update(value).digest('hex').slice(0, 12));
    u.search = params.toString();
    return u.toString();
  } catch { return url.split(/[?#]/, 1)[0]; }
}

export function actionSignature(input: ActionInput): string {
  return [input.tool.toLowerCase(), safeActionTarget(input.url), input.text ?? '', ...(input.fieldTypes ?? [])].join('\n').toLowerCase();
}

export function classifyAction(input: ActionInput): ActionClass {
  const haystack = [input.tool, input.url ?? '', input.text ?? '', ...(input.fieldTypes ?? [])].join('\n');
  if ((input.fieldTypes ?? []).some((t) => /password|otp|totp|credential/i.test(t))) return { class: 'consequential', kind: 'credential-entry' };
  for (const [kind, re] of patterns) if (re.test(haystack)) return { class: 'consequential', kind };
  if (/(^|[.:/_-])(read|get|fetch|search|list|open|navigate|screenshot|snapshot)\b/i.test(input.tool) && /^(get|head)?$/i.test(input.method ?? 'get')) return { class: 'read' };
  return { class: 'write-local' };
}

function limited(patterns: string[] | undefined): string[] { return (patterns ?? []).filter(Boolean).slice(0, 20).map((p) => p.toLowerCase()); }
function matches(pattern: string, input: ActionInput): boolean {
  const haystack = [input.tool.toLowerCase(), input.url ?? '', input.text ?? '', ...(input.fieldTypes ?? [])].join('\n').toLowerCase();
  return pattern.split(/\s+/).filter((w) => w.length > 2).some((word) => haystack.includes(word));
}

export function decideAction(input: ActionInput, cls: ActionClass = classifyAction(input), rules: ActionRules = {}, denied = new Set<string>()): GateDecision {
  const signature = cls.class === 'consequential' ? `${cls.kind}:${actionSignature(input)}` : actionSignature(input);
  if (denied.has(signature)) return { decision: 'deny', reason: 'denied-until-next-human-message', signature };
  if (cls.class !== 'consequential') return { decision: 'allow', reason: cls.class, signature };
  if (limited(rules.askFirst).some((p) => matches(p, input))) return { decision: 'ask', reason: 'ask-first-rule', signature };
  if (!hardAsk.has(cls.kind) && limited(rules.allow).some((p) => matches(p, input))) return { decision: 'allow', reason: 'allow-rule', signature };
  return { decision: 'ask', reason: hardAsk.has(cls.kind) ? 'always-ask' : 'consequential-default', signature };
}

/** Compose a kernel decision with a hook result. Hooks may tighten but can never loosen it. */
export function tightenDecision(kernel: GateDecision, hook?: GateDecision): GateDecision {
  if (!hook) return kernel;
  const rank = { allow: 0, ask: 1, deny: 2 } as const;
  return rank[hook.decision] > rank[kernel.decision] ? { ...hook, signature: kernel.signature } : kernel;
}

export function canOfferAlwaysAllow(cls: ActionClass): boolean {
  return cls.class === 'consequential' && !hardAsk.has(cls.kind);
}
