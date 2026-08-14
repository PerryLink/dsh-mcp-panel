/**
 * Status aggregation: assemble the read-only server views from the three
 * facts the panel is allowed to read — loader rows (config, effective
 * disabled, fiber phase), the tool-registry snapshot, and upstream
 * `mcp/status` observations (when the proposed seam exists).
 *
 * Every field is read defensively: loader configs are raw serialized data
 * (possibly `!!js` expressions, wrong types, or absent), and upstream
 * payloads may lack optional fields. A malformed or missing field degrades
 * to an explicit default instead of throwing — the aggregation must never
 * take down the panel over one broken row.
 *
 * Pure: statuses and reconnect counters are passed in as snapshots.
 *
 * @module dsh-mcp-panel/aggregate
 */

import { groupMcpTools, type McpToolGroup } from './grouping.ts'
import { sanitizeError, sanitizeUrl } from './sanitize.ts'
import type { McpServerStatus } from './upstream.ts'
import type {
  McpConnectionPhase,
  McpFiberPhase,
  McpPanelSnapshot,
  McpServerView,
  McpTransport,
} from './wire.ts'

/** One loader-derived mcp-client row (config is raw serialized data). */
export interface McpLoaderRow {
  /** Loader entry id (the patch row id). */
  entryId: string
  /** Effective disabled state (parent groups and `!!js` already resolved by the Loader). */
  disabled: boolean
  /** Fiber phase; null when the row has no fiber. */
  fiberPhase: McpFiberPhase
  /** Raw `config` from the entry options; may be anything. */
  config: unknown
}

/** The exact module name of the official MCP client bridge. */
export const MCP_CLIENT_MODULE = '@deepseek-ai/dsh-mcp-client'

/** Marker shown for a `!!js` config value, which the panel never evaluates. */
export const JS_EXPRESSION_MARKER = '<expression>'

/** Sentinel values for "not observed" numeric fields. */
export const UNKNOWN_COUNT = -1

/** One server namespace → its upstream observation and derived totals. */
export interface McpStatusFacts {
  /** Latest upstream payload per server; absent = not observed. */
  statuses: ReadonlyMap<string, McpServerStatus>
  /** Cumulative reconnect attempts observed per server. */
  reconnects: ReadonlyMap<string, number>
  /** Epoch ms of the latest upstream event receipt per server. */
  observedAt: ReadonlyMap<string, number>
  /** Passive-probe reachability facts per server (empty when probing is off). */
  probeStates: ReadonlyMap<string, { state: 'reachable' | 'unreachable'; checkedAt: number }>
}

/**
 * The raw face of a `!!js` expression node in serialized loader config.
 * Detected structurally; the expression is never evaluated or displayed.
 */
interface JsExprNode {
  readonly __jsExpr?: unknown
}

/** Read a plain JSON value from raw config; `!!js` nodes and wrong types become the fallback. */
function plainField(config: unknown, key: string): unknown {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return undefined
  const value = (config as Record<string, unknown>)[key]
  if (value === undefined || value === null) return undefined
  if (typeof value === 'object' && '__jsExpr' in (value as JsExprNode)) return undefined
  return value
}

/** Read a string config field; absent, non-string, or `!!js` becomes the fallback. */
function stringField(config: unknown, key: string, fallback: string): string {
  const value = plainField(config, key)
  return typeof value === 'string' ? value : fallback
}

/** Render one argument for the display command line. */
function renderArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return /^[\w./:@%+=,_-]+$/u.test(arg) ? arg : JSON.stringify(arg)
  }
  if (typeof arg === 'object' && arg !== null && '__jsExpr' in (arg as JsExprNode)) {
    return JS_EXPRESSION_MARKER
  }
  try {
    return JSON.stringify(arg)
  } catch {
    return JS_EXPRESSION_MARKER
  }
}

/** Transport and display target derived from one raw mcp-client config. */
export function deriveTarget(config: unknown): { transport: McpTransport; target: string } {
  const transport = stringField(config, 'transport', '')
  if (transport === 'stdio') {
    const command = stringField(config, 'command', '')
    if (command === '') return { transport: 'unknown', target: '(unconfigured)' }
    const argsValue = plainField(config, 'args')
    const args = Array.isArray(argsValue) ? argsValue.map(renderArg) : []
    const target = args.length === 0 ? command : `${command} ${args.join(' ')}`
    return { transport: 'stdio', target }
  }
  if (transport === 'streamable-http') {
    const url = stringField(config, 'url', '')
    if (url === '') return { transport: 'unknown', target: '(unconfigured)' }
    return { transport: 'streamable-http', target: sanitizeUrl(url) }
  }
  return { transport: 'unknown', target: '(unconfigured)' }
}

/** Read the server namespace from raw config; absent becomes a stable fallback. */
export function serverNameOf(config: unknown, fallback: string): string {
  const name = stringField(config, 'serverName', '')
  return name === '' ? fallback : name
}

/**
 * Derive the config-declared policy facts in one display line. Reads only
 * boolean and number fields (never strings from raw config), so nothing
 * user-supplied or secret can leak; `null` = nothing noteworthy configured.
 */
