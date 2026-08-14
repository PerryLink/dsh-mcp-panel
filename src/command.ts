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
export type CommandLanguage = 'en' | 'zh' | 'es' | 'pt' | 'hi'

/** Every display string the renderers emit, per language. */
export interface CommandMessages {
  enabled: string
  disabled: string
  /** State marker for leftover `mcp__` namespaces with no configured row. */
  unconfigured: string
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
  /** Rejection for disable/enable on an unconfigured leftover namespace. */
  noPatchForLeftover: (server: string) => string
  usage: string
  /** Command input hint shown in the command UI. */
  hint: string
  probeStarted: (server: string, jobId: string) => string
  unknownServer: (server: string, known: string) => string
}

/** English output dictionary (default). */
export const EN_MESSAGES: CommandMessages = {
  enabled: 'enabled',
  disabled: 'disabled',
  unconfigured: 'unconfigured',
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
  noPatchForLeftover: server =>
    `"${server}" is not a configured server — its tools come from another plugin's mcp__ namespace, so there is no row to disable or enable.`,
  usage: 'Usage: /mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable | /mcp <server> probe',
  hint: '[server] [tools|disable|enable|probe]',
  probeStarted: (server, jobId) =>
    `Probe started for "${server}" (background job ${jobId}). Read the result in the MCP panel: Settings → Plugins → MCP.`,
  unknownServer: (server, known) =>
    `Unknown MCP server "${server}" (configured: ${known === '' ? 'none' : known})`,
}

/** Simplified Chinese output dictionary. */
export const ZH_MESSAGES: CommandMessages = {
  enabled: '已启用',
  disabled: '已停用',
  unconfigured: '未配置',
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
  noPatchForLeftover: server =>
    `"${server}" 不是已配置的服务器——其工具来自其他插件的 mcp__ 命名空间，没有可停用/启用的条目。`,
  usage: '用法：/mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable | /mcp <server> probe',
  hint: '[server] [tools|disable|enable|probe]',
  probeStarted: (server, jobId) =>
    `已对 "${server}" 启动探测（后台任务 ${jobId}）。结果仅面板可见：设置 → 插件 → MCP。`,
  unknownServer: (server, known) =>
    `未知 MCP 服务器 "${server}"（已配置：${known === '' ? '无' : known}）`,
}

/** Spanish output dictionary. */
export const ES_MESSAGES: CommandMessages = {
  enabled: 'habilitado',
  disabled: 'deshabilitado',
  unconfigured: 'sin configurar',
  status: 'estado',
  reconnects: 'reconexiones',
  lastError: 'último error',
  retryIn: 'reintento en',
  cordisFiberFailed: 'cordis fiber: falló',
  tools: 'herramientas',
  serversHeader: count => `Servidores MCP (${count}):`,
  noServers: 'No hay servidores MCP configurados (sin filas @deepseek-ai/dsh-mcp-client en este perfil).',
  noteNoSeam: 'Nota: el estado de conexión y los conteos de reconexión aún no son observables — @deepseek-ai/dsh-mcp-client no expone una costura de estado.',
  noteProposal: 'Propuesta upstream: docs/upstream-proposal.md (deepseek-harness). Los datos de arriba derivan de la configuración y del registro de herramientas.',
  noTools: server => `Sin herramientas registradas para "${server}" (servidor caído, sincronización fallida o presupuesto de reconexión agotado).`,
  toolsHeader: (server, count) => `Herramientas de "${server}" (${count}, nombres públicos visibles al modelo):`,
  noDescription: '(sin descripción)',
  patchIntro: (action, server, entryId, patchFile) => {
    const verb = action === 'disable' ? 'deshabilitar' : 'habilitar'
    return `Para ${verb} "${server}" (entrada ${entryId}), añade esta línea a la capa de parches del perfil${patchFile === null ? '' : ` (${patchFile})`}:`
  },
  patchNoRuntimeToggle: '@deepseek-ai/dsh-mcp-client no tiene conmutador en tiempo de ejecución; el Loader aplica el parche al recargar.',
  patchReloadPath: 'La superficie web recarga en caliente los cambios de cordis.patch.yml; otras superficies se reinician. Este comando nunca edita tu configuración.',
  noPatchForLeftover: server =>
    `"${server}" no es un servidor configurado — sus herramientas provienen del espacio mcp__ de otro plugin, así que no hay fila que deshabilitar o habilitar.`,
  usage: 'Uso: /mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable | /mcp <server> probe',
  hint: '[server] [tools|disable|enable|probe]',
  probeStarted: (server, jobId) =>
    `Sonda iniciada para "${server}" (tarea en segundo plano ${jobId}). Lee el resultado en el panel MCP: Ajustes → Plugins → MCP.`,
  unknownServer: (server, known) =>
    `Servidor MCP desconocido "${server}" (configurados: ${known === '' ? 'ninguno' : known})`,
}

