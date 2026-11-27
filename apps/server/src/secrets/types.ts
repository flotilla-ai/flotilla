/** Shared = project env vars; personal = the thread owner's; thread = set on thread create. */
export type SecretScope = 'project' | 'personal' | 'thread';
/** Precedence when one name is set in several scopes: thread > personal > project. */
export const scopePrecedence: readonly SecretScope[] = ['thread', 'personal', 'project'];
/** What any API or the model may see about a secret: never its value. */
export type SecretRef = { name: string; scope: SecretScope; configured: true; updatedAt: string; updatedBy: string | null };
/** A name a thread's machine receives, and the scope that won. */
export type SecretGrant = { threadId: string; name: string; scope: SecretScope; configured: true };
export type EnvVarMutation = { op: 'set'; name: string; value: string } | { op: 'delete'; name: string };
/** Decrypted values for one machine preparation; only the runner holds this. */
export type PreparedSecrets = { env: Record<string, string>; grants: SecretGrant[] };

export const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
export const MAX_VALUE_BYTES = 32 * 1024;
/** GitHub credentials stay on the server (git mirror); they are never stored here or written to a machine. */
const githubNames = new Set(['GITHUB_TOKEN', 'GH_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GITHUB_PAT']);
const githubValue = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/;
export function isGitHubCredential(name: string, value: string): boolean {
  return githubNames.has(name.toUpperCase()) || githubValue.test(value);
}
/** Names the kernel owns inside a machine (run token, egress proxy). */
export function isReservedName(name: string): boolean {
  return /^FLOTILLA_/i.test(name) || /^(HTTPS?_PROXY|NO_PROXY|ALL_PROXY)$/i.test(name);
}