function configuredNote(config: unknown): string | null {
  const parts: string[] = []
  const reconnectValue = plainField(config, 'reconnect')
  if (typeof reconnectValue === 'object' && reconnectValue !== null && !Array.isArray(reconnectValue)) {
    const enabled = plainField(reconnectValue, 'enabled')
    const maxAttempts = plainField(reconnectValue, 'maxAttempts')
    if (typeof enabled === 'boolean' && !enabled) {
      parts.push('reconnect off')
    } else if (typeof maxAttempts === 'number' && Number.isFinite(maxAttempts)) {
      parts.push(`reconnect max ${maxAttempts}`)
    }
  }
  if (plainField(config, 'failOnStartupError') === true) parts.push('fail on startup error')
  const toolTimeout = plainField(config, 'toolCallTimeoutMs')
  if (typeof toolTimeout === 'number' && Number.isFinite(toolTimeout)) parts.push(`tool timeout ${Math.round(toolTimeout / 1000)}s`)
  return parts.length === 0 ? null : parts.join('; ')
}

/** Upstream phase projected onto the wire vocabulary (unknown when unobserved). */
function connectionPhase(status: McpServerStatus | undefined): McpConnectionPhase {
  if (status === undefined) return 'unknown'
  return status.phase
}

/**
 * Assemble one server view from loader, registry, and upstream facts.
 * Missing upstream data degrades to `unknown`/`-1`/`null` — never fabricated.
 *
 * @param row - the mcp-client loader row, or `undefined` for leftover namespaces.
 * @param serverName - the effective namespace.
 * @param group - the tool group for this namespace (possibly empty).
 * @param facts - upstream observations and reconnect totals.
 * @returns the display-ready view.
 */
export function aggregateServerView(
  row: McpLoaderRow | undefined,
  serverName: string,
  group: McpToolGroup | undefined,
  facts: McpStatusFacts,
): McpServerView {
  const status = facts.statuses.get(serverName)
  const { transport, target } = row === undefined ? { transport: 'unknown' as const, target: '(unconfigured)' } : deriveTarget(row.config)
  const lastError = status?.error === undefined ? null : sanitizeError(status.error)
  const attempt = status?.attempt ?? UNKNOWN_COUNT
  const maxAttempts = status?.maxAttempts ?? UNKNOWN_COUNT
  const reconnect = facts.reconnects.get(serverName) ?? UNKNOWN_COUNT
  const connectedAt = status?.connectedAt ?? null
  const delayMs = status?.delayMs ?? null
  const observedAt = facts.observedAt.get(serverName) ?? null
  const probe = facts.probeStates.get(serverName)
  return {
    serverName,
    entryId: row?.entryId ?? '',
    transport,
    target,
    enabled: row?.disabled === false,
    fiberPhase: row?.fiberPhase ?? null,
    configuredNote: row === undefined ? null : configuredNote(row.config),
    toolCount: group?.tools.length ?? 0,
    tools: group?.tools ?? [],
    phase: connectionPhase(status),
    attempt,
    maxAttempts,
    delayMs,
    reconnectCount: reconnect,
    lastError,
    connectedAt,
    observedAt,
    probeState: probe?.state ?? null,
    probeCheckedAt: probe?.checkedAt ?? null,
    statusSource: status === undefined ? 'derived' : 'upstream-event',
  }
}

/** Inputs for {@link aggregateSnapshot}; grouped so callers never mix them up. */
export interface McpAggregateInput {
  /** Loader mcp-client rows (raw config included). */
  rows: readonly McpLoaderRow[]
  /** Tool groups from {@link groupMcpTools}. */
  groups: readonly McpToolGroup[]
  /** Upstream status facts (may be empty). */
  facts: McpStatusFacts
  /** Background probe views (may be empty). */
  probes: McpPanelSnapshot['probes']
  /** Absolute profile patch-layer path, or null. */
  patchFile: string | null
  /** Suggested panel refresh interval in ms (`0` = on demand). */
  refreshIntervalMs: number
}

/**
 * Assemble the complete snapshot from loader rows, tool groups, upstream
 * facts, and probe rows. Tolerates missing fields anywhere in the inputs.
 *
 * @param input - the snapshot inputs (see {@link McpAggregateInput}).
 * @returns the wire snapshot.
 */
export function aggregateSnapshot(input: McpAggregateInput): McpPanelSnapshot {
  const { rows, groups, facts, probes, patchFile, refreshIntervalMs } = input
  // One view per namespace: the enabled row wins; otherwise the first row.
  const rowsByName = new Map<string, McpLoaderRow>()
  for (const row of rows) {
    const name = serverNameOf(row.config, `entry:${row.entryId}`)
    const existing = rowsByName.get(name)
    if (existing === undefined || (!row.disabled && existing.disabled)) rowsByName.set(name, row)
  }
  const groupsByName = new Map(groups.map(group => [group.serverName, group]))
  const names = new Set([...rowsByName.keys(), ...groupsByName.keys()])
  const servers = [...names]
    .map(name => aggregateServerView(rowsByName.get(name), name, groupsByName.get(name), facts))
    .sort((left, right) => left.serverName < right.serverName ? -1 : 1)
  return {
    observed: facts.statuses.size > 0,
    patchFile,
    refreshIntervalMs,
    servers,
    probes,
  }
}
