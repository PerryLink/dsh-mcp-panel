/**
 * The upstream observability seam of `@deepseek-ai/dsh-mcp-client`
 * (proposed: `mcp/status` event + `mcpStatus` query service, see
 * `packages/mcp/mcp-client/src/status.ts` in the deepseek-harness repo),
 * consumed here with feature detection, plus two PROPOSED extensions this
 * console documents in `docs/upstream-proposal.md` (deepseek-harness):
 *
 * - per-server process diagnostics (`exitCode`, `stderrTail`) on the status
 *   payload, so the health panel can quote spawn facts instead of guessing;
 * - an `mcpCatalog` service face for Resources/Prompts listings, so the
 *   console can browse them read-only the day the bridge exposes them.
 *
 * Declarations merge into `@deepseek-ai/cordis`. When upstream ships the
 * proposed fields/services, its identical declarations merge cleanly; a
 * conflicting signature fails this package's compile, which is the intended
 * tripwire. At runtime everything is feature-detected: with no upstream
 * implementation mounted, no events arrive and `ctx.mcpStatus` /
 * `ctx.mcpCatalog` are absent, so the panel falls back to derived facts and
 * reports `statusSource: 'derived'` / "pending upstream support".
 *
 * @module dsh-mcp-panel/upstream
 */

/** Supervisor phase after one `mcp/status` transition (mirrors the shipped seam). */
export type McpStatusPhase = 'connecting' | 'connected' | 'waiting' | 'exhausted' | 'disposed'

/**
 * App-level connection-status payload emitted on every mcp-client state
 * transition. `error` carries raw same-process text; DISPLAY consumers must
 * sanitize (this package's `sanitize.ts`) before rendering. The
 * `exitCode`/`stderrTail` fields are the PROPOSED diagnostics extension —
 * absent until upstream ships them; the console labels them "pending
 * upstream support" instead of inventing values.
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
  /** PROPOSED: child-process exit code of the failed spawn/exit (stdio). */
  exitCode?: number
  /** PROPOSED: sanitized tail of the child's stderr at failure (stdio). */
  stderrTail?: string
}

/** Current per-server status snapshot; the query face of `mcp/status`. */
export type McpServerStatus = McpStatusPayload

/** Structural query face of the shipped `mcpStatus` service (feature-detected). */
export interface McpStatusQuery {
  /** Current status of every server this process knows. */
  list(): readonly McpServerStatus[]
  /** Current status of one server namespace, or `undefined`. */
  get(serverName: string): McpServerStatus | undefined
}

/**
 * PROPOSED per-server catalog face for Resources and Prompts. The official
 * client defers both ("Tools are the only bridged MCP capability"), so this
 * service does not exist yet; the console detects it structurally and shows
 * the read-only lists the day it ships, or a clear "pending upstream
 * support" notice until then.
 */
export interface McpCatalog {
  /** Server-qualified resource entries for one server namespace. */
  listResources(serverName: string): readonly unknown[]
  /** Server-qualified prompt entries for one server namespace. */
  listPrompts(serverName: string): readonly unknown[]
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * One MCP client supervisor state transition (the shipped upstream
     * observability seam). App-level: no agent or session scope.
     * @param payload - post-transition status facts.
     * @mode emit
     */
    'mcp/status'(payload: McpStatusPayload): void
  }
  interface Context {
    /** The shipped upstream status query service; absent when no mcp-client instance is composed. */
    mcpStatus?: McpStatusQuery
    /** The proposed upstream catalog service; absent until upstream ships it. */
    mcpCatalog?: McpCatalog
  }
}

/** Exact event name, exported so consumers never hardcode the literal twice. */
export const MCP_STATUS_EVENT = 'mcp/status'
