/**
 * Profile-patch fragment generation for the MCP server CRUD console.
 *
 * The console NEVER rewrites the profile's patch file: every edit is rendered
 * as one append-only loader patch OPERATION in the same vocabulary the
 * existing enable/disable suggestions use (`insert` for add, `set` for edit,
 * `set … disabled: true` for delete — the harness patch vocabulary has no
 * remove, so disabling a row IS the canonical removal). Appending keeps user
 * comments and unrelated rows byte-for-byte untouched; the Loader applies
 * later operations over earlier ones.
 *
 * Security rules enforced here:
 * - configured `env`/`headers` VALUES never enter a snapshot: the editor sees
 *   keys only, and `keepEnv`/`keepHeaders` lists make "unchanged" explicit —
 *   the host re-merges raw values from the row it already owns.
 * - generated fragments carry plain string values only: no `!!js` expression
 *   is ever synthesized (users hand-edit those afterwards if they want one).
 * - every config is validated against the official client's schema face
 *   before a fragment is rendered.
 *
 * Pure module: no I/O, no registry reads.
 *
 * @module dsh-mcp-panel/patch
 */

import { z } from 'zod'
import type { McpServerConfigView } from './wire.ts'

/** The official bridge module every generated row names. */
export const MCP_CLIENT_MODULE = '@deepseek-ai/dsh-mcp-client'

/** The official client's `serverName` contract: `[A-Za-z0-9_-]{1,32}`. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/u

/** Wire-shaped complete server config the editor submits (JSON only). */
export interface McpServerConfigInput {
  /** Stable local namespace for model-facing tool names. */
  serverName: string
  /** Declared transport. */
  transport: 'stdio' | 'streamable-http'
  /** stdio: executable to spawn. */
  command?: string
  /** stdio: arguments passed directly, without shell interpolation. */
  args?: string[]
  /** stdio: working directory for the child process. */
  cwd?: string
  /** http: MCP endpoint URL. */
  url?: string
  /** Per-tool-call timeout in milliseconds. */
  toolCallTimeoutMs?: number
  /** Fail plugin activation when initial connect/sync fails. */
  failOnStartupError?: boolean
  /** Whether automatic reconnect is enabled. */
  reconnectEnabled?: boolean
  /** Consecutive failed attempts per outage before giving up. */
  reconnectMaxAttempts?: number
  /** env entries to ADD or REPLACE (values are written literally). */
  env?: Record<string, string>
  /** env keys whose raw values must be preserved from the existing row. */
  keepEnv?: string[]
  /** header entries to ADD or REPLACE (values are written literally). */
  headers?: Record<string, string>
  /** header keys whose raw values must be preserved from the existing row. */
  keepHeaders?: string[]
}

/** One CRUD operation the console renders or writes. */
export type McpPatchOp =
  | { readonly kind: 'add'; readonly config: McpServerConfigInput }
  | { readonly kind: 'edit'; readonly entryId: string; readonly config: McpServerConfigInput }
  | { readonly kind: 'disable'; readonly entryId: string; readonly serverName: string }
  | { readonly kind: 'enable'; readonly entryId: string }

/** One validation error, code + human text (client localizes the code). */
export interface McpConfigIssue {
  /** Stable error code (locale keys derive from it). */
  code: 'serverName-required' | 'serverName-format' | 'transport-required' | 'transport-unknown' | 'command-required' | 'url-required' | 'url-invalid' | 'timeout-invalid' | 'reconnect-invalid' | 'env-key-invalid' | 'header-key-invalid' | 'config-malformed'
  /** English explanation (fallback text on every surface). */
  text: string
}

/** Validation outcome: the normalized config or the first issues. */
export type McpConfigValidation =
  | { readonly ok: true; readonly config: McpServerConfigInput }
  | { readonly ok: false; readonly issues: readonly McpConfigIssue[] }

/**
 * Validate one editor submission against the official client's config face.
 * Malformed input (wrong types) and contract violations return issue codes
 * instead of throwing — the editor renders them next to the offending field.
 *
 * @param input - raw JSON from the client (untrusted).
 * @returns the validation outcome.
 */
