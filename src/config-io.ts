/**
 * MCP server config import/export: a versioned JSON document that round-trips
 * the console's server rows into a shareable/backup file, and parses an import
 * back into validated editor inputs (each ready to render as an append-only
 * `add` patch). Import/export never fabricates a row and never evaluates a
 * `!!js` expression — non-plain-JSON config is exported as `null` with a
 * reason instead of being silently corrupted.
 *
 * @module dsh-mcp-panel/config-io
 */

import { defaultEntryId, validateServerConfig, type McpServerConfigInput } from './patch.ts'

/** Discriminator of the MCP config export document (version 1). */
export const MCP_CONFIG_EXPORT_SCHEMA = 'dsh-mcp-panel/mcp-config@v1' as const

/** One exported server row. */
export interface McpConfigExportRow {
  /** Loader entry id (the patch row id). */
  entryId: string
  /** Raw config, or null when the row was not plain JSON (`!!js` present). */
  config: Record<string, unknown> | null
  /** Present only when `config` is null. */
  reason?: string
}

/** One parsed import row: an entry id plus a validated config input. */
export interface McpConfigImportRow {
  /** Loader entry id (imported, or the default from the serverName). */
  entryId: string
  /** Validated editor config ready for an `add` patch. */
  config: McpServerConfigInput
}

/** Whether one serialized loader config is plain JSON (no `!!js` nodes). */
function isPlainJson(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value !== 'object') return true
  if (Array.isArray(value)) return value.every(isPlainJson)
  const record = value as Record<string, unknown>
  if ('__jsExpr' in record) return false
  return Object.values(record).every(isPlainJson)
}

/**
 * Export the console's MCP server rows as a versioned JSON document. Rows
 * whose config carries a `!!js` expression (not plain JSON) export as
 * `{ config: null, reason }` — the expression is never evaluated or emitted.
 * @param servers - `{ entryId, config }` per mcp-client loader row.
 * @returns the pretty-printed JSON export.
 */
export function exportMcpConfigs(servers: ReadonlyArray<{ entryId: string; config: unknown }>): string {
  const rows: McpConfigExportRow[] = servers.map(({ entryId, config }) => {
    if (!isPlainJson(config) || typeof config !== 'object' || config === null || Array.isArray(config)) {
      return { entryId, config: null, reason: 'config carries a !!js expression or is not a plain object; re-create it in the editor' }
    }
    return { entryId, config: config as Record<string, unknown> }
  })
  return `${JSON.stringify({ schema: MCP_CONFIG_EXPORT_SCHEMA, servers: rows }, null, 2)}\n`
}

/**
 * Parse an MCP config export back into validated editor inputs. Every server's
 * `config` is validated against the official client face; the first invalid
 * entry fails the whole import with the offending field named (nothing is
 * silently skipped). `entryId` defaults to `mcp-<serverName>` when absent.
 * @param text - the export JSON text (untrusted).
 * @returns the import rows in document order.
 * @throws on malformed JSON, a missing `servers` array, or an invalid entry.
 */
export function parseMcpConfigsImport(text: string): McpConfigImportRow[] {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    throw new Error('dsh-mcp-panel: import text is not valid JSON')
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new Error('dsh-mcp-panel: import must be a JSON object')
  }
  const servers = (document as Record<string, unknown>)['servers']
  if (!Array.isArray(servers) || servers.length === 0) {
    throw new Error('dsh-mcp-panel: import must carry a non-empty "servers" array')
  }
  const out: McpConfigImportRow[] = []
  for (let index = 0; index < servers.length; index += 1) {
    const entry = servers[index]
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`dsh-mcp-panel: import servers[${index}] must be an object`)
    }
    const record = entry as Record<string, unknown>
    const config = record['config']
    if (config === null) {
      throw new Error(`dsh-mcp-panel: import servers[${index}] has no config (exported as null)`)
    }
    const validated = validateServerConfig(config)
    if (!validated.ok) {
      throw new Error(`dsh-mcp-panel: import servers[${index}] invalid — ${validated.issues.map(issue => issue.text).join(' ')}`)
    }
    const entryId = typeof record['entryId'] === 'string' && record['entryId'] !== ''
      ? record['entryId']
      : defaultEntryId(validated.config.serverName)
    out.push({ entryId, config: validated.config })
  }
  return out
}
