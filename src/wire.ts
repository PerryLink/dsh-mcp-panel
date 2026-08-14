/**
 * The panel's wire vocabulary: the snapshot types served over the `mcpPanel`
 * Remote namespace, their zod v4 validation schema (the strict codec both
 * Typert faces carry), and the single invocation descriptor shared by the
 * host `./typert` manifest and the client Remote contribution. One canonical
 * source for both faces keeps the host and client codecs from ever drifting
 * apart.
 *
 * @module dsh-mcp-panel/wire
 */

import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** Transport recorded for one configured mcp-client row. */
export type McpTransport = 'stdio' | 'streamable-http' | 'unknown'

/** Cordis Fiber phases projected for display; `null` = no fiber observed. */
export type McpFiberPhase = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null

/** Connection phase from the proposed upstream `mcp/status` seam, plus `unknown`. */
export type McpConnectionPhase = 'connecting' | 'connected' | 'waiting' | 'exhausted' | 'disposed' | 'unknown'

/** Provenance of the connection fields: upstream events or derived facts only. */
export type McpStatusSource = 'upstream-event' | 'derived'

/** One MCP tool's model-facing view (public name + one-line description). */
export interface McpToolView {
  /** Public tool name (`mcp__<server>__<raw>` or its deterministic normalized form). */
  name: string
  /** Server-provided description; empty when absent. */
  description: string
}

/** One MCP server's read-only status view. */
export interface McpServerView {
  /** Stable namespace from plugin config. */
  serverName: string
  /** Loader entry id carrying the mcp-client row. */
  entryId: string
  /** Declared transport; `unknown` when the row is not an mcp-client row or is malformed. */
  transport: McpTransport
  /** Display target: the command line (stdio) or the sanitized URL (streamable-http). */
  target: string
  /** Effective loader disabled state (includes parent groups and `!!js` evaluation). */
  enabled: boolean
  /** Cordis fiber phase of the row; `null` when no fiber exists. */
  fiberPhase: McpFiberPhase
  /** Config-declared policy facts (reconnect budget, fail-fast, tool timeout); `null` = defaults. */
  configuredNote: string | null
  /** Registered tools from `ctx.tools.schemas()` under `mcp__<server>__`. */
  toolCount: number
  /** The model-visible tools; empty for a server with none registered. */
  tools: readonly McpToolView[]
  /** Connection phase; `unknown` when no upstream status was observed. */
  phase: McpConnectionPhase
  /** Failed attempts in the current outage (upstream); `-1` when unknown. */
  attempt: number
  /** Resolved reconnect budget (upstream); `-1` when unknown. */
  maxAttempts: number
  /** Scheduled backoff delay while `waiting`; `null` otherwise or unknown. */
  delayMs: number | null
  /** Reconnect attempts observed this process; `-1` when unknown. */
  reconnectCount: number
  /** Most recent error, sanitized for display; `null` when none or unknown. */
  lastError: string | null
  /** Epoch ms of the last successful connect (upstream); `null` otherwise or unknown. */
  connectedAt: number | null
  /** Epoch ms when this process last received an upstream status event; `null` without one. */
  observedAt: number | null
  /** Passive-probe reachability (`null` = probing disabled or never run). */
  probeState: 'reachable' | 'unreachable' | null
  /** Epoch ms of the latest passive-probe settlement; `null` without one. */
  probeCheckedAt: number | null
  /** Where the connection fields came from. */
  statusSource: McpStatusSource
}

/** One background connectivity probe (panel-only; never model context). */
export interface McpProbeView {
  /** Background-job id (`mcp-probe-N`). */
  id: string
  /** Server the probe targeted. */
  serverName: string
  /** Job lifecycle state (`unknown` for registry states outside this panel's vocabulary). */
  status: 'running' | 'stopping' | 'completed' | 'killed' | 'failed' | 'unknown'
  /** Epoch ms when the probe started. */
  startedAt: number
  /** Epoch ms when the probe settled; `null` while running. */
  finishedAt: number | null
  /** Sanitized one-line detail (HTTP status, latency, server info, or error). */
  detail: string | null
}

/** The complete panel snapshot served by `mcpPanel/status`. */
export interface McpPanelSnapshot {
  /** True when the proposed upstream `mcp/status` seam produced data this process. */
  observed: boolean
  /** Absolute path of the profile patch layer that disable/enable suggestions name. */
  patchFile: string | null
  /** Suggested panel refresh interval in ms; `0` = the tab refreshes on demand only. */
  refreshIntervalMs: number
  /** One row per server namespace (configured rows first, leftover namespaces last). */
  servers: readonly McpServerView[]
  /** Connectivity probes this process, newest first. */
  probes: readonly McpProbeView[]
}

