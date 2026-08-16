/**
 * The console's wire vocabulary: the snapshot types served over the
 * `mcpPanel` Remote namespace, their zod v4 validation schema (the strict
 * codec both Typert faces carry), and the invocation descriptors shared
 * verbatim by the host `./typert` manifest (`src/typert.host.ts`) and the
 * client Remote contribution (`src/client/remote.ts`). One canonical source
 * for both faces keeps the host and client codecs from ever drifting apart.
 *
 * Values that could be large or heterogeneous (trial results) cross the wire
 * as single bounded JSON strings; every scalar here has an explicit shape.
 *
 * @module dsh-mcp-panel/wire
 */

import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** Transport recorded for one configured mcp-client row. */
export type McpTransport = 'stdio' | 'streamable-http' | 'unknown'

/** Cordis Fiber phases projected for display; `null` = no fiber observed. */
export type McpFiberPhase = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null

/** Connection phase from the upstream `mcp/status` seam, plus `unknown`. */
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

/**
 * Sanitized editing view of one row's config. Secret VALUES never appear:
 * env/header entries are exposed as KEYS only (the editor's "unchanged"
 * placeholder keeps the raw value host-side). The URL is credential-redacted
 * for display; editing semantics re-merge raw values host-side, so a redacted
 * value never round-trips.
 */
export interface McpServerConfigView {
  /** Effective namespace. */
  serverName: string
  /** Declared transport; `unknown` when the row is malformed. */
  transport: McpTransport
  /** stdio: the executable. */
  command: string | null
  /** stdio: the argument list (display form). */
  args: readonly string[]
  /** stdio: working directory. */
  cwd: string | null
  /** http: sanitized endpoint URL. */
  url: string | null
  /** env keys present on the raw row (values never leave the host). */
  envKeys: readonly string[]
  /** header keys present on the raw row (values never leave the host). */
  headerKeys: readonly string[]
  /** Per-tool-call timeout ms, or null when unset. */
  toolCallTimeoutMs: number | null
  /** failOnStartupError, or null when unset. */
  failOnStartupError: boolean | null
  /** reconnect.enabled, or null when unset. */
  reconnectEnabled: boolean | null
  /** reconnect.maxAttempts, or null when unset. */
  reconnectMaxAttempts: number | null
}

/** One derived health suggestion (code = locale key, text = English fallback). */
export interface McpDiagnosticView {
  /** Localization code (`diag_<code>`). */
  code: string
  /** English fallback text, always renderable. */
  text: string
}

/** One MCP server's status view. */
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
  /** Sanitized editing view of the row's config (`null` for leftover namespaces). */
  config: McpServerConfigView | null
  /** Derived health suggestions (empty = nothing to suggest). */
  diagnostics: readonly McpDiagnosticView[]
  /** PROPOSED upstream: child exit code at failure; `null` = pending upstream support. */
  exitCode: number | null
  /** PROPOSED upstream: sanitized stderr tail; `null` = pending upstream support. */
  stderrTail: string | null
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

/** One bridged capability's availability (`false` = pending upstream support). */
export interface McpCapabilityView {
  /** Whether the upstream bridge exposes this capability today. */
  available: boolean
}

