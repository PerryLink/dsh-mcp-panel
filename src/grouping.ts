/**
 * Enumeration of model-facing MCP tools from the ToolRuntime schema list,
 * grouped by server namespace. The official bridge registers every MCP tool
 * under `mcp__<serverName>__<rawName>` (normalized deterministically), so a
 * prefix match against the configured server names is exact; leftover
 * `mcp__`-prefixed registrations from foreign plugins are preserved in
 * separate unconfigured groups instead of being mis-attributed or dropped.
 *
 * Pure functions of the schema snapshot — no registry reads.
 *
 * @module dsh-mcp-panel/grouping
 */

import type { McpToolView } from './wire.ts'

/** The `mcp__` namespace prefix every bridged MCP tool name starts with. */
export const MCP_TOOL_PREFIX = 'mcp__'

/** Mutable bucket used while grouping; published groups are readonly. */
interface ToolBucket {
  serverName: string
  configured: boolean
  tools: McpToolView[]
}

/** One tool group: a server namespace with its model-visible tools. */
export interface McpToolGroup {
  /** Server namespace (`mcp__<serverName>__…`); the best-effort segment for leftovers. */
  serverName: string
  /** True when `serverName` is a configured mcp-client namespace. */
  configured: boolean
  /** Model-visible tools under that namespace, sorted by public name. */
  tools: readonly McpToolView[]
}

/** The schema face this module reads; the ToolRuntime snapshot satisfies it. */
export interface ToolSchemaFace {
  /** Registered public tool name. */
  readonly name: string
  /** One-line model-facing description; may be absent on hostile or partial input. */
  readonly description?: string
}

/**
 * Split one registered tool schema list into per-server groups.
 *
 * @param schemas - the `ctx.tools.schemas()` snapshot (or any subset).
 * @param configuredNames - server namespaces from the loader's mcp-client rows.
 * @returns one group per configured namespace (even with zero tools) plus one
 *   group per unmatched `mcp__` namespace, sorted by server name.
 */
export function groupMcpTools(
  schemas: readonly ToolSchemaFace[],
  configuredNames: readonly string[],
): McpToolGroup[] {
  const groups = new Map<string, ToolBucket>()
  const configured = new Set(configuredNames)
  for (const serverName of configuredNames) {
    if (!groups.has(serverName)) {
      groups.set(serverName, { serverName, configured: true, tools: [] })
    }
  }
  for (const schema of schemas) {
    const name = typeof schema.name === 'string' ? schema.name : ''
    if (!name.startsWith(MCP_TOOL_PREFIX)) continue
    const server = matchConfigured(name, configured)
    const key = server ?? leftoverSegment(name)
    // A bare `mcp__` name has no server segment — not a bridge registration.
    if (key === '') continue
    const description = typeof schema.description === 'string' ? schema.description : ''
    const group = groups.get(key)
      ?? { serverName: key, configured: server !== undefined, tools: [] as McpToolView[] }
    group.tools.push({ name, description })
    groups.set(key, group)
  }
  return [...groups.values()]
    .map(group => ({ ...group, tools: [...group.tools].sort((left, right) => left.name < right.name ? -1 : 1) }))
    .sort((left, right) => left.serverName < right.serverName ? -1 : 1)
}

/** Match `mcp__<server>__<raw>` against the configured namespaces. */
function matchConfigured(name: string, configured: ReadonlySet<string>): string | undefined {
  for (const serverName of configured) {
    if (name.startsWith(`${MCP_TOOL_PREFIX}${serverName}__`)) return serverName
  }
  return undefined
}

/** Best-effort namespace segment for a foreign `mcp__`-prefixed registration. */
function leftoverSegment(name: string): string {
  const separator = name.indexOf('__', MCP_TOOL_PREFIX.length)
  return separator < 0 ? name.slice(MCP_TOOL_PREFIX.length) : name.slice(MCP_TOOL_PREFIX.length, separator)
}

/**
 * Count the tools registered under one configured server namespace.
 *
 * @param schemas - the `ctx.tools.schemas()` snapshot.
 * @param serverName - the configured namespace.
 * @returns the number of matching registrations.
 */
export function countServerTools(schemas: readonly ToolSchemaFace[], serverName: string): number {
  const prefix = `${MCP_TOOL_PREFIX}${serverName}__`
  let count = 0
  for (const schema of schemas) {
    if (schema.name.startsWith(prefix)) count += 1
  }
  return count
}