export function validateServerConfig(input: unknown): McpConfigValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ code: 'config-malformed', text: 'Server config must be a JSON object.' }] }
  }
  const value = input as Record<string, unknown>
  const issues: McpConfigIssue[] = []
  const serverName = typeof value['serverName'] === 'string' ? value['serverName'] : ''
  if (serverName === '') issues.push({ code: 'serverName-required', text: 'serverName is required.' })
  else if (!SERVER_NAME_PATTERN.test(serverName)) {
    issues.push({ code: 'serverName-format', text: 'serverName must match [A-Za-z0-9_-]{1,32}.' })
  }
  const transport = value['transport']
  if (transport !== 'stdio' && transport !== 'streamable-http') {
    issues.push({ code: transport === undefined ? 'transport-required' : 'transport-unknown', text: 'transport must be "stdio" or "streamable-http".' })
  }
  if (transport === 'stdio' && (typeof value['command'] !== 'string' || value['command'].trim() === '')) {
    issues.push({ code: 'command-required', text: 'stdio servers require a command.' })
  }
  if (transport === 'streamable-http') {
    const url = value['url']
    if (typeof url !== 'string' || url === '') {
      issues.push({ code: 'url-required', text: 'streamable-http servers require a URL.' })
    } else {
      try {
        new URL(url)
      } catch {
        issues.push({ code: 'url-invalid', text: 'url must be an absolute URL.' })
      }
    }
  }
  const timeout = value['toolCallTimeoutMs']
  if (timeout !== undefined && (!Number.isInteger(timeout) || (timeout as number) < 1)) {
    issues.push({ code: 'timeout-invalid', text: 'toolCallTimeoutMs must be a positive integer.' })
  }
  const reconnectAttempts = value['reconnectMaxAttempts']
  if (reconnectAttempts !== undefined && (!Number.isInteger(reconnectAttempts) || (reconnectAttempts as number) < 1)) {
    issues.push({ code: 'reconnect-invalid', text: 'reconnectMaxAttempts must be a positive integer.' })
  }
  const checkMap = (candidate: unknown, code: 'env-key-invalid' | 'header-key-invalid', label: string): void => {
    if (candidate === undefined) return
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      issues.push({ code, text: `${label} must be a string map.` })
      return
    }
    for (const [key, entryValue] of Object.entries(candidate as Record<string, unknown>)) {
      if (key.trim() === '' || typeof entryValue !== 'string') {
        issues.push({ code, text: `${label} keys must be non-empty and values must be strings.` })
        return
      }
    }
  }
  checkMap(value['env'], 'env-key-invalid', 'env')
  checkMap(value['headers'], 'header-key-invalid', 'headers')
  if (issues.length > 0) return { ok: false, issues }
  const checkedTransport = transport as 'stdio' | 'streamable-http'
  return {
    ok: true,
    config: {
      serverName,
      transport: checkedTransport,
      ...typeof value['command'] === 'string' && value['command'] !== '' ? { command: value['command'] } : {},
      ...Array.isArray(value['args']) ? { args: value['args'].filter((entry): entry is string => typeof entry === 'string') } : {},
      ...typeof value['cwd'] === 'string' && value['cwd'] !== '' ? { cwd: value['cwd'] } : {},
      ...checkedTransport === 'streamable-http' && typeof value['url'] === 'string' ? { url: value['url'] } : {},
      ...Number.isInteger(timeout) && (timeout as number) > 0 ? { toolCallTimeoutMs: timeout as number } : {},
      ...value['failOnStartupError'] === true ? { failOnStartupError: true } : {},
      ...value['reconnectEnabled'] === false ? { reconnectEnabled: false } : {},
      ...Number.isInteger(reconnectAttempts) && (reconnectAttempts as number) > 0 ? { reconnectMaxAttempts: reconnectAttempts as number } : {},
      ...typeof value['env'] === 'object' && value['env'] !== null ? { env: value['env'] as Record<string, string> } : {},
      ...Array.isArray(value['keepEnv']) ? { keepEnv: value['keepEnv'].filter((entry): entry is string => typeof entry === 'string') } : {},
      ...typeof value['headers'] === 'object' && value['headers'] !== null ? { headers: value['headers'] as Record<string, string> } : {},
      ...Array.isArray(value['keepHeaders']) ? { keepHeaders: value['keepHeaders'].filter((entry): entry is string => typeof entry === 'string') } : {},
    },
  }
}

/** Read a raw string-map field from serialized loader config (never evaluates `!!js`). */
function rawStringMap(config: unknown, key: string): Record<string, string> {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return {}
  const value = (config as Record<string, unknown>)[key]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') result[name] = entry
  }
  return result
}