/** The complete panel snapshot served by `mcpPanel/status`. */
export interface McpPanelSnapshot {
  /** True when the upstream `mcp/status` seam produced data this process. */
  observed: boolean
  /** Absolute path of the profile patch layer that the CRUD console writes. */
  patchFile: string | null
  /** Suggested panel refresh interval in ms; `0` = the tab refreshes on demand only. */
  refreshIntervalMs: number
  /** One row per server namespace (configured rows first, leftover namespaces last). */
  servers: readonly McpServerView[]
  /** Connectivity probes this process, newest first. */
  probes: readonly McpProbeView[]
  /** Resources/Prompts availability (the official client exposes neither yet). */
  capabilities: {
    resources: McpCapabilityView
    prompts: McpCapabilityView
  }
  /** Trial console policy: enabled flag and panel-side limits. */
  trial: {
    enabled: boolean
    timeoutMs: number
    maxResultChars: number
  }
  /** Whether profile-patch writes are allowed at all (kill switch). */
  writeEnabled: boolean
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
    config: z.object({
      serverName: z.string(),
      transport: z.union([z.literal('stdio'), z.literal('streamable-http'), z.literal('unknown')]),
      command: z.string().nullable(),
      args: z.array(z.string()),
      cwd: z.string().nullable(),
      url: z.string().nullable(),
      envKeys: z.array(z.string()),
      headerKeys: z.array(z.string()),
      toolCallTimeoutMs: z.number().int().nullable(),
      failOnStartupError: z.boolean().nullable(),
      reconnectEnabled: z.boolean().nullable(),
      reconnectMaxAttempts: z.number().int().nullable(),
    }).nullable(),
    diagnostics: z.array(z.object({
      code: z.string(),
      text: z.string(),
    })),
    exitCode: z.number().int().nullable(),
    stderrTail: z.string().nullable(),
  })),
  probes: z.array(z.object({
    id: z.string(),
    serverName: z.string(),
    status: z.union([z.literal('running'), z.literal('stopping'), z.literal('completed'), z.literal('killed'), z.literal('failed'), z.literal('unknown')]),
    startedAt: z.number().int(),
    finishedAt: z.number().int().nullable(),
    detail: z.string().nullable(),
  })),
  capabilities: z.object({
    resources: z.object({ available: z.boolean() }),
    prompts: z.object({ available: z.boolean() }),
  }),
  trial: z.object({
    enabled: z.boolean(),
    timeoutMs: z.number().int(),
    maxResultChars: z.number().int(),
  }),
  writeEnabled: z.boolean(),
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

/** Result of `mcpPanel/previewPatch`: the generated fragment before any write. */
export interface PatchPreview {
  /** The generated YAML block (append-only operation). */
  fragment: string
  /** Absolute target file, or null when the profile patch path is unknown. */
  file: string | null
  /** Number of operations in the fragment (always 1). */
  ops: number
}

/** Strict wire schema for {@link PatchPreview}. */
export const PATCH_PREVIEW_SCHEMA = z.object({
  fragment: z.string(),
  file: z.string().nullable(),
  ops: z.number().int(),
})

/** The `mcpPanel/previewPatch` invocation descriptor: render one CRUD op. */
export const MCP_PANEL_PREVIEW_DESCRIPTOR = Object.freeze({
  id: 'dsh-mcp-panel#mcpPanel/previewPatch',
  service: 'mcpPanel',
  namespace: 'mcpPanel',
  method: 'previewPatch',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([Object.freeze({
    name: 'opJson',
    wire: 'opJson',
    source: 'json',
    codec: Object.freeze({
      mode: 'strict',
      typeSymbol: 'dsh-mcp-panel/types#PatchOpJson',
      schema: z.string(),
    }),
  } satisfies InvocationDescriptor['parameters'][number])]),
  result: Object.freeze({
    mode: 'strict',
    typeSymbol: 'dsh-mcp-panel/types#PatchPreview',
    schema: PATCH_PREVIEW_SCHEMA,
  }),
  sourceLocation: Object.freeze({ file: 'src/wire.ts', line: 1, column: 1 }),
} as const) satisfies InvocationDescriptor

/** Result of `mcpPanel/writePatch`: the applied append, with audit facts. */
export interface PatchWriteResult {
  /** Absolute file the fragment was appended to. */
  file: string
  /** Absolute timestamped backup created before the append. */
  backupPath: string
  /** Which approval path authorized the write. */
  approvalPath: 'harness-approval' | 'interactive-confirmation'
  /** Bytes appended. */
  bytes: number
  /** Operations applied (always 1). */
  ops: number
  /** What the user should do next (reload note). */
  note: string
}

/** Strict wire schema for {@link PatchWriteResult}. */
export const PATCH_WRITE_RESULT_SCHEMA = z.object({
  file: z.string(),
  backupPath: z.string(),
  approvalPath: z.union([z.literal('harness-approval'), z.literal('interactive-confirmation')]),
  bytes: z.number().int(),
  ops: z.number().int(),
  note: z.string(),
})

