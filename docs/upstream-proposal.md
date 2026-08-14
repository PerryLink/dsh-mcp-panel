# Upstream proposal: minimal connection-status observability for `@deepseek-ai/dsh-mcp-client`

> **副本说明**：本文档随本插件仓库分发（权威副本）。提案的最终落点目标是
> `deepseek-ai/deepseek-harness` 仓库的 `docs/upstream-proposal.md`；若二者不一致，
> 以本插件仓库版本为插件实现所依据的契约，PR 内容以提交到上游仓库的版本为准。

**Status:** proposal (not yet implemented upstream). Target repository: `deepseek-ai/deepseek-harness`, package `packages/mcp/mcp-client`.
**Author:** `dsh-mcp-panel` (runtime management panel for the official MCP client).
**Scope:** status events + a status query service only. No transport, OAuth, protocol, or reconnect-policy changes.

## Motivation

The official MCP client keeps every connection fact in supervisor closure state
(`packages/mcp/mcp-client/src/connection.ts`): the live client generation,
`failedAttempts`, `connectedAt`, `firstAttemptError`, and the registered tool
disposers are private locals of `startConnection()`. The only observability is
the logger: "reconnecting (warn, with attempt count and delay)", "recovered
(info)", "final failure and disabled-loss (error)" (README "Behavior"). The
package's own invariant companion states the gap explicitly:

> "the bridge exposes no independent server-to-tool snapshot after an
> asynchronous resync" 鈥?`src/invariant.ts`

A read-only runtime management surface (a `/mcp` command, a web settings card)
therefore cannot show connection status, recent errors, or reconnect counts
without either reimplementing the client or guessing from the tool registry 鈥?and guessing from `ctx.tools` misreports a failed-but-tools-still-registered
server as healthy. This proposal adds the minimal seam that lets any consumer
observe the supervisor without touching its transport or reconnect logic.

## Proposed surface

### 1. Typed Cordis event `mcp/status` (emit)

One emission per supervisor state transition, payload:

```ts
/** App-level connection-status payload emitted on every mcp-client state transition. */
export interface McpStatusPayload {
  /** Stable local namespace from plugin config. */
  serverName: string
  /** Supervisor phase after the transition. */
  phase: 'connecting' | 'connected' | 'waiting' | 'exhausted' | 'disposed'
  /** Consecutive failed attempts in the current outage (0 while connected). */
  attempt: number
  /** Resolved reconnect budget (`reconnect.maxAttempts`). */
  maxAttempts: number
  /** Scheduled backoff delay while `waiting`. */
  delayMs?: number
  /** Raw error text of the failed attempt or re-sync; consumers sanitize before display. */
  error?: string
  /** Tools registered after the last successful sync (`disposers.size`). */
  toolCount: number
  /** Epoch ms of the last successful connect; absent while down. */
  connectedAt?: number
}
```

Emission sites (all inside `startConnection()`, current line numbers):

| Phase | Where | Notes |
|---|---|---|
| `connecting` | top of `connectGeneration()` (line ~237) | `attempt` = `failedAttempts` at entry; first attempt reports 0 |
| `connected` | after initial sync, `connectedAt` set (line ~303) | `attempt: 0`, `toolCount` = `disposers.size` |
| `connected` (re-sync failure) | notification re-sync catch (line ~267) | phase stays `connected` (last good list keeps serving), `error` set |
| `waiting` | `scheduleReconnect()` after the timer is armed (line ~218) | `attempt` after increment, `delayMs` included |
| `exhausted` | give-up branch (line ~213) | after `maxAttempts` consecutive failures |
| `disposed` | `dispose()` entry (line ~327) | terminal per plugin instance |

The event is process-app-level (no agent/session): connection state belongs to
the app, not to a conversation, so a session event would be the wrong carrier
and would pollute every session log with duplicated app state.

### 2. Query service `mcpStatus`

```ts
/** Current per-server status snapshot; the query face of `mcp/status`. */
export interface McpServerStatus extends McpStatusPayload {}

/**
 * Per-app status registry. `report()` is the single writer: it stores the
 * payload and emits the typed `mcp/status` event, so push consumers and
 * late-joining query consumers observe the same truth.
 */
export class McpStatusService extends Service {
  constructor(ctx: Context)            // super(ctx, 'mcpStatus')
  report(payload: McpStatusPayload): void
  list(): McpServerStatus[]
  get(serverName: string): McpServerStatus | undefined
}
```

One service per app root, created by the first live mcp-client instance and
shared by the rest 鈥?the same `WeakMap<Context, 鈥?` singleton pattern the file
already uses for `activeServerNames` (`src/index.ts` lines ~45, 148). Each
instance's supervisor calls `report()` at the six sites above. `dispose()`
reports `disposed` before unregistering tools so `toolCount` is still accurate
in the terminal payload.

### 3. Typing

- Event: `declare module '@deepseek-ai/cordis' { interface Events { 'mcp/status'(payload: McpStatusPayload): void } }` with `@mode emit` JSDoc.
- Service: `declare module '@deepseek-ai/cordis' { interface Context { mcpStatus: McpStatusService } }`.
- Both live in a new `src/status.ts`, re-exported from the package root; a new
  `mcp-client-invariant` companion can assert `report` 鉄?tool-registry
  generation if desired (optional, not required for this proposal).

## Deliberate non-goals

- **No transport / OAuth / protocol changes** 鈥?the supervisor's reconnect
  loop, transport factory, and tool bridge stay byte-for-byte; this only adds
  notifications around them.
- **No sanitization in the event** 鈥?the payload is trusted same-process data;
  `error` carries the real text. Display consumers redact before rendering
  (reference implementation: `dsh-mcp-panel` `src/sanitize.ts`).
- **No Typert remote export from mcp-client itself** 鈥?which host services
  reach the browser is an app-composition choice (gateway selection), not a
  client-package concern. Panels compose their own remote service over this
  seam, as `dsh-mcp-panel` does.
- **No per-session projection** 鈥?app-level runtime-varying state does not
  belong in session logs.

## PR contents (when implemented)

1. `src/status.ts` 鈥?payload type, service, event declaration.
2. `src/connection.ts` 鈥?six `report()` call sites (no behavior change).
3. `src/index.ts` 鈥?mount the shared `McpStatusService` singleton; export the types.
4. `README.md` 鈥?"Observability" section documenting the event and the service.
5. Tests 鈥?`status.spec.ts` (report/list/get, singleton across two instances),
   `reconnect.spec.ts` additions asserting the emitted phase sequence for a
   crash loop (connecting 鈫?connected 鈫?waiting 鈫?鈥?鈫?exhausted) and for
   `reconnect.enabled: false`.
6. Agent Note per repository convention (non-trivial change).

## Consumer behavior (dsh-mcp-panel, implemented against this proposal)

The panel subscribes `ctx.on('mcp/status', 鈥?` and optionally queries
`ctx.get('mcpStatus')` on start (feature detection 鈥?the service is absent
until this PR lands). When neither produces data, the panel reports status as
`unknown` with `statusSource: 'derived'` (from loader entries + tool registry
only) instead of fabricating a connection state. That keeps the panel honest
both before and after this proposal lands.