/** Strict wire schema for {@link McpPanelSnapshot} (zod v4, both Typert faces). */
export const MCP_PANEL_SNAPSHOT_SCHEMA = z.object({
  observed: z.boolean(),
  patchFile: z.string().nullable(),
  refreshIntervalMs: z.number().int(),
  servers: z.array(z.object({
    serverName: z.string(),
    entryId: z.string(),
    transport: z.union([z.literal('stdio'), z.literal('streamable-http'), z.literal('unknown')]),
    target: z.string(),
    enabled: z.boolean(),
    fiberPhase: z.union([z.literal('pending'), z.literal('loading'), z.literal('active'), z.literal('failed'), z.literal('unloading'), z.null()]),
    configuredNote: z.string().nullable(),
    toolCount: z.number().int(),
    tools: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })),
    phase: z.union([z.literal('connecting'), z.literal('connected'), z.literal('waiting'), z.literal('exhausted'), z.literal('disposed'), z.literal('unknown')]),
    attempt: z.number().int(),
    maxAttempts: z.number().int(),
    delayMs: z.number().int().nullable(),
    reconnectCount: z.number().int(),
    lastError: z.string().nullable(),
    connectedAt: z.number().int().nullable(),
    observedAt: z.number().int().nullable(),
    probeState: z.union([z.literal('reachable'), z.literal('unreachable'), z.null()]),
    probeCheckedAt: z.number().int().nullable(),
    statusSource: z.union([z.literal('upstream-event'), z.literal('derived')]),
  })),
  probes: z.array(z.object({
    id: z.string(),
    serverName: z.string(),
    status: z.union([z.literal('running'), z.literal('stopping'), z.literal('completed'), z.literal('killed'), z.literal('failed'), z.literal('unknown')]),
    startedAt: z.number().int(),
    finishedAt: z.number().int().nullable(),
    detail: z.string().nullable(),
  })),
})

/**
 * The `mcpPanel/status` invocation descriptor, shared verbatim by the host
 * `TYPERT` manifest (`src/typert.host.ts`) and the client
 * `TypertRemoteContribution` (`src/client/remote.ts`). Hand-written in the
 * exact shape the Typert generator emits; validated by the typert loader and
 * the client registry at mount time.
 */
export const MCP_PANEL_STATUS_DESCRIPTOR = Object.freeze({
  id: 'dsh-mcp-panel#mcpPanel/status',
  service: 'mcpPanel',
  namespace: 'mcpPanel',
  method: 'status',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([]),
  result: Object.freeze({
    mode: 'strict',
    typeSymbol: 'dsh-mcp-panel/types#McpPanelSnapshot',
    schema: MCP_PANEL_SNAPSHOT_SCHEMA,
  }),
  sourceLocation: Object.freeze({ file: 'src/wire.ts', line: 1, column: 1 }),
} as const) satisfies InvocationDescriptor

/** Result of the `mcpPanel/probe` invocation: a started panel-only probe. */
export interface ProbeStarted {
  /** Background-job id (`mcp-probe-N`). */
  jobId: string
  /** Where the result lands: the settings tab, never model context. */
  note: string
}

/** Strict wire schema for {@link ProbeStarted}. */
export const PROBE_STARTED_SCHEMA = z.object({
  jobId: z.string(),
  note: z.string(),
})

/**
 * The `mcpPanel/probe` invocation descriptor: start a one-shot probe from the
 * settings panel (same background-job mechanics as the `mcp_probe` tool).
 */
export const MCP_PANEL_PROBE_DESCRIPTOR = Object.freeze({
  id: 'dsh-mcp-panel#mcpPanel/probe',
  service: 'mcpPanel',
  namespace: 'mcpPanel',
  method: 'probe',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([Object.freeze({
    name: 'serverName',
    wire: 'serverName',
    source: 'json',
    codec: Object.freeze({
      mode: 'strict',
      typeSymbol: 'dsh-mcp-panel/types#ProbeRequestServerName',
      schema: z.string(),
    }),
  } satisfies InvocationDescriptor['parameters'][number])]),
  result: Object.freeze({
    mode: 'strict',
    typeSymbol: 'dsh-mcp-panel/types#ProbeStarted',
    schema: PROBE_STARTED_SCHEMA,
  }),
  sourceLocation: Object.freeze({ file: 'src/wire.ts', line: 1, column: 1 }),
} as const) satisfies InvocationDescriptor

/**
 * The canonical invocation list both Typert faces register — the host
 * manifest and the client contribution share these exact descriptor objects,
 * so the two wire codecs can never drift apart.
 */
export const MCP_PANEL_INVOCATIONS = Object.freeze([
  MCP_PANEL_STATUS_DESCRIPTOR,
  MCP_PANEL_PROBE_DESCRIPTOR,
])
