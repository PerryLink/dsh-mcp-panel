/**
 * Health-check suggestion mapping for the MCP console. Pure derivation from
 * observable facts — the upstream `mcp/status` error text (already sanitized),
 * the connection phase, the reconnect budget, and the cordis fiber phase.
 *
 * Honest boundaries, by design:
 * - The official client does not expose child-process exit codes or stderr
 *   tails yet; those fields are PROPOSED upstream (`exitCode`/`stderrTail` in
 *   `upstream.ts`, `docs/upstream-proposal.md` in deepseek-harness). Until
 *   upstream ships them the console labels them "pending upstream support"
 *   instead of inventing values.
 * - Every suggestion below is DERIVED from error-text patterns, so it is
 *   prefixed as a suggestion, never asserted as the failure cause.
 *
 * @module dsh-mcp-panel/diagnostics
 */

import type { McpFiberPhase, McpTransport } from './wire.ts'

/** Stable suggestion codes; every surface localizes them by key. */
export type McpSuggestionCode =
  | 'command-not-found'
  | 'command-spawn-failed'
  | 'connection-refused'
  | 'connection-dropped'
  | 'timeout'
  | 'dns'
  | 'auth-401'
  | 'auth-403'
  | 'path-404'
  | 'rate-limit'
  | 'permission'
  | 'reconnect-exhausted'
  | 'reconnect-waiting'
  | 'entry-failed'

/** One derived health suggestion. */
export interface McpDiagnostic {
  /** Localization code (locale keys `diag_<code>`). */
  code: McpSuggestionCode
  /** English fallback text, always renderable. */
  text: string
}

/** Observable facts the derivation reads. */
export interface McpHealthFacts {
  /** Sanitized last upstream error, or null. */
  lastError: string | null
  /** Upstream connection phase. */
  phase: 'connecting' | 'connected' | 'waiting' | 'exhausted' | 'disposed' | 'unknown'
  /** Current outage attempt (-1 = unknown). */
  attempt: number
  /** Reconnect budget (-1 = unknown). */
  maxAttempts: number
  /** Cordis fiber phase of the row. */
  fiberPhase: McpFiberPhase
  /** Declared transport. */
  transport: McpTransport
  /** Passive-probe reachability (null = never probed). */
  probeState: 'reachable' | 'unreachable' | null
  /** Whether the entry is effectively disabled. */
  enabled: boolean
}

/** Error-text patterns → suggestion code (first match wins). */
const PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly code: McpSuggestionCode; readonly text: string }> = [
  {
    pattern: /ENOENT|not recognized as (?:an internal|a cmdlet)|command not found|No such file or directory/iu,
    code: 'command-not-found',
    text: 'The configured command was not found — install the package or fix the executable path in the server config.',
  },
  { pattern: /spawn|child process|process exited/iu, code: 'command-spawn-failed', text: 'The server process failed to start or exited — check the command line, its arguments, and the server\'s own logs.' },
  { pattern: /ECONNREFUSED|connection refused/iu, code: 'connection-refused', text: 'The server refused the connection — start the server or check the host/port in the URL.' },
  { pattern: /ECONNRESET|EPIPE|socket hang up|connection reset/iu, code: 'connection-dropped', text: 'The connection dropped mid-session — the server may have crashed or restarted.' },
  { pattern: /ETIMEDOUT|timed? ?out|timeout|AbortError/iu, code: 'timeout', text: 'A request timed out — the server may be overloaded, or the URL may be wrong. Check toolCallTimeoutMs if calls are slow.' },
  { pattern: /ENOTFOUND|EAI_AGAIN|getaddrinfo|name resolution/iu, code: 'dns', text: 'The server hostname did not resolve — check the DNS name in the URL and the network.' },
  { pattern: /\b401\b|unauthorized/iu, code: 'auth-401', text: 'The server rejected the credentials (HTTP 401) — check the Authorization header or token.' },
  { pattern: /\b403\b|forbidden/iu, code: 'auth-403', text: 'The server denied access (HTTP 403) — the credential is valid but lacks permission.' },
  { pattern: /\b404\b|not found/iu, code: 'path-404', text: 'The endpoint path returned 404 — check the URL path (e.g. /mcp).' },
  { pattern: /\b429\b|rate limit/iu, code: 'rate-limit', text: 'The server rate-limited the client — wait, or reduce the reconnect/request rate.' },
  { pattern: /EACCES|EPERM|permission denied|not permitted/iu, code: 'permission', text: 'A permission error occurred — check file permissions, PATH access, and whether the command is executable.' },
]

/**
 * Derive health suggestions from observable facts. Missing facts produce an
 * empty list, never a fabricated diagnosis; when a passive probe shows the
 * endpoint unreachable that fact is stated directly.
 *
 * @param facts - the observable facts (see {@link McpHealthFacts}).
 * @returns derived suggestions in deterministic order.
 */
export function diagnoseServer(facts: McpHealthFacts): McpDiagnostic[] {
  const suggestions: McpDiagnostic[] = []
  if (facts.lastError !== null && facts.lastError !== '') {
    for (const { pattern, code, text } of PATTERNS) {
      if (pattern.test(facts.lastError)) {
        suggestions.push({ code, text })
        break
      }
    }
  }
  if (facts.phase === 'exhausted' || (facts.attempt >= 0 && facts.maxAttempts > 0 && facts.attempt >= facts.maxAttempts)) {
    suggestions.push({
      code: 'reconnect-exhausted',
      text: 'The reconnect budget is exhausted and the client has given up — fix the root cause, then reload the row (the web surface hot-reloads cordis.patch.yml edits) or restart.',
    })
  } else if (facts.phase === 'waiting') {
    suggestions.push({
      code: 'reconnect-waiting',
      text: 'The client is waiting in reconnect backoff — it will retry automatically; fix the root cause to stop the cycle.',
    })
  }
  if (facts.fiberPhase === 'failed') {
    suggestions.push({
      code: 'entry-failed',
      text: 'The cordis row failed to mount — read the loader diagnostics, then fix the row and reload.',
    })
  }
  if (facts.probeState === 'unreachable') {
    suggestions.push({
      code: 'connection-refused',
      text: 'The last connectivity probe could not reach the endpoint — the server may be down or the URL wrong.',
    })
  }
  return suggestions
}