/** Read a raw string field from serialized loader config. */
function rawString(config: unknown, key: string): string | undefined {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return undefined
  const value = (config as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Merge one editor submission over the existing row's RAW config for a `set`
 * patch. Non-secret fields that still equal the sanitized DISPLAY view are
 * "unchanged" and keep the raw value (so a redacted URL or credential-bearing
 * value never round-trips); changed fields take the editor's value. env and
 * headers merge key-wise: `keepEnv`/`keepHeaders` preserve raw values, listed
 * entries replace or add, and unlisted raw keys are DROPPED (deleted by the
 * user).
 *
 * @param raw - the row's serialized config (host-owned, never displayed).
 * @param input - the validated editor submission.
 * @param view - the sanitized display view the editor initialized from.
 * @returns the merged config ready for emission.
 */
export function mergeServerConfig(raw: unknown, input: McpServerConfigInput, view: McpServerConfigView): Record<string, unknown> {
  const unchanged = (editorValue: unknown, displayValue: unknown): boolean => {
    if (editorValue === undefined) return true
    if (displayValue === null) return false
    return JSON.stringify(editorValue) === JSON.stringify(displayValue)
  }
  const merged: Record<string, unknown> = {
    serverName: input.serverName,
    transport: input.transport,
  }
  if (input.transport === 'stdio') {
    merged['command'] = unchanged(input.command, view.command) ? rawString(raw, 'command') ?? '' : input.command
    const rawArgs = rawStringArray(raw, 'args')
    merged['args'] = unchanged(input.args, view.args) ? rawArgs : input.args ?? []
    const cwd = unchanged(input.cwd, view.cwd) ? rawString(raw, 'cwd') : input.cwd
    if (cwd !== undefined && cwd !== '') merged['cwd'] = cwd
    // Secret-adjacent maps merge key-wise; unchanged keys keep raw values.
    merged['env'] = mergeStringMap(rawStringMap(raw, 'env'), input.env, input.keepEnv)
  } else {
    const url = unchanged(input.url, view.url) ? rawString(raw, 'url') ?? '' : input.url
    merged['url'] = url ?? ''
    merged['headers'] = mergeStringMap(rawStringMap(raw, 'headers'), input.headers, input.keepHeaders)
  }
  const timeout = unchanged(input.toolCallTimeoutMs, view.toolCallTimeoutMs)
    ? rawNumber(raw, 'toolCallTimeoutMs') : input.toolCallTimeoutMs
  if (timeout !== undefined) merged['toolCallTimeoutMs'] = timeout
  const failFast = unchanged(input.failOnStartupError, view.failOnStartupError)
    ? rawBoolean(raw, 'failOnStartupError') : input.failOnStartupError
  if (failFast === true) merged['failOnStartupError'] = true
  const reconnectEnabled = unchanged(input.reconnectEnabled, view.reconnectEnabled)
    ? rawBoolean(raw, 'reconnectEnabled') : input.reconnectEnabled
  const reconnectAttempts = unchanged(input.reconnectMaxAttempts, view.reconnectMaxAttempts)
    ? rawNumber(raw, 'reconnectMaxAttempts') : input.reconnectMaxAttempts
  const reconnect: Record<string, unknown> = {}
  if (reconnectEnabled !== undefined) reconnect['enabled'] = reconnectEnabled
  if (reconnectAttempts !== undefined) reconnect['maxAttempts'] = reconnectAttempts
  if (Object.keys(reconnect).length > 0) merged['reconnect'] = reconnect
  return merged
}

/** Merge one string map with keep semantics. */
function mergeStringMap(
  raw: Record<string, string>,
  entries: Record<string, string> | undefined,
  keep: string[] | undefined,
): Record<string, string> {
  const kept = new Set(keep ?? [])
  const result: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(raw)) {
    if (kept.has(key)) result[key] = rawValue
  }
  for (const [key, value] of Object.entries(entries ?? {})) result[key] = value
  return result
}

/** Read a raw string-array field from serialized loader config. */
function rawStringArray(config: unknown, key: string): string[] {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return []
  const value = (config as Record<string, unknown>)[key]
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/** Read a raw number field from serialized loader config. */
function rawNumber(config: unknown, key: string): number | undefined {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return undefined
  const value = (config as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Read a raw boolean field from serialized loader config. */
function rawBoolean(config: unknown, key: string): boolean | undefined {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return undefined
  const value = (config as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : undefined
}

/** Assemble one validated config's serialized row config (for `add`). */
function materializeConfig(input: McpServerConfigInput): Record<string, unknown> {
  const config: Record<string, unknown> = {
    serverName: input.serverName,
    transport: input.transport,
  }
  if (input.transport === 'stdio') {
    config['command'] = input.command ?? ''
    config['args'] = input.args ?? []
    if (input.cwd !== undefined && input.cwd !== '') config['cwd'] = input.cwd
    if (Object.keys(input.env ?? {}).length > 0) config['env'] = { ...input.env }
  } else {
    config['url'] = input.url ?? ''
    if (Object.keys(input.headers ?? {}).length > 0) config['headers'] = { ...input.headers }
  }
  if (input.toolCallTimeoutMs !== undefined) config['toolCallTimeoutMs'] = input.toolCallTimeoutMs
  if (input.failOnStartupError === true) config['failOnStartupError'] = true
  const reconnect: Record<string, unknown> = {}
  if (input.reconnectEnabled !== undefined) reconnect['enabled'] = input.reconnectEnabled
  if (input.reconnectMaxAttempts !== undefined) reconnect['maxAttempts'] = input.reconnectMaxAttempts
  if (Object.keys(reconnect).length > 0) config['reconnect'] = reconnect
  return config
}

/** Default entry id the console assigns to a new server row. */
export function defaultEntryId(serverName: string): string {
  return `mcp-${serverName}`
}

/** A fresh unique entry id for `add` given the ids already in the profile. */
export function nextEntryId(serverName: string, existingIds: ReadonlySet<string>): string {
  const base = defaultEntryId(serverName)
  if (!existingIds.has(base)) return base
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`
    if (!existingIds.has(candidate)) return candidate
  }
  throw new Error('dsh-mcp-panel: cannot allocate a unique entry id')
}

/** Validated patch op resolved host-side against loader facts. */
export type ResolvedPatchOp =
  | { readonly kind: 'add'; readonly entryId: string; readonly rowConfig: Record<string, unknown> }
  | { readonly kind: 'edit'; readonly entryId: string; readonly rowConfig: Record<string, unknown> }
  | { readonly kind: 'disable'; readonly entryId: string }
  | { readonly kind: 'enable'; readonly entryId: string }

/** Resolution outcome: one materialized op, or validation issues. */
export type McpPatchResolution =
  | { readonly ok: true; readonly op: ResolvedPatchOp }
  | { readonly ok: false; readonly issues: readonly McpConfigIssue[] }

/**
 * Resolve and validate one wire op into a fully materialized row config.
 *
 * @param op - the wire op (untrusted JSON from the client).
 * @param rawFor - loader rows' raw configs keyed by entry id (host-owned).
 * @param viewFor - the sanitized display views keyed by entry id.
 * @param existingIds - every entry id already in the profile.
 * @returns the resolved op, or validation issues.
 */
export function resolvePatchOp(
  op: unknown,
  rawFor: ReadonlyMap<string, unknown>,
  viewFor: ReadonlyMap<string, McpServerConfigView>,
  existingIds: ReadonlySet<string>,
): McpPatchResolution {
  if (typeof op !== 'object' || op === null || Array.isArray(op)) {
    return { ok: false, issues: [{ code: 'config-malformed', text: 'Patch operation must be a JSON object.' }] }
  }
  const candidate = op as Record<string, unknown>
  const kind = candidate['kind']
  if (kind === 'add') {
    const validated = validateServerConfig(candidate['config'])
    if (!validated.ok) return validated
    return {
      ok: true,
      op: {
        kind: 'add',
        entryId: nextEntryId(validated.config.serverName, existingIds),
        rowConfig: materializeConfig(validated.config),
      },
    }
  }
  if (kind === 'edit' || kind === 'disable' || kind === 'enable') {
    const entryId = candidate['entryId']
    if (typeof entryId !== 'string' || entryId === '') {
      return { ok: false, issues: [{ code: 'config-malformed', text: `patch "${kind}" requires the row's entryId.` }] }
    }
    if (!rawFor.has(entryId)) {
      return { ok: false, issues: [{ code: 'config-malformed', text: `unknown entryId "${entryId}".` }] }
    }
    if (kind === 'disable' || kind === 'enable') return { ok: true, op: { kind, entryId } }
    const validated = validateServerConfig(candidate['config'])
    if (!validated.ok) return validated
    const view = viewFor.get(entryId)
    if (view === undefined) {
      return { ok: false, issues: [{ code: 'config-malformed', text: `no display view for "${entryId}".` }] }
    }
    return {
      ok: true,
      op: { kind: 'edit', entryId, rowConfig: mergeServerConfig(rawFor.get(entryId), validated.config, view) },
    }
  }
  return { ok: false, issues: [{ code: 'config-malformed', text: `unknown patch kind ${JSON.stringify(kind)}.` }] }
}

/** A one-line comment stamp marking a console-generated operation block. */
export function patchComment(op: ResolvedPatchOp, now = new Date()): string {
  const date = now.toISOString().slice(0, 10)
  switch (op.kind) {
    case 'add': return `dsh-mcp-panel: add server (${date})`
    case 'edit': return `dsh-mcp-panel: edit server ${op.entryId} (${date})`
    case 'disable': return `dsh-mcp-panel: remove server ${op.entryId} — disabled (no runtime remove exists; re-enable with /mcp <server> enable) (${date})`
    case 'enable': return `dsh-mcp-panel: re-enable server ${op.entryId} (${date})`
  }
}

/**
 * Emit one resolved op as a loader patch fragment (valid YAML, append-only).
 * Generated fragments never contain `!!js` expressions; values are plain
 * strings emitted with conservative quoting.
 *
 * @param op - the resolved operation.
 * @param now - timestamp anchor (tests pass a fixed date).
 * @returns the YAML fragment (no trailing newline; callers append one).
 */
export function renderPatchFragment(op: ResolvedPatchOp, now = new Date()): string {
  const lines: string[] = [`# ${patchComment(op, now)}`]
  switch (op.kind) {
    case 'add': {
      lines.push('- insert:', `    - id: ${yamlScalar(op.entryId)}`, `      name: ${yamlScalar(MCP_CLIENT_MODULE)}`)
      emitBlock(lines, '      config:', op.rowConfig, 8)
      return lines.join('\n')
    }
    case 'edit': {
      lines.push('- set:', `    id: ${yamlScalar(op.entryId)}`, `    name: ${yamlScalar(MCP_CLIENT_MODULE)}`)
      emitBlock(lines, '    config:', op.rowConfig, 6)
      return lines.join('\n')
    }
    case 'disable':
    case 'enable': {
      lines.push(`- set: { id: ${yamlScalar(op.entryId)}, name: ${yamlScalar(MCP_CLIENT_MODULE)}, disabled: ${op.kind === 'disable' ? 'true' : 'false'} }`)
      return lines.join('\n')
    }
  }
}

/** Emit a config object block under one `key:` line at a fixed indent. */
function emitBlock(lines: string[], keyLine: string, value: Record<string, unknown>, indent: number): void {
  const entries = Object.entries(value)
  if (entries.length === 0) {
    lines.push(`${keyLine} {}`)
    return
  }
  lines.push(keyLine)
  const pad = ' '.repeat(indent)
  for (const [key, entry] of entries) emitValue(lines, `${pad}${key}`, entry, indent)
}

/** Emit one JSON-ish value under a `key` prefix. */
function emitValue(lines: string[], key: string, value: unknown, indent: number): void {
  if (typeof value === 'string') {
    lines.push(`${key}: ${yamlScalar(value)}`)
    return
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    lines.push(`${key}: ${String(value)}`)
    return
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${key}: []`)
      return
    }
    lines.push(`${key}:`)
    for (const entry of value) {
      if (typeof entry === 'string') lines.push(`${' '.repeat(indent + 2)}- ${yamlScalar(entry)}`)
      else lines.push(`${' '.repeat(indent + 2)}- ${JSON.stringify(entry)}`)
    }
    return
  }
  if (typeof value === 'object' && value !== null) {
    emitBlock(lines, `${key}:`, value as Record<string, unknown>, indent + 2)
    return
  }
  lines.push(`${key}: ${JSON.stringify(value)}`)
}

/** YAML vocabulary values that would change type when emitted plain. */
const RESERVED_WORDS = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~', 'y', 'n'])

/**
 * Quote one string for YAML emission. Plain-safe scalars stay plain;
 * everything else is single-quoted (JSON double-quoting for control
 * characters). Ambiguous scalars (`true`, `1e3`, `-y`) are always quoted so
 * the round-trip keeps the string type.
 */
export function yamlScalar(value: string): string {
  if (value === '') return "''"
  if (/^[A-Za-z][A-Za-z0-9_./@%+=,:-]*$/u.test(value)
    && !RESERVED_WORDS.has(value.toLocaleLowerCase())) {
    return value
  }
  if (/[\u0000-\u001f\u007f]/u.test(value)) return JSON.stringify(value)
  return `'${value.replaceAll("'", "''")}'`
}

/** Schema used for structural (non-throwing) validation of wire fragments in tests. */
export const MCP_PATCH_FRAGMENT_SCHEMA = z.string()

/** The one editor field list that may carry secrets; values never cross the wire. */
export const SECRET_MAP_KEYS = ['env', 'headers'] as const
