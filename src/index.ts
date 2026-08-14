/**
 * `dsh-mcp-panel` — read-only runtime management panel for the official
 * DeepSeek Harness MCP client (`@deepseek-ai/dsh-mcp-client`).
 *
 * Host half: mounts the `mcpPanel` Remote service (loader rows + tool
 * registry + upstream `mcp/status` observations), registers the `/mcp`
 * command where a command registry exists, and optionally registers the
 * `mcp_probe` background-job tool where a job registry exists. The panel
 * never edits configuration files and never fabricates connection state:
 * without the proposed upstream status seam every connection field reads
 * `unknown` with `statusSource: 'derived'`.
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

/** Hard services: the facts the panel reads. `commands`/`jobs` are optional children. */
export const inject = ['tools', 'loader']

export { Config, resolveConfig } from './config.ts'
export { McpPanelService } from './service.ts'
export { mcpCommand, parseMcpArgs, renderList, renderPatchSuggestion, renderServer, renderTools } from './command.ts'
export { groupMcpTools, countServerTools } from './grouping.ts'
export { aggregateServerView, aggregateSnapshot, deriveTarget, serverNameOf } from './aggregate.ts'
export { sanitizeError, sanitizeText, sanitizeUrl } from './sanitize.ts'
export { probeEndpoint, probeJob, mcpProbeTool } from './probe.ts'
export { MCP_STATUS_EVENT, type McpStatusPayload, type McpStatusQuery, type McpServerStatus } from './upstream.ts'
export type * from './wire.ts'

/**
 * Mount the panel: the snapshot service, the upstream status seam consumer,
 * the `/mcp` command (when commands exist), and the probe tool (when enabled
 * and a job registry exists).
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
  })
  const service = ctx.get('mcpPanel') as McpPanelService

  // Consume the proposed upstream seam: live events plus a one-shot query
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
