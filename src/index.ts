/**
 * `dsh-mcp-panel` — the MCP management console for the official DeepSeek
 * Harness MCP client (`@deepseek-ai/dsh-mcp-client`).
 *
 * The official client stays the ONLY bridge — one plugin instance per MCP
 * server in the profile's composition. This plugin is its experience layer:
 *
 * - the `mcpPanel` Remote service: status snapshot (loader rows + tool
 *   registry + the shipped upstream `mcp/status` seam), plus the console
 *   actions `previewPatch` / `writePatch` (append-only profile-patch CRUD
 *   with approval gate + automatic backups) and `callTool` (a tool trial
 *   through the OFFICIAL `ctx.tools.execute` pipeline, so permission policy
 *   and approval stay in force);
 * - the `/mcp` command where a command registry exists (status, tools,
 *   health diagnostics, patch suggestions, and pipeline trial calls);
 * - the optional `mcp_probe` background-job tool where a job registry exists;
 * - the browser half: an "MCP" tab in Settings → Plugins with server CRUD,
 *   the tool trial console, health diagnostics, and probes.
 *
 * Hard boundaries kept intact: configured env/header VALUES never enter a
 * snapshot; generated patches contain no `!!js` expressions; writes are
 * append-only and always backed up; the panel never fabricates connection
 * state; the panel injects NO prompt sections (tool descriptions only, in
 * the official client's minimal style).
 *
 * Function plugin — no default export (the Loader unwraps
 * `exports.default ?? exports`).
 *
 * @module dsh-mcp-panel
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-jobs'
import { Config, resolveConfig } from './config.ts'
import { mcpCommand } from './command.ts'
import { mcpProbeTool } from './probe.ts'
import { McpPanelService } from './service.ts'
import { MCP_STATUS_EVENT, type McpStatusQuery } from './upstream.ts'

export const name = 'mcp-panel'

/** Hard services: the facts the console reads. `commands`/`jobs` are optional children. */
export const inject = ['tools', 'loader']

export { Config, resolveConfig } from './config.ts'
export { McpPanelService } from './service.ts'
export { mcpCommand, parseMcpArgs, renderList, renderPatchSuggestion, renderServer, renderTools, renderTrialCall, renderHealth } from './command.ts'
export { groupMcpTools, countServerTools } from './grouping.ts'
export { aggregateServerView, aggregateSnapshot, configViewOf, deriveTarget, serverNameOf } from './aggregate.ts'
export { sanitizeError, sanitizeText, sanitizeUrl } from './sanitize.ts'
export { diagnoseServer, type McpDiagnostic, type McpSuggestionCode, type McpHealthFacts } from './diagnostics.ts'
export { probeEndpoint, probeJob, mcpProbeTool } from './probe.ts'
export {
  validateServerConfig,
  mergeServerConfig,
  renderPatchFragment,
  resolvePatchOp,
  nextEntryId,
  defaultEntryId,
  yamlScalar,
  type McpServerConfigInput,
  type McpPatchOp,
  type McpPatchResolution,
} from './patch.ts'
export { appendPatchFragment } from './write.ts'
export { createTrialCaller, validateTrialRequest, type McpTrialRequest, type McpTrialResult } from './trial.ts'
export { MCP_STATUS_EVENT, type McpStatusPayload, type McpStatusQuery, type McpServerStatus } from './upstream.ts'
export type * from './wire.ts'

/**
 * Mount the console: the snapshot/action service, the upstream status seam
 * consumer, the `/mcp` command (when commands exist), and the probe tool
 * (when enabled and a job registry exists).
 *
 * @param ctx - context carrying tools + loader.
 * @param config - raw loader config; defaults applied through {@link resolveConfig}.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const resolved = resolveConfig(config)

  // The service has injects, so its fiber activates asynchronously — await it
  // before reading the instance the command and probe closures capture.
  await ctx.plugin(McpPanelService, {
    probeTimeoutMs: resolved.probeTimeoutMs,
    maxProbes: resolved.maxProbes,
    refreshIntervalMs: resolved.refreshIntervalMs,
    passiveProbeEnabled: resolved.passiveProbeEnabled,
    passiveProbeIntervalMs: resolved.passiveProbeIntervalMs,
    trialEnabled: resolved.trialEnabled,
    trialTimeoutMs: resolved.trialTimeoutMs,
    trialMaxResultChars: resolved.trialMaxResultChars,
    writeEnabled: resolved.writeEnabled,
    backupCount: resolved.backupCount,
  })
  const service = ctx.get('mcpPanel') as McpPanelService

  // Consume the shipped upstream seam: live events plus a one-shot query
  // seed from the (optional) status service when it is already mounted.
  ctx.on(MCP_STATUS_EVENT, (payload) => { service.observe(payload) })
  const query = ctx.get('mcpStatus') as McpStatusQuery | undefined
  if (query !== undefined) {
    for (const status of query.list()) service.observe(status)
  }

  // The /mcp command: only where a human-command registry is composed.
  ctx.inject(['commands'], (scope) => {
    scope.effect(() => scope.commands.register(mcpCommand(service, resolved.outputLanguage)), 'dsh-mcp-panel: /mcp command')
  })

  // The jobs controller serves the panel probe action AND the optional tool.
  ctx.inject(['jobs'], (scope) => {
    scope.effect(() => scope.jobs.attachController('dsh-mcp-panel'), 'dsh-mcp-panel: jobs controller')
    if (resolved.probeEnabled) {
      scope.effect(() => scope.tools.register(mcpProbeTool(service, scope.jobs, resolved.probeTimeoutMs)), 'dsh-mcp-panel: probe tool')
    }
  })
}
