/**
 * The panel's host service: assembles the read-only MCP snapshot and serves
 * it under the `mcpPanel` Typert Remote namespace (`mcpPanel/status`).
 *
 * Data sources, all read-only:
 * - `ctx.loader` — mcp-client rows (raw config, effective disabled, fiber phase).
 * - `ctx.tools.schemas()` — registered `mcp__<server>__` tool names + descriptions.
 * - the proposed upstream `mcp/status` seam — observed via {@link observe}.
 * - `ctx.jobs` — unowned `mcp-probe` background jobs (panel-only results).
 *
 * Connection status is reported honestly: without upstream observations the
 * view reads `unknown` with `statusSource: 'derived'`; the panel never infers
 * a connection state from tool-registry presence.
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
// Type-only: activates the `mcp-probe` JobKindMap extension.
import type {} from './probe.ts'
import {
  aggregateSnapshot,
  MCP_CLIENT_MODULE,
  serverNameOf,
  type McpLoaderRow,
} from './aggregate.ts'
import { groupMcpTools } from './grouping.ts'
import { probeEndpoint, probeJob, PROBE_KIND } from './probe.ts'
import { sanitizeText } from './sanitize.ts'
import type { McpServerStatus } from './upstream.ts'
import type { McpFiberPhase, McpPanelSnapshot, McpProbeView, ProbeStarted } from './wire.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Read-only MCP management snapshot service (this package). */
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

/** The profile patch-layer filename the enable/disable suggestions name. */
const PROFILE_PATCH_FILENAME = 'cordis.patch.yml'

/** Label prefix written by the `mcp_probe` tool and the panel probe action. */
const PROBE_LABEL_PREFIX = 'mcp_probe '

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
}

/** Defaults for direct (non-Loader) service construction. */
const DEFAULT_SERVICE_CONFIG: McpPanelServiceConfig = {
  probeTimeoutMs: 10_000,
  maxProbes: 10,
  refreshIntervalMs: 0,
  passiveProbeEnabled: false,
  passiveProbeIntervalMs: 60_000,
}

/** Read-only MCP management snapshot service, exported over the `mcpPanel` Remote namespace. */
export class McpPanelService extends TypertRemoteService {
  static inject = ['loader', 'tools']

  /** Latest upstream payload per server namespace. */
  private readonly statuses = new Map<string, McpServerStatus>()
  /** Cumulative reconnect attempts observed per server namespace. */
  private readonly reconnects = new Map<string, number>()
  /** Epoch ms of the latest upstream event receipt per server namespace. */
  private readonly observedAt = new Map<string, number>()
  /** Latest passive-probe reachability per server namespace. */
  private readonly probeStates = new Map<string, { state: 'reachable' | 'unreachable'; checkedAt: number }>()
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
   * Record one upstream `mcp/status` payload (event or query-seed). A
   * `connecting` payload with a positive attempt counts one reconnect.
   *
   * @param payload - post-transition status facts.
   */
  observe(payload: McpServerStatus): void {
    if (typeof payload.serverName !== 'string' || payload.serverName === '') return
    this.statuses.set(payload.serverName, payload)
    this.observedAt.set(payload.serverName, Date.now())
    if (payload.phase === 'connecting' && payload.attempt > 0) {
      this.reconnects.set(payload.serverName, (this.reconnects.get(payload.serverName) ?? 0) + 1)
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
      if (serverNameOf(config, `entry:${entry.id}`) !== serverName) continue
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
        status: job.status,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt ?? null,
        detail: job.detail === undefined ? null : sanitizeText(job.detail),
      }))
      .reverse()
      .slice(0, this.config.maxProbes)
  }

  /** Absolute path of the profile patch layer the suggestions name, or null. */
  private patchFile(): string | null {
    const base = this.ctx.baseUrl
    if (typeof base !== 'string' || base === '') return null
    const dir = base.startsWith('file://') ? fileURLToPath(base) : base
    return join(dir, PROFILE_PATCH_FILENAME)
  }
}

export default McpPanelService