/** The `mcpPanel/writePatch` invocation descriptor: approval-gated append. */
export const MCP_PANEL_WRITE_DESCRIPTOR = Object.freeze({
  id: 'dsh-mcp-panel#mcpPanel/writePatch',
  service: 'mcpPanel',
  namespace: 'mcpPanel',
  method: 'writePatch',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([
    Object.freeze({
      name: 'opJson',
      wire: 'opJson',
      source: 'json',
      codec: Object.freeze({
        mode: 'strict',
        typeSymbol: 'dsh-mcp-panel/types#PatchOpJson',
        schema: z.string(),
      }),
    } satisfies InvocationDescriptor['parameters'][number]),
    Object.freeze({
      name: 'confirmed',
      wire: 'confirmed',
      source: 'json',
      codec: Object.freeze({
        mode: 'strict',
        typeSymbol: 'dsh-mcp-panel/types#PatchWriteConfirmed',
        schema: z.boolean(),
      }),
    } satisfies InvocationDescriptor['parameters'][number]),
    Object.freeze({
      name: 'sessionId',
      wire: 'sessionId',
      source: 'json',
      codec: Object.freeze({
        mode: 'strict',
        typeSymbol: 'dsh-mcp-panel/types#PatchWriteSessionId',
        schema: z.string(),
      }),
      acceptsUndefined: true,
    } satisfies InvocationDescriptor['parameters'][number]),
  ]),
  result: Object.freeze({
    mode: 'strict',
    typeSymbol: 'dsh-mcp-panel/types#PatchWriteResult',
    schema: PATCH_WRITE_RESULT_SCHEMA,
  }),
  sourceLocation: Object.freeze({ file: 'src/wire.ts', line: 1, column: 1 }),
} as const) satisfies InvocationDescriptor

/** Result of `mcpPanel/callTool`: one trial call through the official pipeline. */
export interface McpTrialResultWire {
  /** Panel-assigned correlation id. */
  callId: string
  /** Whether the pipeline settled the call as an error. */
  isError: boolean
  /** Whether the JSON projection hit the display cap. */
  truncated: boolean
  /** Wall-clock duration of the pipeline run in ms. */
  durationMs: number
  /** Capped JSON of `{ value, content }` or `{ error, content }`. */
  resultJson: string
}

/** Strict wire schema for {@link McpTrialResultWire}. */
export const MCP_TRIAL_RESULT_SCHEMA = z.object({
  callId: z.string(),
  isError: z.boolean(),
  truncated: z.boolean(),
  durationMs: z.number().int(),
  resultJson: z.string(),
})

/** The `mcpPanel/callTool` invocation descriptor: official-pipeline trial call. */
export const MCP_PANEL_CALLTOOL_DESCRIPTOR = Object.freeze({
  id: 'dsh-mcp-panel#mcpPanel/callTool',
  service: 'mcpPanel',
  namespace: 'mcpPanel',
  method: 'callTool',
  invocation: Object.freeze({ kind: 'direct' }),
  parameters: Object.freeze([
    Object.freeze({
      name: 'requestJson',
      wire: 'requestJson',
      source: 'json',
      codec: Object.freeze({
        mode: 'strict',
        typeSymbol: 'dsh-mcp-panel/types#TrialRequestJson',
        schema: z.string(),
      }),
    } satisfies InvocationDescriptor['parameters'][number]),
    Object.freeze({
      name: 'sessionId',
      wire: 'sessionId',
      source: 'json',
      codec: Object.freeze({
        mode: 'strict',
        typeSymbol: 'dsh-mcp-panel/types#TrialSessionId',
        schema: z.string(),
      }),
      acceptsUndefined: true,
    } satisfies InvocationDescriptor['parameters'][number]),
  ]),
  result: Object.freeze({
    mode: 'strict',
    typeSymbol: 'dsh-mcp-panel/types#McpTrialResultWire',
    schema: MCP_TRIAL_RESULT_SCHEMA,
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
  MCP_PANEL_PREVIEW_DESCRIPTOR,
  MCP_PANEL_WRITE_DESCRIPTOR,
  MCP_PANEL_CALLTOOL_DESCRIPTOR,
])
