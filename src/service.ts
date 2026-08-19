/**
 * The console's host service: assembles the MCP snapshot and serves it under
 * the `mcpPanel` Typert Remote namespace (`mcpPanel/status`), plus the three
 * console actions — `previewPatch` (render a CRUD operation),
 * `writePatch` (approval-gated append to the profile patch layer, with
 * automatic backup), and `callTool` (a tool trial through the OFFICIAL
 * `ctx.tools.execute` pipeline) — and the panel probe action.
 *
 * Data sources, all read-only:
 * - `ctx.loader` — mcp-client rows (raw config, effective disabled, fiber phase).
 * - `ctx.tools.schemas()` / `ctx.tools.execute()` — registered `mcp__*` tools
 *   and the official execution pipeline (permission + approval + guards).
 * - the shipped upstream `mcp/status` seam — observed via {@link observe}.
 * - `ctx.jobs` — unowned `mcp-probe` background jobs (panel-only results).
 * - `ctx.approval` / `ctx.agents` — feature-detected approval routing.
 *
 * Connection status is reported honestly: without upstream observations the
 * view reads `unknown` with `statusSource: 'derived'`; the panel never infers
 * a connection state from tool-registry presence.
 *
 * Writes are APPEND-ONLY and never touch any file before the approval gate
 * passes; every write first copies the current patch layer to a timestamped
 * backup (see `src/write.ts`).
 *
 * @module dsh-mcp-panel/service
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/cordis-plugin-loader'
// Type-only: activates the `ctx.jobs` Context merge.
import type {} from '@deepseek-ai/dsh-jobs'
// Type-only: activates the `ctx.agents` Context merge (feature-detected at runtime).
import type {} from '@deepseek-ai/dsh-agent'
// Type-only: activates the `mcp-probe` JobKindMap extension.
import type {} from './probe.ts'
import {
  aggregateSnapshot,
  configViewOf,
  MCP_CLIENT_MODULE,
  serverNameOf,
  type McpLoaderRow,
} from './aggregate.ts'
import { groupMcpTools } from './grouping.ts'
import {
  renderPatchFragment,
  resolvePatchOp,
  type McpPatchResolution,
} from './patch.ts'
import { appendPatchFragment } from './write.ts'
import { createTrialCaller, validateTrialRequest, type McpAgentRegistryFace, type McpTrialRequest } from './trial.ts'
import { probeEndpoint, probeJob, PROBE_KIND } from './probe.ts'
import { sanitizeText } from './sanitize.ts'
import type { McpServerStatus, McpStatusPhase } from './upstream.ts'
import type {
  McpFiberPhase,
  McpPanelSnapshot,
  McpProbeView,
  McpTrialResultWire,
  PatchPreview,
  PatchWriteResult,
  ProbeStarted,
} from './wire.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** MCP management console snapshot + actions service (this package). */
    mcpPanel: McpPanelService
  }
}

/**
 * Runtime mirror of the Cordis `FiberState` const enum (numeric cross-package
 * const enums have no runtime import), projected to the wire phases.
 */
const FIBER_PHASE: Record<number, McpFiberPhase> = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: null,
  5: 'unloading',
}

/** The profile patch-layer filename the console writes (append-only). */
const PROFILE_PATCH_FILENAME = 'cordis.patch.yml'

/** Label prefix written by the `mcp_probe` tool and the panel probe action. */
const PROBE_LABEL_PREFIX = 'mcp_probe '

/**
 * Supervisor phases this panel understands. Upstream payloads are
 * unvalidated runtime data (any plugin can emit `mcp/status`): a payload
 * whose required fields do not match the wire codec would otherwise be
 * stored verbatim and later REJECT the whole `mcpPanel/status` snapshot on
 * the strict Typert codec, taking down the panel over one bad event.
 */
const KNOWN_PHASES: ReadonlySet<string> = new Set(['connecting', 'connected', 'waiting', 'exhausted', 'disposed'])

/** Background-job statuses the panel displays; anything else reads `unknown`. */
const KNOWN_JOB_STATUSES: ReadonlySet<string> = new Set(['running', 'stopping', 'completed', 'killed', 'failed'])