/** Portuguese output dictionary. */
export const PT_MESSAGES: CommandMessages = {
  enabled: 'habilitado',
  disabled: 'desabilitado',
  unconfigured: 'não configurado',
  status: 'status',
  reconnects: 'reconexões',
  lastError: 'último erro',
  retryIn: 'nova tentativa em',
  cordisFiberFailed: 'cordis fiber: falhou',
  tools: 'ferramentas',
  serversHeader: count => `Servidores MCP (${count}):`,
  noServers: 'Nenhum servidor MCP configurado (nenhuma linha @deepseek-ai/dsh-mcp-client neste perfil).',
  noteNoSeam: 'Nota: o status de conexão e as contagens de reconexão ainda não são observáveis — @deepseek-ai/dsh-mcp-client não expõe uma costura de status.',
  noteProposal: 'Proposta upstream: docs/upstream-proposal.md (deepseek-harness). Os fatos acima derivam da configuração e do registro de ferramentas.',
  noTools: server => `Nenhuma ferramenta registrada para "${server}" (servidor fora do ar, sincronização falhou ou orçamento de reconexão esgotado).`,
  toolsHeader: (server, count) => `Ferramentas de "${server}" (${count}, nomes públicos visíveis ao modelo):`,
  noDescription: '(sem descrição)',
  patchIntro: (action, server, entryId, patchFile) => {
    const verb = action === 'disable' ? 'desabilitar' : 'habilitar'
    return `Para ${verb} "${server}" (entrada ${entryId}), adicione esta linha à camada de patches do perfil${patchFile === null ? '' : ` (${patchFile})`}:`
  },
  patchNoRuntimeToggle: '@deepseek-ai/dsh-mcp-client não tem alternância em tempo de execução; o Loader aplica o patch ao recarregar.',
  patchReloadPath: 'A superfície web recarrega em quente as edições de cordis.patch.yml; outras superfícies reiniciam. Este comando nunca edita sua configuração.',
  noPatchForLeftover: server =>
    `"${server}" não é um servidor configurado — suas ferramentas vêm do namespace mcp__ de outro plugin, então não há linha para desabilitar ou habilitar.`,
  usage: 'Uso: /mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable | /mcp <server> probe',
  hint: '[server] [tools|disable|enable|probe]',
  probeStarted: (server, jobId) =>
    `Sonda iniciada para "${server}" (tarefa em segundo plano ${jobId}). Leia o resultado no painel MCP: Configurações → Plugins → MCP.`,
  unknownServer: (server, known) =>
    `Servidor MCP desconhecido "${server}" (configurados: ${known === '' ? 'nenhum' : known})`,
}

