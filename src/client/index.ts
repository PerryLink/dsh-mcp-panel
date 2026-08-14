/**
 * `dsh-mcp-panel`, browser half: mounts the `mcpPanel` Remote contribution,
 * then registers a read-only "MCP" tab into the Plugins settings section
 * (`settings.plugins.tab`, id `mcp`). All data arrives through the
 * `remote.mcpPanel` namespace — the tab issues no other RPC and holds no
 * state of its own beyond expansion and the last loaded snapshot.
 *
 * @module dsh-mcp-panel/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the 'settings.plugins.tab' SlotMap declaration into this
// program so the tab registration typechecks against the real declaration.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { McpPanelTab, type McpPanelTabInjected } from './McpPanelTab.tsx'
import { en, zh, type McpPanelLocaleKey } from './locales.ts'
import { MCP_PANEL_REMOTE } from './remote.ts'
import { installPanelStyles } from './styles.ts'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { McpPanelSnapshot } from '../wire.ts'

export type { McpPanelTabInjected, McpPanelTabProps } from './McpPanelTab.tsx'
export type { McpPanelLocaleKey } from './locales.ts'
export { presentMcpPanel, connectionBadge, probeBadge } from './present.ts'
export type { PresentedMcpPanel, PresentedProbeRow, PresentedServerRow, BadgeTone } from './present.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MCP management tab copy. */
    'settings.mcpPanel': McpPanelLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.mcpPanel'

/** Plugin name: matches the package name, the graph row id, and the bundle id. */
export const name = 'dsh-mcp-panel'

/** Services the tab reads; `remote.mcpPanel` appears once this plugin mounts its contribution. */
export const inject = ['slots', 'locale', 'remote']

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
    const status: McpPanelTabInjected['status'] = async () => {
      const result: RemoteResult<McpPanelSnapshot> = await scope.remote.mcpPanel.status()
      if (!result.ok) {
        throw new Error(`mcpPanel.status failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    }
    scope.slots.inject('settings.plugins.tab', () => scope.slots.register({
      name: 'settings.plugins.tab',
      id: 'mcp',
      order: 30,
      label: () => t('tab'),
      locale: NS,
      inject: (): McpPanelTabInjected => ({ status }),
    }, McpPanelTab))
  })
}
