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
 * Renderers are pure functions of the snapshot plus a message dictionary, so
 * the output language is a config choice (`outputLanguage: en|zh`) without
 * touching the command lifecycle.
 *
 * @module dsh-mcp-panel/command
 */

import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import type { McpPanelService } from './service.ts'
import type { McpPanelSnapshot, McpServerView } from './wire.ts'

/** Placeholder for fields the panel cannot observe yet. */
const UNKNOWN = '—'

/** Display language for the `/mcp` output. */
export type CommandLanguage = 'en' | 'zh'

/** Every display string the renderers emit, per language. */
export interface CommandMessages {
  enabled: string
  disabled: string
  status: string
  reconnects: string
  lastError: string
  retryIn: string
  cordisFiberFailed: string
  tools: string
  serversHeader: (count: number) => string
  noServers: string
  noteNoSeam: string
  noteProposal: string
  noTools: (server: string) => string
  toolsHeader: (server: string, count: number) => string
  noDescription: string
  patchIntro: (action: string, server: string, entryId: string, patchFile: string | null) => string
  patchNoRuntimeToggle: string
  patchReloadPath: string
  usage: string
}

/** English output dictionary (default). */
export const EN_MESSAGES: CommandMessages = {
  enabled: 'enabled',
  disabled: 'disabled',
  status: 'status',
  reconnects: 'reconnects',
  lastError: 'last error',
  retryIn: 'retry in',
  cordisFiberFailed: 'cordis fiber: failed',
  tools: 'tools',
  serversHeader: count => `MCP servers (${count}):`,
  noServers: 'No MCP servers configured (no @deepseek-ai/dsh-mcp-client rows in this profile).',
  noteNoSeam: 'Note: connection status/reconnect counts are not observable yet — @deepseek-ai/dsh-mcp-client exposes no status seam.',
  noteProposal: 'Upstream proposal: docs/upstream-proposal.md (deepseek-harness). Row facts above are derived from config and the tool registry.',
  noTools: server => `No tools registered for "${server}" (server down, sync failed, or reconnect budget exhausted).`,
  toolsHeader: (server, count) => `Tools of "${server}" (${count}, model-visible public names):`,
  noDescription: '(no description)',
  patchIntro: (action, server, entryId, patchFile) =>
    `To ${action} "${server}" (entry ${entryId}), add this line to the profile patch layer${patchFile === null ? '' : ` (${patchFile})`}:`,
  patchNoRuntimeToggle: '@deepseek-ai/dsh-mcp-client has no runtime toggle; the Loader applies the patch on reload.',
  patchReloadPath: 'The web surface hot-reloads cordis.patch.yml edits; other surfaces restart. This command never edits your config.',
  usage: 'Usage: /mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable',
}

/** Simplified Chinese output dictionary. */
export const ZH_MESSAGES: CommandMessages = {
  enabled: '已启用',
  disabled: '已停用',
  status: '状态',
  reconnects: '重连',
  lastError: '最近错误',
  retryIn: '重试等待',
  cordisFiberFailed: 'cordis fiber: 失败',
  tools: '工具',
  serversHeader: count => `MCP 服务器（${count} 个）：`,
  noServers: '此 profile 未配置官方 MCP 服务器（@deepseek-ai/dsh-mcp-client 行）。',
  noteNoSeam: '说明：连接状态/重连计数尚不可观测——@deepseek-ai/dsh-mcp-client 未暴露状态 seam。',
  noteProposal: '上游提案：docs/upstream-proposal.md（deepseek-harness）。以上行数据来自配置与工具注册表。',
  noTools: server => `"${server}" 未注册任何工具（服务器宕机、同步失败或重连预算耗尽）。`,
  toolsHeader: (server, count) => `"${server}" 的工具（${count} 个，模型可见公开名）：`,
  noDescription: '（无描述）',
  patchIntro: (action, server, entryId, patchFile) => {
    const verb = action === 'disable' ? '停用' : '启用'
    return `要${verb} "${server}"（条目 ${entryId}），把下面这行加到 profile patch 层${patchFile === null ? '' : `（${patchFile}）`}：`
  },
  patchNoRuntimeToggle: '@deepseek-ai/dsh-mcp-client 没有运行时开关；Loader 在重载时应用该 patch。',
  patchReloadPath: 'web 面板会热重载 cordis.patch.yml 的修改；其他面板重启生效。本命令绝不修改你的配置。',
  usage: '用法：/mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable',
}

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
 * @param messages - the output dictionary.
 * @returns the single display line.
 */
