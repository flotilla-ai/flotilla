import { randomBytes } from 'node:crypto';

function attr(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch);
}

/** Wrap model-bound untrusted text in a nonce-matched fence. Embedded copies of the exact closer are stripped. */
export function fenceUntrusted(source: string, text: string, nonce = randomBytes(12).toString('base64url')): string {
  const close = `</untrusted id="${nonce}">`;
  const safe = text.split(close).join('');
  return `<untrusted source="${attr(source)}" id="${nonce}">\n${safe}\n${close}`;
}