/**
 * Structural face of the approval seam (`@deepseek-ai/dsh-user-approval`),
 * feature-detected so the panel never hard-depends on the approval package.
 * The real service's `request` throws when no turn is open; the panel checks
 * turn state before asking and never lets an approval failure fall through
 * to an ungated write.
 */
interface ApprovalSeamFace {
  request(req: {
    agent: unknown
    toolName: string
    reason?: string
    signal?: AbortSignal
  }): Promise<unknown>
}

/** The one approval outcome that authorizes a write. */
const ALLOWED_ONCE = 'allowed-once'

/** Service-level runtime settings; the plugin passes its resolved config in. */
export interface McpPanelServiceConfig {
  /** Per-probe timeout in milliseconds. */
  probeTimeoutMs: number
  /** Cap on probe records shown in the panel. */
  maxProbes: number
  /** Suggested panel refresh interval in ms (0 = on demand). */
  refreshIntervalMs: number
  /** Whether the passive probe loop runs. */
  passiveProbeEnabled: boolean
  /** Passive probe interval in milliseconds. */
  passiveProbeIntervalMs: number
  /** Whether the tool trial console is enabled. */
  trialEnabled: boolean
  /** Panel-side deadline for one trial tool call. */
  trialTimeoutMs: number
  /** Cap on the trial result payload in chars. */
  trialMaxResultChars: number
  /** Whether profile-patch writes are allowed at all. */
  writeEnabled: boolean
  /** Number of patch backups retained per write. */
  backupCount: number
}

/** Defaults for direct (non-Loader) service construction. */
const DEFAULT_SERVICE_CONFIG: McpPanelServiceConfig = {
  probeTimeoutMs: 10_000,
  maxProbes: 10,
  refreshIntervalMs: 0,
  passiveProbeEnabled: false,
  passiveProbeIntervalMs: 60_000,
  trialEnabled: true,
  trialTimeoutMs: 120_000,
  trialMaxResultChars: 60_000,
  writeEnabled: true,
  backupCount: 5,
}

/** Whether one agent's session currently has an open turn (approval precondition). */
function hasOpenTurn(agent: unknown): boolean {
  try {
    const session = (agent as { session?: { events?: readonly { type?: unknown }[] } } | null)?.session
    const events = session?.events
    if (!Array.isArray(events)) return false
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const type = events[index]?.type
      if (type === 'turn/start') return true
      if (type === 'turn/end') return false
    }
  } catch {
    // A hostile agent shape must never crash the gate — treat as no open turn.
  }
  return false
}

/** MCP management console service, exported over the `mcpPanel` Remote namespace. */
export class McpPanelService extends TypertRemoteService {
  static inject = ['loader', 'tools']

  /** Latest upstream payload per server namespace. */
  private readonly statuses = new Map<string, McpServerStatus>()
  /** Cumulative reconnect attempts observed per server namespace. */
  private readonly reconnects = new Map<string, number>()
  /**
   * Highest `attempt` already counted per server, so re-observing the same
   * payload (HMR remount, event + query seed of one transition) never double
   * counts a reconnect.
   */
  private readonly countedAttempts = new Map<string, number>()
  /** Epoch ms of the latest upstream event receipt per server namespace. */
  private readonly observedAt = new Map<string, number>()
  /** Latest passive-probe reachability per server namespace. */
  private readonly probeStates = new Map<string, { state: 'reachable' | 'unreachable'; checkedAt: number }>()

/** The trial caller with this instance's own callId sequence. */
private readonly trialCaller = createTrialCaller()
  /** Passive-probe loop guard: one sweep at a time. */
  private passiveRunning = false