export function renderServer(view: McpServerView, messages: CommandMessages = EN_MESSAGES): string {
  const state = view.enabled ? messages.enabled : messages.disabled
  const details = [
    `${messages.status}: ${statusText(view)}`,
    `${messages.reconnects}: ${reconnectText(view)}`,
    `${messages.lastError}: ${lastErrorText(view)}`,
  ]
  if (view.fiberPhase === 'failed') details.push(messages.cordisFiberFailed)
  if (view.delayMs !== null) details.push(`${messages.retryIn} ${view.delayMs}ms`)
  return `- ${view.serverName} [${view.entryId}] ${view.transport} ${view.target} | ${view.toolCount} ${messages.tools} | ${state} | ${details.join(' | ')}`
}

/**
 * Render the no-argument listing.
 *
 * @param snapshot - the current snapshot.
 * @param messages - the output dictionary.
 * @returns the full listing text.
 */
export function renderList(snapshot: McpPanelSnapshot, messages: CommandMessages = EN_MESSAGES): string {
  if (snapshot.servers.length === 0) {
    return messages.noServers
  }
  const lines = [messages.serversHeader(snapshot.servers.length)]
  for (const view of snapshot.servers) lines.push(renderServer(view, messages))
  if (!snapshot.observed) {
    lines.push(messages.noteNoSeam, messages.noteProposal)
  }
  return lines.join('\n')
}

/**
 * Render the tool list for one server.
 *
 * @param view - the assembled server view.
 * @param messages - the output dictionary.
 * @returns the tool listing text.
 */
export function renderTools(view: McpServerView, messages: CommandMessages = EN_MESSAGES): string {
  if (view.tools.length === 0) {
    return messages.noTools(view.serverName)
  }
  const lines = [messages.toolsHeader(view.serverName, view.tools.length)]
  for (const tool of view.tools) {
    const description = tool.description.trim() === '' ? messages.noDescription : tool.description
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
 * @param messages - the output dictionary.
 * @returns the suggestion text.
 */
export function renderPatchSuggestion(
  view: McpServerView,
  action: 'disable' | 'enable',
  patchFile: string | null,
  messages: CommandMessages = EN_MESSAGES,
): string {
  const disabled = action === 'disable'
  const patch = `- set: { id: ${view.entryId}, name: '@deepseek-ai/dsh-mcp-client', disabled: ${disabled} }`
  const lines = [
    messages.patchIntro(action, view.serverName, view.entryId, patchFile),
    '',
    patch,
    '',
    messages.patchNoRuntimeToggle,
    messages.patchReloadPath,
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

/**
 * Build the `/mcp` command definition over one service instance.
 *
 * @param service - the panel service supplying snapshots.
 * @param language - output language for the rendered text.
 * @returns the registration-ready definition.
 */
export function mcpCommand(service: McpPanelService, language: CommandLanguage = 'en'): CommandDefinition {
  const messages = language === 'zh' ? ZH_MESSAGES : EN_MESSAGES
  return {
    name: 'mcp',
    description: 'Show MCP server status, tools, and enable/disable patch suggestions (read-only)',
    input: { hint: '[server] [tools|disable|enable]' },
    handler: ({ rawInput }) => {
      const parsed = parseMcpArgs(rawInput)
      if (parsed.kind === 'usage') return { kind: 'error', text: messages.usage }
      const snapshot = service.status()
      if (parsed.kind === 'list') return { kind: 'success', text: renderList(snapshot, messages) }
      const view = snapshot.servers.find(candidate => candidate.serverName === parsed.server)
      if (view === undefined) {
        const known = snapshot.servers.map(candidate => candidate.serverName).join(', ')
        return {
          kind: 'error',
          text: `Unknown MCP server "${parsed.server}" (configured: ${known === '' ? 'none' : known})`,
        }
      }
      switch (parsed.action) {
        case 'tools': return { kind: 'success', text: renderTools(view, messages) }
        case 'disable': return { kind: 'success', text: renderPatchSuggestion(view, 'disable', snapshot.patchFile, messages) }
        case 'enable': return { kind: 'success', text: renderPatchSuggestion(view, 'enable', snapshot.patchFile, messages) }
        default: return { kind: 'success', text: renderServer(view, messages) }
      }
    },
  }
}
