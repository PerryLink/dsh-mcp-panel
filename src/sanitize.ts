/**
 * Display sanitization for MCP panel surfaces. Everything the panel shows —
 * the `/mcp` command output, the web settings tab, probe job details — passes
 * through these pure functions so URL query-string credentials, userinfo
 * passwords, header values, and bearer tokens never reach a display.
 *
 * The panel never shows configured `headers` at all (they are dropped at
 * snapshot assembly); this module redacts what can still leak through target
 * URLs and error text.
 *
 * @module dsh-mcp-panel/sanitize
 */

/** Replacement for every redacted credential value. */
export const REDACTED = '***'

/** Query/field keys whose values are credentials regardless of their name casing. */
const CREDENTIAL_KEY = /^(?:access[_-]?token|api[_-]?key|apikey|auth|authorization|client[_-]?secret|key|password|passwd|pwd|secret|sig|signature|token)$/iu

/** Credential keys for the unparseable-URL fallback and embedded-text scans. */
const CREDENTIAL_KEY_SOURCE = '(?:access[_-]?token|api[_-]?key|apikey|auth(?:orization)?|client[_-]?secret|key|passw(?:or)?d|passwd|pwd|secret|sig(?:nature)?|token)'

/** Whole userinfo before `@` (unparseable URLs only — parsed URLs redact just the password). */
const USERINFO = /([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/giu

/** `?key=value` / `&key=value` credential pairs inside arbitrary text. */
const QUERY_CREDENTIAL = new RegExp(`([?&](?:[^=&#\\s]*${CREDENTIAL_KEY_SOURCE}[^=&#\\s]*)=)[^&#\\s]*`, 'giu')

/** `Authorization: <value>`-style header lines in arbitrary text (quoted value first). */
const HEADER_CREDENTIAL_QUOTED = new RegExp(`(\\b${CREDENTIAL_KEY_SOURCE}\\s*[:=]\\s*["'])[^"']*(["'])`, 'giu')

/** `Authorization: <value>`-style header lines with unquoted values. */
const HEADER_CREDENTIAL_BARE = new RegExp(`(\\b${CREDENTIAL_KEY_SOURCE}\\s*[:=]\\s*)[^\\s,;)\\]}]+`, 'giu')

/** Environment-variable-shaped credentials (`GITHUB_TOKEN=…`) in spawn errors. */
const ENV_VAR_CREDENTIAL = /\b[A-Za-z0-9_]*(?:TOKEN|API[_-]?KEY|SECRET|PASSWORD|PASSWD)[A-Za-z0-9_]*\s*=\s*[^\s,;)\]}]+/gu

/** Bearer tokens, including the `Bearer ` keyword and the token itself. */
const BEARER = /(bearer)\s+[A-Za-z0-9._~+/=-]+/giu

/** Quoted JSON-ish `"token": "value"` pairs in arbitrary text. */
const QUOTED_CREDENTIAL = new RegExp(`(["'](?:access[_-]?token|api[_-]?key|client[_-]?secret|secret|token)["']\\s*[:=]\\s*["'])[^"']*(["'])`, 'giu')

/** Raw JWT bodies, wherever they appear. */
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/gu

/**
 * Redact a URL for display: userinfo password and credential query values.
 * Query keys are read through `URLSearchParams`, so percent-encoded key names
 * are decoded before matching. Unparseable inputs fall back to pattern
 * redaction (whole userinfo and credential query pairs) instead of throwing.
 *
 * @param url - candidate URL text.
 * @returns display-safe URL text.
 */
export function sanitizeUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
      .replace(USERINFO, '$1***@')
      .replace(QUERY_CREDENTIAL, `$1${REDACTED}`)
  }
  if (parsed.password !== '') parsed.password = REDACTED
  for (const key of [...parsed.searchParams.keys()]) {
    if (CREDENTIAL_KEY.test(key)) parsed.searchParams.set(key, REDACTED)
  }
  return parsed.toString()
}

/**
 * Redact credential-shaped fragments from free text: header lines, bearer
 * tokens, raw JWTs, embedded query pairs, and quoted token values.
 *
 * @param text - candidate display text.
 * @returns display-safe text.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(HEADER_CREDENTIAL_QUOTED, `$1${REDACTED}$2`)
    .replace(HEADER_CREDENTIAL_BARE, `$1${REDACTED}`)
    .replace(ENV_VAR_CREDENTIAL, value => {
      const equals = value.indexOf('=')
      return equals < 0 ? value : `${value.slice(0, equals)}=${REDACTED}`
    })
    .replace(QUOTED_CREDENTIAL, `$1${REDACTED}$2`)
    .replace(QUERY_CREDENTIAL, `$1${REDACTED}`)
    .replace(JWT, REDACTED)
}

/**
 * Stringify an arbitrary thrown value safely and redact it for display.
 * Never throws: unrenderable values degrade to a fixed marker.
 *
 * @param error - thrown value from a connection attempt, probe, or sync.
 * @returns display-safe error text.
 */
export function sanitizeError(error: unknown): string {
  let text: string
  try {
    text = typeof error === 'string' ? error : String(error)
  } catch {
    text = '<unrenderable error>'
  }
  return sanitizeText(text)
}
