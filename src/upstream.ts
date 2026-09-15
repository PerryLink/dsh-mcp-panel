/**
 * The upstream observability seam of `@deepseek-ai/dsh-mcp-client`
 * (proposed: `mcp/status` event + `mcpStatus` query service, see
 * `packages/mcp/mcp-client/src/status.ts` in the deepseek-harness repo),
 * consumed here with feature detection, plus the PROPOSED diagnostics
 * extension this console documents in `docs/upstream-proposal.md`
 * (deepseek-harness):
 *
 * - per-server process diagnostics (`exitCode`, `stderrTail`) on the status
 *   payload, so the health panel can quote spawn facts instead of guessing.
 *
 * Resources are ALREADY bridged upstream by `@deepseek-ai/dsh-mcp-resources`
 * (mounted by the base bundle since 0.1.5): the official client registers
 * each connection's resource provider into `ctx.mcpResources`, and that
 * package owns the three shared tools `list_mcp_resources`,
 * `list_mcp_resource_templates`, and `read_mcp_resource`. The console only
 * feature-detects the service's presence and trials resources through those
 * OFFICIAL tools — it never calls provider internals. MCP prompt templates
 * and resource subscriptions remain deferred upstream.
 *
 * Declarations merge into `@deepseek-ai/cordis`. When upstream ships the
 * proposed fields/services, its identical declarations merge cleanly; a
 * conflicting signature fails this package's compile, which is the intended
 * tripwire. At runtime everything is feature-detected: with no upstream
 * implementation mounted, no events arrive and `ctx.mcpStatus` is absent, so
 * the panel falls back to derived facts and reports
 * `statusSource: 'derived'`.
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
 * SHIPPED upstream face of `@deepseek-ai/dsh-mcp-resources`: the official
 * client registers each connection's resource provider here, and the package
 * owns the three shared tools (`list_mcp_resources`,
 * `list_mcp_resource_templates`, `read_mcp_resource`). The console only
 * feature-detects its presence — it never calls `register` or any provider
 * internals; resource trials go through the OFFICIAL tools.
 */
export interface McpResourcesFace {
  /** Register one server's resource provider (called by the official client). */
  register(server: string, provider: unknown): () => void
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
    /** The shipped upstream resource service; mounted by the base bundle. */
    mcpResources?: McpResourcesFace
  }
}

/** Exact event name, exported so consumers never hardcode the literal twice. */
export const MCP_STATUS_EVENT = 'mcp/status'
