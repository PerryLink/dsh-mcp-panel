/**
 * The proposed upstream observability seam of `@deepseek-ai/dsh-mcp-client`
 * (see `docs/upstream-proposal.md` in the deepseek-harness repository),
 * consumed here before it ships: the typed `mcp/status` Cordis event and the
 * `mcpStatus` query service face.
 *
 * Declarations merge into `@deepseek-ai/cordis`. If upstream later ships the
 * same seam, its identical declarations merge cleanly; a conflicting
 * signature fails this package's compile, which is the intended tripwire.
 * At runtime the seam is feature-detected: with no upstream implementation
 * mounted, no events arrive and `ctx.mcpStatus` is absent, so the panel falls
 * back to derived facts and reports `statusSource: 'derived'`.
 *
 * @module dsh-mcp-panel/upstream
 */

/** Supervisor phase after one `mcp/status` transition (mirrors the proposal). */
export type McpStatusPhase = 'connecting' | 'connected' | 'waiting' | 'exhausted' | 'disposed'

/**
 * App-level connection-status payload emitted on every mcp-client state
 * transition. `error` carries raw same-process text; DISPLAY consumers must
 * sanitize (this package's `sanitize.ts`) before rendering.
 */
export interface McpStatusPayload {
  /** Stable local namespace from plugin config. */
  serverName: string
  /** Supervisor phase after the transition. */
  phase: McpStatusPhase
  /** Consecutive failed attempts in the current outage (0 while connected). */
  attempt: number
  /** Resolved reconnect budget (`reconnect.maxAttempts`). */
  maxAttempts: number
  /** Scheduled backoff delay while `waiting`. */
  delayMs?: number
  /** Raw error text of the failed attempt or re-sync. */
  error?: string
  /** Tools registered after the last successful sync. */
  toolCount: number
  /** Epoch ms of the last successful connect; absent while down. */
  connectedAt?: number
}

/** Current per-server status snapshot; the query face of `mcp/status`. */
export type McpServerStatus = McpStatusPayload

/** Structural query face of the proposed `mcpStatus` service (feature-detected). */
export interface McpStatusQuery {
  /** Current status of every server this process knows. */
  list(): readonly McpServerStatus[]
  /** Current status of one server namespace, or `undefined`. */
  get(serverName: string): McpServerStatus | undefined
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * One MCP client supervisor state transition (the proposed upstream
     * observability seam). App-level: no agent or session scope.
     * @param payload - post-transition status facts.
     * @mode emit
     */
    'mcp/status'(payload: McpStatusPayload): void
  }
  interface Context {
    /** The proposed upstream status query service; absent until upstream ships it. */
    mcpStatus?: McpStatusQuery
  }
}

/** Exact event name, exported so consumers never hardcode the literal twice. */
export const MCP_STATUS_EVENT = 'mcp/status'