/** Hindi output dictionary. */
export const HI_MESSAGES: CommandMessages = {
  enabled: 'सक्षम',
  disabled: 'अक्षम',
  unconfigured: 'अकॉन्फ़िगर',
  status: 'स्थिति',
  reconnects: 'रीकनेक्ट',
  lastError: 'अंतिम त्रुटि',
  retryIn: 'पुनः प्रयास',
  cordisFiberFailed: 'cordis fiber: विफल',
  tools: 'टूल',
  serversHeader: count => `MCP सर्वर (${count}):`,
  noServers: 'कोई MCP सर्वर कॉन्फ़िगर नहीं (इस प्रोफ़ाइल में कोई @deepseek-ai/dsh-mcp-client पंक्ति नहीं)।',
  noteNoSeam: 'नोट: कनेक्शन स्थिति/रीकनेक्ट गणना अभी देखने योग्य नहीं — @deepseek-ai/dsh-mcp-client कोई स्थिति सीम उजागर नहीं करता।',
  noteProposal: 'अपस्ट्रीम प्रस्ताव: docs/upstream-proposal.md (deepseek-harness)। ऊपर के तथ्य कॉन्फ़िगरेशन और टूल रजिस्ट्री से प्राप्त हैं।',
  noTools: server => `"${server}" के लिए कोई टूल पंजीकृत नहीं (सर्वर डाउन, सिंक विफल या रीकनेक्ट बजट समाप्त)।`,
  toolsHeader: (server, count) => `"${server}" के टूल (${count}, मॉडल-दृश्य सार्वजनिक नाम):`,
  noDescription: '(कोई विवरण नहीं)',
  patchIntro: (action, server, entryId, patchFile) => {
    const verb = action === 'disable' ? 'अक्षम' : 'सक्षम'
    return `"${server}" (एंट्री ${entryId}) को ${verb} करने के लिए प्रोफ़ाइल पैच परत${patchFile === null ? '' : ` (${patchFile})`} में यह पंक्ति जोड़ें:`
  },
  patchNoRuntimeToggle: '@deepseek-ai/dsh-mcp-client के पास रनटाइम टॉगल नहीं है; Loader रीलोड पर पैच लागू करता है।',
  patchReloadPath: 'वेब सतह cordis.patch.yml के बदलाव हॉट-रीलोड करती है; अन्य सतहें रीस्टार्ट करें। यह कमांड आपका कॉन्फ़िगरेशन कभी नहीं बदलती।',
  noPatchForLeftover: server =>
    `"${server}" कॉन्फ़िगर किया गया सर्वर नहीं है — इसके टूल दूसरे प्लगइन के mcp__ नेमस्पेस से आते हैं, इसलिए अक्षम/सक्षम करने के लिए कोई पंक्ति नहीं है।`,
  usage: 'उपयोग: /mcp | /mcp <server> | /mcp <server> tools | /mcp <server> disable | /mcp <server> enable | /mcp <server> probe',
  hint: '[server] [tools|disable|enable|probe]',
  probeStarted: (server, jobId) =>
    `"${server}" के लिए प्रोब शुरू (बैकग्राउंड जॉब ${jobId})। परिणाम MCP पैनल में पढ़ें: सेटिंग्स → प्लगइन्स → MCP।`,
  unknownServer: (server, known) =>
    `अज्ञात MCP सर्वर "${server}" (कॉन्फ़िगर: ${known === '' ? 'कोई नहीं' : known})`,
}

/** Every output dictionary indexed by the configured language. */
const MESSAGES: Record<CommandLanguage, CommandMessages> = {
  en: EN_MESSAGES,
  zh: ZH_MESSAGES,
  es: ES_MESSAGES,
  pt: PT_MESSAGES,
  hi: HI_MESSAGES,
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
  // A leftover namespace (foreign mcp__ tools, no loader row) is unconfigured,
  // not disabled — its config facts do not exist. Keep this in sync with the
  // tab's `connectionBadge`.
  const state = view.entryId === '' ? messages.unconfigured : view.enabled ? messages.enabled : messages.disabled
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
  | { readonly kind: 'server'; readonly server: string; readonly action: 'detail' | 'tools' | 'disable' | 'enable' | 'probe' }
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
  if (action === 'tools' || action === 'disable' || action === 'enable' || action === 'probe') {
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
  const messages = MESSAGES[language] ?? EN_MESSAGES
  return {
    name: 'mcp',
    description: 'Show MCP server status, tools, and enable/disable patch suggestions (read-only)',
    input: { hint: messages.hint },
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
          text: messages.unknownServer(parsed.server, known),
        }
      }
      switch (parsed.action) {
        case 'tools': return { kind: 'success', text: renderTools(view, messages) }
        case 'disable':
        case 'enable': {
          // Leftover namespaces have no loader row: a patch suggestion with an
          // empty entry id would be malformed, so refuse instead of emitting
          // `- set: { id: , … }`.
          if (view.entryId === '') return { kind: 'error', text: messages.noPatchForLeftover(parsed.server) }
          return { kind: 'success', text: renderPatchSuggestion(view, parsed.action, snapshot.patchFile, messages) }
        }
        case 'probe': {
          // The service throws for stdio rows and for a missing job registry;
          // the command reports those as errors without touching any config.
          try {
            const started = service.probe(parsed.server)
            return { kind: 'success', text: messages.probeStarted(parsed.server, started.jobId) }
          } catch (error) {
            return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
          }
        }
        default: return { kind: 'success', text: renderServer(view, messages) }
      }
    },
  }
}
