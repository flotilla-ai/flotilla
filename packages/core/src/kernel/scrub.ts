const REDACTED_PATTERN = '[REDACTED:pattern]';

const patterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-proj-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgho_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
];

function knownSecrets(secrets: Record<string, string>): { name: string; value: string }[] {
  return Object.entries(secrets)
    .filter(([, value]) => value.length >= 8)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value.length - a.value.length);
}

function replaceBase64Forms(input: string, secret: string, replacement: string): string {
  const token = /[A-Za-z0-9+/]{8,}={0,2}/g;
  return input.replace(token, (candidate) => {
    try {
      const decoded = Buffer.from(candidate, 'base64');
      if (decoded.includes(Buffer.from(secret))) return replacement;
    } catch {
      // not valid base64 for this check
    }
    return candidate;
  });
}

export function scrubString(input: string, secrets: Record<string, string>): string {
  let out = input;
  for (const { name, value } of knownSecrets(secrets)) {
    const replacement = `[REDACTED:${name}]`;
    out = out.split(value).join(replacement);
    out = out.split(encodeURIComponent(value)).join(replacement);
    out = replaceBase64Forms(out, value, replacement);
  }
  for (const pattern of patterns) out = out.replace(pattern, REDACTED_PATTERN);
  return out;
}

export function scrub(payload: unknown, secrets: Record<string, string>): unknown {
  if (typeof payload === 'string') return scrubString(payload, secrets);
  if (Array.isArray(payload)) return payload.map((item) => scrub(item, secrets));
  if (payload !== null && typeof payload === 'object') {
    return Object.fromEntries(Object.entries(payload as Record<string, unknown>).map(([key, value]) => [key, scrub(value, secrets)]));
  }
  return payload;
}

export function createDeltaScrubber(secrets: Record<string, string>): { push(chunk: string): string; flush(): string } {
  const longestKnown = Math.max(0, ...Object.values(secrets).map((s) => s.length));
  const holdback = Math.max(127, longestKnown - 1);
  let buffer = '';
  return {
    push(chunk: string): string {
      buffer += chunk;
      if (buffer.length <= holdback) return '';
      const emit = buffer.slice(0, buffer.length - holdback);
      buffer = buffer.slice(buffer.length - holdback);
      return scrubString(emit, secrets);
    },
    flush(): string {
      const out = scrubString(buffer, secrets);
      buffer = '';
      return out;
    }
  };
}
