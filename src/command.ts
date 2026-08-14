/**
 * The `/mcp` human command over the official MCP client's observable facts.
 * Output is a standard `CommandResult` (model-readable, logged by the
 * commands service as `command/run` + `command/done`, so every line is
 * reconstructable from the session log).
 *
 * - `/mcp` — one row per server: transport, target, tool count, connection
 *   status (honest: `unknown` until the upstream seam ships), recent error,
 *   reconnect count.
 * - `/mcp <server>` — that server's row.
 * - `/mcp <server> tools` — model-visible tool names + one-line descriptions.
 * - `/mcp <server> disable|enable` — a controlled patch suggestion (the exact
 *   `cordis.patch.yml` line + the reload path). The command never edits
 *   configuration files and never fakes a runtime effect.
 *
 * All renderers are pure functions of the snapshot for direct unit coverage.
 *
 * @module dsh-mcp-panel/command
 */

import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import type { McpPanelService } from './service.ts'
import type { McpPanelSnapshot, McpServerView } from './wire.ts'

/** Placeholder for fields the panel cannot observe yet. */
const UNKNOWN = '—'

/** One-line count of the reconnection attempts observed this process. */
function reconnectText(view: McpServerView): string {
  return view.reconnectCount < 0 ? UNKNOWN : String(view.reconnectCount)
}

/** One-line recent-error summary. */
function lastErrorText(view: McpServerView): string {
  return view.lastError ?? UNKNOWN
}

/** Human status phrase with its provenance. */
function statusText(view: McpServerView): string {
  const phase = view.phase === 'unknown' ? 'unknown' : view.phase
  return `${phase} (source: ${view.statusSource})`
}

/**
 * Render one server row: `name [entryId] transport target | N tools | …`.
 *
 * @param view - the assembled server view.
 * @returns the single display line.
 */
export function renderServer(view: McpServerView): string {
  const state = view.enabled ? 'enabled' : 'disabled'
  const details = [
    `status: ${statusText(view)}`,
    `reconnects: ${reconnectText(view)}`,
    `last error: ${lastErrorText(view)}`,
  ]
  if (view.fiberPhase === 'failed') details.push('cordis fiber: failed')
  if (view.delayMs !== null) details.push(`retry in ${view.delayMs}ms`)
  return `- ${view.serverName} [${view.entryId}] ${view.transport} ${view.target} | ${view.toolCount} tools | ${state} | ${details.join(' | ')}`
}

/**
 * Render the no-argument listing.
 *
 * @param snapshot - the current snapshot.
 * @returns the full listing text.
 */
export function renderList(snapshot: McpPanelSnapshot): string {
  if (snapshot.servers.length === 0) {
    return 'No MCP servers configured (no @deepseek-ai/dsh-mcp-client rows in this profile).'
  }
  const lines = [`MCP servers (${snapshot.servers.length}):`]
  for (const view of snapshot.servers) lines.push(renderServer(view))
  if (!snapshot.observed) {
    lines.push(
      'Note: connection status/reconnect counts are not observable yet — @deepseek-ai/dsh-mcp-client exposes no status seam.',
      'Upstream proposal: docs/upstream-proposal.md (deepseek-harness). Row facts above are derived from config and the tool registry.',
    )
  }
  return lines.join('\n')
}

/**
 * Render the tool list for one server.
 *
 * @param view - the assembled server view.
 * @returns the tool listing text.
 */
export function renderTools(view: McpServerView): string {
  if (view.tools.length === 0) {
    return `No tools registered for "${view.serverName}" (server down, sync failed, or reconnect budget exhausted).`
  }
  const lines = [`Tools of "${view.serverName}" (${view.tools.length}, model-visible public names):`]
  for (const tool of view.tools) {
    const description = tool.description.trim() === '' ? '(no description)' : tool.description
    lines.push(`- ${tool.name} — ${description}`)
  }
  return lines.join('\n')
}

/**
 * Render the controlled enable/disable patch suggestion. Reads only; the user
 * applies the line themselves. The web surface hot-reloads the profile patch
 * layer; other surfaces apply it on restart.
 *
 * @param view - the assembled server view.
 * @param action - which direction the suggestion flips.
 * @param patchFile - absolute profile patch-layer path, or null when unknown.
 * @returns the suggestion text.
 */
export function renderPatchSuggestion(view: McpServerView, action: 'disable' | 'enable', patchFile: string | null): string {
  const disabled = action === 'disable'
  const patch = `- set: { id: ${view.entryId}, name: '@deepseek-ai/dsh-mcp-client', disabled: ${disabled} }`
  const lines = [
    `To ${action} "${view.serverName}" (entry ${view.entryId}), add this line to the profile patch layer${patchFile === null ? '' : ` (${patchFile})`}:`,
    '',
    patch,
    '',
    '@deepseek-ai/dsh-mcp-client has no runtime toggle; the Loader applies the patch on reload.',
    'The web surface hot-reloads cordis.patch.yml edits; other surfaces restart. This command never edits your config.',
  ]
  return lines.join('\n')
}

/** Parsed `/mcp` arguments. */
export type McpCommandArgs =
  | { readonly kind: 'list' }
  | { readonly kind: 'server'; readonly server: string; readonly action: 'detail' | 'tools' | 'disable' | 'enable' }
  | { readonly kind: 'usage' }

/**
 * Parse the free-form command input.
 *
 * @param rawInput - text after `/mcp`, including leading whitespace.
 * @returns the parsed intent; malformed input becomes `usage`.
 */
export function parseMcpArgs(rawInput: string): McpCommandArgs {
  const tokens = rawInput.trim().split(/\s+/u).filter(token => token !== '')
  if (tokens.length === 0) return { kind: 'list' }
  const server = tokens[0]
  const action = tokens[1]
  if (action === undefined) return { kind: 'server', server: server ?? '', action: 'detail' }
  if (tokens.length !== 2) return { kind: 'usage' }
  if (action === 'tools' || action === 'disable' || action === 'enable') {
    return { kind: 'server', server: server ?? '', action }
  }
  return { kind: 'usage' }
}

const USAGE = 'Usage: /mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable'

/**
 * Build the `/mcp` command definition over one service instance.
 *
 * @param service - the panel service supplying snapshots.
 * @returns the registration-ready definition.
 */
export function mcpCommand(service: McpPanelService): CommandDefinition {
  return {
    name: 'mcp',
    description: 'Show MCP server status, tools, and enable/disable patch suggestions (read-only)',
    input: { hint: '[server] [tools|disable|enable]' },
    handler: ({ rawInput }) => {
      const parsed = parseMcpArgs(rawInput)
      if (parsed.kind === 'usage') return { kind: 'error', text: USAGE }
      const snapshot = service.status()
      if (parsed.kind === 'list') return { kind: 'success', text: renderList(snapshot) }
      const view = snapshot.servers.find(candidate => candidate.serverName === parsed.server)
      if (view === undefined) {
        const known = snapshot.servers.map(candidate => candidate.serverName).join(', ')
        return {
          kind: 'error',
          text: `Unknown MCP server "${parsed.server}" (configured: ${known === '' ? 'none' : known})`,
        }
      }
      switch (parsed.action) {
        case 'tools': return { kind: 'success', text: renderTools(view) }
        case 'disable': return { kind: 'success', text: renderPatchSuggestion(view, 'disable', snapshot.patchFile) }
        case 'enable': return { kind: 'success', text: renderPatchSuggestion(view, 'enable', snapshot.patchFile) }
        default: return { kind: 'success', text: renderServer(view) }
      }
    },
  }
}