  /**
   * @param ctx - context carrying the loader and tool registry.
   * @param config - resolved runtime settings; defaults apply for direct construction.
   */
  constructor(ctx: Context, private readonly config: McpPanelServiceConfig = DEFAULT_SERVICE_CONFIG) {
    super(ctx, 'mcpPanel')
    if (config.passiveProbeEnabled) {
      const timer = setInterval(() => { void this.runPassiveProbes() }, config.passiveProbeIntervalMs)
      // An armed probe timer must never hold the process open on its own.
      timer.unref?.()
      ctx.effect(() => () => { clearInterval(timer) }, 'dsh-mcp-panel: passive probe loop')
    }
  }

  /**
   * Record one upstream `mcp/status` payload (event or query-seed). Payloads
   * are validated before storage — they are unvalidated runtime data and a
   * malformed one must never poison the strict wire codec downstream. A
   * `connecting` payload with a strictly increasing attempt counts one
   * reconnect; re-observing the same payload never double counts.
   *
   * @param payload - post-transition status facts.
   */
  observe(payload: McpServerStatus): void {
    if (typeof payload !== 'object' || payload === null) return
    const { serverName, phase, attempt, maxAttempts, toolCount } = payload
    if (typeof serverName !== 'string' || serverName === '') return
    if (typeof phase !== 'string' || !KNOWN_PHASES.has(phase)) return
    if (!Number.isFinite(attempt) || !Number.isFinite(maxAttempts) || !Number.isFinite(toolCount)) return
    // Normalize into the exact shape the wire codec accepts; optional fields
    // drop when they are not codec-shaped instead of rejecting the snapshot.
    const clean: McpServerStatus = {
      serverName,
      phase: phase as McpStatusPhase,
      attempt: Math.floor(attempt),
      maxAttempts: Math.floor(maxAttempts),
      toolCount: Math.floor(toolCount),
      ...(Number.isFinite(payload.delayMs) ? { delayMs: Math.floor(payload.delayMs as number) } : {}),
      ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
      ...(Number.isFinite(payload.connectedAt) ? { connectedAt: Math.floor(payload.connectedAt as number) } : {}),
      // Proposed upstream diagnostics extension: kept only when shaped.
      ...(Number.isFinite(payload.exitCode) ? { exitCode: Math.floor(payload.exitCode as number) } : {}),
      ...(typeof payload.stderrTail === 'string' ? { stderrTail: payload.stderrTail } : {}),
    }
    this.statuses.set(serverName, clean)
    this.observedAt.set(serverName, Date.now())
    if (clean.phase === 'connecting' && clean.attempt > 0) {
      const counted = this.countedAttempts.get(serverName) ?? 0
      if (clean.attempt > counted) {
        this.countedAttempts.set(serverName, clean.attempt)
        this.reconnects.set(serverName, (this.reconnects.get(serverName) ?? 0) + 1)
      }
    } else if (clean.phase === 'connected' || clean.phase === 'disposed') {
      // A recovery or teardown resets the counter so the next outage counts
      // from attempt 1 again. `waiting`/`exhausted` keep it: those phases
      // carry the ongoing outage's attempt and must not re-arm counting.
      this.countedAttempts.set(serverName, 0)
    }
  }

