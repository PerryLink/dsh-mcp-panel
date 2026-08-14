/**
 * The client-side Remote face of the `mcpPanel` namespace: the hand-written
 * `TypertRemoteContribution` mounted through `ctx.remote.$mount`, plus the
 * declaration merging that types `ctx.remote.mcpPanel`. The descriptor list
 * is shared with the host `./typert` manifest (`../wire.ts`), so the two
 * faces can never drift.
 *
 * @module dsh-mcp-panel/client/remote
 */

import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { MCP_PANEL_INVOCATIONS } from '../wire.ts'
import type { McpPanelSnapshot, ProbeStarted } from '../wire.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$mcpPanel {
    /** Read the current read-only MCP snapshot. */
    status: () => Promise<RemoteResult<McpPanelSnapshot>>
    /** Start a one-shot connectivity probe of one streamable-http server. */
    probe: (serverName: string) => Promise<RemoteResult<ProbeStarted>>
  }
  interface TypertRemoteMap {
    'mcpPanel/status': () => Promise<RemoteResult<McpPanelSnapshot>>
    'mcpPanel/probe': (serverName: string) => Promise<RemoteResult<ProbeStarted>>
  }
  interface TypertRemoteNamespaceMap {
    mcpPanel: TypertRemoteNamespace$mcpPanel
  }
}

/** The client Remote contribution for the `mcpPanel` namespace. */
export const MCP_PANEL_REMOTE = Object.freeze({
  package: 'dsh-mcp-panel',
  descriptors: MCP_PANEL_INVOCATIONS,
} satisfies TypertRemoteContribution)
