/**
 * `dsh-mcp-panel`, browser half: mounts the `mcpPanel` Remote contribution,
 * then registers the MCP management console tab into the Plugins settings
 * section (`settings.plugins.tab`, id `mcp`). All data arrives through the
 * `remote.mcpPanel` namespace — the tab issues no other RPC and holds no
 * state of its own beyond expansion, the editor/trial forms, and the last
 * loaded snapshot. The current session id (for approval routing) is read
 * from the sessions store at call time.
 *
 * @module dsh-mcp-panel/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the 'settings.plugins.tab' SlotMap declaration into this
// program so the tab registration typechecks against the real declaration.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { McpPanelTab, type McpPanelTabInjected } from './McpPanelTab.tsx'
// The harness locale registry accepts only the 'en' | 'zh' UI language codes
// today (its LocaleDictOf face), so the tab ships those two dictionaries and
// follows the app's UI language. The `/mcp` command language is a separate
// plugin config (`outputLanguage`) with its own five-language dictionaries.
import { en, zh, type McpPanelLocaleKey } from './locales.ts'
import { MCP_PANEL_REMOTE } from './remote.ts'
import { installPanelStyles } from './styles.ts'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  McpPanelSnapshot,
  McpTrialResultWire,
  PatchPreview,
  PatchWriteResult,
  ProbeStarted,
} from '../wire.ts'

export type { McpPanelTabInjected, McpPanelTabProps } from './McpPanelTab.tsx'
export type { McpPanelLocaleKey } from './locales.ts'
export { presentMcpPanel, connectionBadge, probeBadge } from './present.ts'
export type { PresentedMcpPanel, PresentedProbeRow, PresentedServerRow, BadgeTone } from './present.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MCP management console copy. */
    'settings.mcpPanel': McpPanelLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.mcpPanel'

/** Plugin name: matches the package name, the graph row id, and the bundle id. */
export const name = 'dsh-mcp-panel'

/** Services the console reads; `remote.mcpPanel` appears once this plugin mounts its contribution. */
export const inject = ['slots', 'locale', 'remote', 'sessions']

/**
 * Browser plugin body: dictionaries, the scoped stylesheet, the Remote
 * contribution mount, and the settings tab registration.
 *
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<void> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mcp-panel: dictionaries')
  ctx.effect(() => installPanelStyles(), 'dsh-mcp-panel: stylesheet')

  // $mount registers the 'remote.mcpPanel' namespace service and owns its
  // removal for this fiber's lifetime.
  await ctx.remote.$mount(MCP_PANEL_REMOTE)

  ctx.inject(['remote.mcpPanel'], (scope) => {
    const t = scope.locale.bind(NS)
    const unwrap = <T>(result: RemoteResult<T>, method: string): T => {
      if (!result.ok) {
        throw new Error(`mcpPanel.${method} failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    }
    const status: McpPanelTabInjected['status'] = async () =>
      unwrap<McpPanelSnapshot>(await scope.remote.mcpPanel.status(), 'status')
    const probe: McpPanelTabInjected['probe'] = async (serverName) =>
      unwrap<ProbeStarted>(await scope.remote.mcpPanel.probe(serverName), 'probe')
    const previewPatch: McpPanelTabInjected['previewPatch'] = async (opJson) =>
      unwrap<PatchPreview>(await scope.remote.mcpPanel.previewPatch(opJson), 'previewPatch')
    const writePatch: McpPanelTabInjected['writePatch'] = async (opJson, confirmed) =>
      unwrap<PatchWriteResult>(await scope.remote.mcpPanel.writePatch(opJson, confirmed, currentSessionId(scope.get('sessions'))), 'writePatch')
    const callTool: McpPanelTabInjected['callTool'] = async (requestJson) =>
      unwrap<McpTrialResultWire>(await scope.remote.mcpPanel.callTool(requestJson, currentSessionId(scope.get('sessions'))), 'callTool')
    scope.slots.inject('settings.plugins.tab', () => scope.slots.register({
      name: 'settings.plugins.tab',
      id: 'mcp',
      order: 30,
      label: () => t('tab'),
      locale: NS,
      inject: (): McpPanelTabInjected => ({ status, probe, previewPatch, writePatch, callTool }),
    }, McpPanelTab))
  })
}

/**
 * Read the current session id from the sessions store face (structural:
 * the store shape differs across harness lines, so only the leaf is read).
 */
function currentSessionId(sessions: unknown): string | undefined {
  try {
    const list = (sessions as { list?: unknown } | null)?.list
    if (typeof list !== 'object' || list === null) return undefined
    const getSnapshot = (list as { getSnapshot?: unknown }).getSnapshot
    if (typeof getSnapshot !== 'function') return undefined
    const current = (getSnapshot as () => { current?: unknown })().current
    return typeof current === 'string' ? current : undefined
  } catch {
    return undefined
  }
}