  /**
   * Assemble the current snapshot. Read-only: touches no configuration file
   * and mutates no registry. Exported on the wire by the `mcpPanel/status`
   * invocation descriptor in `./wire.ts` (registered through the package's
   * `./typert` manifest) — no method decorator, so the built bundle stays
   * plain ESM.
   *
   * @returns the wire snapshot (validated by the strict Typert codec on both faces).
   */
  status(): McpPanelSnapshot {
    const rows: McpLoaderRow[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.name !== MCP_CLIENT_MODULE) continue
      rows.push({
        // options.id is the user-written patch id (entry.id prefixes enclosing
        // group ids such as `include:`), so patch suggestions match on reload.
        entryId: entry.options.id,
        disabled: entry.disabled,
        fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state] ?? null,
        config: entry.options.config,
      })
    }
    const schemas = this.ctx.tools.schemas()
    const configuredNames = rows.map(row => serverNameOf(row.config, `entry:${row.entryId}`))
    const groups = groupMcpTools(schemas, configuredNames)
    const catalog = this.ctx.get('mcpCatalog') as { listResources?: unknown; listPrompts?: unknown } | undefined
    return aggregateSnapshot({
      rows,
      groups,
      facts: {
        statuses: this.statuses,
        reconnects: this.reconnects,
        observedAt: this.observedAt,
        probeStates: this.probeStates,
      },
      probes: this.probeViews(),
      patchFile: this.patchFile(),
      refreshIntervalMs: this.config.refreshIntervalMs,
      capabilities: {
        resources: { available: typeof catalog?.listResources === 'function' },
        prompts: { available: typeof catalog?.listPrompts === 'function' },
      },
      trial: {
        enabled: this.config.trialEnabled,
        timeoutMs: this.config.trialTimeoutMs,
        maxResultChars: this.config.trialMaxResultChars,
      },
      writeEnabled: this.config.writeEnabled,
    })
  }

  /**
   * Start a one-shot connectivity probe of one configured streamable-http
   * server as an UNOWNED background job — panel-only, like the `mcp_probe`
   * tool, but callable from the settings tab. Exported on the wire by the
   * `mcpPanel/probe` invocation descriptor.
   *
   * @param serverName - configured namespace.
   * @returns the started job id and where the result lands.
   */
  probe(serverName: string): ProbeStarted {
    const target = this.rawEndpoint(serverName)
    if (target === undefined) {
      throw new Error(`dsh-mcp-panel: "${serverName}" is not a configured streamable-http MCP server`)
    }
    const jobs = this.ctx.get('jobs')
    if (jobs === undefined) {
      throw new Error('dsh-mcp-panel: ctx.jobs is not composed — the panel probe action needs a background-job registry')
    }
    const jobId = jobs.start({
      kind: PROBE_KIND,
      label: `mcp_probe ${serverName}`,
      // Unowned: no model completion notice, readable by the panel only.
      run: () => probeJob(target.url, target.headers, this.config.probeTimeoutMs),
    })
    return {
      jobId,
      note: 'Probe results are panel-only: Settings → Plugins → MCP.',
    }
  }

  /**
   * Render one CRUD operation as its append-only patch fragment WITHOUT
   * touching any file. Exported by `mcpPanel/previewPatch`; the editor uses
   * it for the copy-to-clipboard path and the confirm review.
   *
   * @param opJson - JSON of the operation (add / edit / disable / enable).
   * @returns the fragment, the target file, and the operation count.
   */
  previewPatch(opJson: string): PatchPreview {
    const resolution = this.resolveOp(opJson)
    if (!resolution.ok) throw this.issueError(resolution)
    return {
      fragment: renderPatchFragment(resolution.op),
      file: this.patchFile(),
      ops: 1,
    }
  }

  /**
   * Append one CRUD operation to the profile patch layer, approval-gated.
   * Order: validate → resolve against loader facts → render → APPROVE →
   * backup → append. The approval gate:
   *
   * - when the harness approval service exists AND the caller's session has
   *   a live agent with an open turn, the write asks through
   *   `ctx.approval.request` — only `allowed-once` proceeds (rejection,
   *   cancellation, unavailability, and audit failures all fail closed);
   * - otherwise (settings-page writes happen outside turns) the explicit
   *   interactive confirmation is the approval channel, and the write
   *   proceeds only when the client's `confirmed` flag is true;
   * - `writeEnabled: false` rejects every write up front (kill switch).
   *
   * @param opJson - JSON of the operation.
   * @param confirmed - whether the human reviewed and confirmed in the UI.
   * @param sessionId - optional current session for approval routing.
   * @returns the applied write with audit facts.
   */
  async writePatch(opJson: string, confirmed: boolean, sessionId: string | undefined): Promise<PatchWriteResult> {
    if (!this.config.writeEnabled) {
      throw new Error('dsh-mcp-panel: profile writes are disabled (config.writeEnabled: false) — flip the kill switch or edit the file by hand')
    }
    const file = this.patchFile()
    if (file === null) {
      throw new Error('dsh-mcp-panel: the profile patch path is unknown (no ctx.baseUrl) — cannot write')
    }
    const resolution = this.resolveOp(opJson)
    if (!resolution.ok) throw this.issueError(resolution)
    const fragment = renderPatchFragment(resolution.op)

    const approval = this.ctx.get('approval') as ApprovalSeamFace | undefined
    const agents = this.ctx.get('agents') as McpAgentRegistryFace | undefined
    const agent = sessionId === undefined || sessionId === '' ? undefined : agents?.get(sessionId)
    let approvalPath: PatchWriteResult['approvalPath'] | null = null
    if (approval !== undefined && agent !== undefined && hasOpenTurn(agent)) {
      const outcome = await approval.request({
        agent,
        toolName: 'mcp-panel/writePatch',
        reason: `append a dsh-mcp-panel operation (${resolution.op.kind}) to the profile patch layer`,
      })
      if (outcome === ALLOWED_ONCE) {
        approvalPath = 'harness-approval'
      } else if (outcome === 'rejected') {
        throw new Error('dsh-mcp-panel: the profile write was rejected')
      } else if (outcome === 'cancelled') {
        throw new Error('dsh-mcp-panel: approval for the profile write was cancelled')
      } else {
        throw new Error('dsh-mcp-panel: no approval channel is available for the profile write')
      }
    }
    if (approvalPath === null) {
      if (confirmed !== true) {
        throw new Error('dsh-mcp-panel: the profile write needs confirmation — review the fragment and confirm in the console')
      }
      approvalPath = 'interactive-confirmation'
    }

    const { backupPath, bytes } = await appendPatchFragment(file, fragment, this.config.backupCount)
    return {
      file,
      backupPath,
      approvalPath,
      bytes,
      ops: 1,
      note: 'The web surface hot-reloads cordis.patch.yml edits; other surfaces restart.',
    }
  }

  /**
   * Run one `mcp__*` tool through the OFFICIAL pipeline
   * (`ctx.tools.execute`): pre-execute permission policy, approval asks,
   * guards, the tool body, and post-execute all apply exactly as for model
   * calls. Exported by `mcpPanel/callTool`; results are panel-only and never
   * enter model context.
   *
   * @param requestJson - JSON of `{ serverName, toolName, argsJson }`.
   * @param sessionId - optional current session for approval routing.
   * @returns the capped trial result.
   */
  async callTool(requestJson: string, sessionId: string | undefined): Promise<McpTrialResultWire> {
    if (!this.config.trialEnabled) {
      throw new Error('dsh-mcp-panel: the tool trial console is disabled (config.trialEnabled: false)')
    }
    let request: unknown
    try {
      request = JSON.parse(requestJson)
    } catch {
      throw new Error('dsh-mcp-panel: requestJson is not valid JSON')
    }
    const problem = validateTrialRequest(request)
    if (problem !== null) throw new Error(`dsh-mcp-panel: ${problem}`)
    return this.trialCaller.runTrialCall(
      this.ctx.tools,
      agentsOf(this.ctx),
      sessionId,
      request as McpTrialRequest,
      { timeoutMs: this.config.trialTimeoutMs, maxResultChars: this.config.trialMaxResultChars },
    )
  }

  /** Resolve one wire op against the live loader facts. */
  private resolveOp(opJson: string): McpPatchResolution {
    let op: unknown
    try {
      op = JSON.parse(opJson)
    } catch {
      throw new Error('dsh-mcp-panel: opJson is not valid JSON')
    }
    const rawFor = new Map<string, unknown>()
    const viewFor = new Map<string, ReturnType<typeof configViewOf>>()
    const existingIds = new Set<string>()
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.name !== MCP_CLIENT_MODULE) continue
      const entryId = entry.options.id
      rawFor.set(entryId, entry.options.config)
      viewFor.set(entryId, configViewOf(entry.options.config, `entry:${entryId}`))
      existingIds.add(entryId)
    }
    return resolvePatchOp(op, rawFor, viewFor, existingIds)
  }

  /** Render validation issues as one actionable error. */
  private issueError(resolution: Extract<McpPatchResolution, { ok: false }>): Error {
    return new Error(`dsh-mcp-panel: invalid patch operation — ${resolution.issues.map(issue => issue.text).join(' ')}`)
  }

  /** One passive-probe sweep over every configured streamable-http server. */
  private async runPassiveProbes(): Promise<void> {
    if (this.passiveRunning) return
    this.passiveRunning = true
    try {
      for (const entry of this.ctx.loader.entries()) {
        if (entry.options.name !== MCP_CLIENT_MODULE) continue
        const serverName = serverNameOf(entry.options.config, `entry:${entry.options.id}`)
        const target = this.rawEndpoint(serverName)
        if (target === undefined) continue
        const outcome = await probeEndpoint(target.url, target.headers, this.config.probeTimeoutMs, AbortSignal.timeout(this.config.probeTimeoutMs))
        this.probeStates.set(serverName, { state: outcome.status === 'completed' ? 'reachable' : 'unreachable', checkedAt: Date.now() })
      }
    } finally {
      this.passiveRunning = false
    }
  }

  /**
   * Resolve one server's raw endpoint for the probe tool. Credentials stay
   * inside this return value and are used for the request only — they never
   * reach a snapshot, a log, or a display.
   *
   * @param serverName - configured namespace.
   * @returns the raw URL + configured headers, or `undefined` when the server
   *   is not a configured streamable-http row.
   */
  rawEndpoint(serverName: string): { url: string; headers: Record<string, string> } | undefined {
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.name !== MCP_CLIENT_MODULE) continue
      const config = entry.options.config
      // `entry.options.id` — not `entry.id` — keeps the namespace fallback
      // identical to the snapshot's (`entry:<options.id>`); `entry.id` carries
      // enclosing group prefixes (e.g. `include:`), which would silently break
      // probe targeting for rows nested in groups.
      if (serverNameOf(config, `entry:${entry.options.id}`) !== serverName) continue
      if (typeof config !== 'object' || config === null || Array.isArray(config)) return undefined
      const row = config as Record<string, unknown>
      if (row['transport'] !== 'streamable-http') return undefined
      const url = row['url']
      if (typeof url !== 'string' || url === '') return undefined
      const headersValue = row['headers']
      const headers: Record<string, string> = {}
      if (typeof headersValue === 'object' && headersValue !== null && !Array.isArray(headersValue)) {
        for (const [name, value] of Object.entries(headersValue as Record<string, unknown>)) {
          if (typeof value === 'string') headers[name] = value
        }
      }
      return { url, headers }
    }
    return undefined
  }

  /** Unowned `mcp-probe` background jobs, newest first, sanitized for display. */
  private probeViews(): McpProbeView[] {
    const jobs = this.ctx.get('jobs')
    if (jobs === undefined) return []
    return jobs
      .list()
      .filter(job => job.kind === PROBE_KIND)
      .map(job => ({
        id: job.id,
        serverName: job.label.startsWith(PROBE_LABEL_PREFIX) ? job.label.slice(PROBE_LABEL_PREFIX.length) : job.label,
        // Job registries may grow lifecycle states; anything outside the
        // panel's vocabulary reads `unknown` instead of failing the codec.
        status: KNOWN_JOB_STATUSES.has(job.status) ? job.status as McpProbeView['status'] : 'unknown',
        startedAt: job.startedAt,
        finishedAt: job.finishedAt ?? null,
        detail: job.detail === undefined ? null : sanitizeText(job.detail),
      }))
      .reverse()
      .slice(0, this.config.maxProbes)
  }

  /** Absolute path of the profile patch layer the console writes, or null. */
  private patchFile(): string | null {
    const base = this.ctx.baseUrl
    if (typeof base !== 'string' || base === '') return null
    const dir = base.startsWith('file://') ? fileURLToPath(base) : base
    return join(dir, PROFILE_PATCH_FILENAME)
  }
}

/** Read the optional agent registry face from a context. */
function agentsOf(ctx: Context): McpAgentRegistryFace | undefined {
  const agents = ctx.get('agents')
  if (typeof agents !== 'object' || agents === null) return undefined
  return agents as McpAgentRegistryFace
}

export default McpPanelService
