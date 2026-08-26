/**
 * MCP config import/export: a versioned JSON document round-trips server rows,
 * `!!js` config exports as `null` with a reason, and the import parser
 * validates every server against the official client face.
 * @module dsh-mcp-panel/test/config-io.spec
 */

import { describe, expect, it } from 'vitest'
import { exportMcpConfigs, parseMcpConfigsImport } from '../src/config-io.ts'

describe('exportMcpConfigs', () => {
  it('serializes plain-JSON rows into a versioned document', () => {
    const json = exportMcpConfigs([
      { entryId: 'mcp-github', config: { serverName: 'github', transport: 'stdio', command: 'npx', env: { TOKEN: 'secret' } } },
    ])
    const document = JSON.parse(json) as { schema: string; servers: Array<{ entryId: string; config: Record<string, unknown> }> }
    expect(document.schema).toBe('dsh-mcp-panel/mcp-config@v1')
    expect(document.servers).toHaveLength(1)
    expect(document.servers[0]!.entryId).toBe('mcp-github')
    expect(document.servers[0]!.config['command']).toBe('npx')
  })

  it('exports a `!!js` expression row as null with a reason', () => {
    const json = exportMcpConfigs([{ entryId: 'mcp-x', config: { __jsExpr: true, transport: 'stdio' } }])
    const document = JSON.parse(json) as { servers: Array<{ config: null; reason?: string }> }
    expect(document.servers[0]!.config).toBeNull()
    expect(document.servers[0]!.reason).toContain('!!js')
  })
})

describe('parseMcpConfigsImport', () => {
  it('round-trips an export back into validated inputs', () => {
    const json = exportMcpConfigs([
      { entryId: 'mcp-github', config: { serverName: 'github', transport: 'stdio', command: 'npx', args: ['-y', 'x'] } },
    ])
    const rows = parseMcpConfigsImport(json)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.entryId).toBe('mcp-github')
    expect(rows[0]!.config.serverName).toBe('github')
    expect(rows[0]!.config.transport).toBe('stdio')
  })

  it('defaults the entry id from the serverName when absent', () => {
    const json = JSON.stringify({ schema: 'dsh-mcp-panel/mcp-config@v1', servers: [{ config: { serverName: 'git', transport: 'stdio', command: 'uvx' } }] })
    const rows = parseMcpConfigsImport(json)
    expect(rows[0]!.entryId).toBe('mcp-git')
  })

  it('rejects malformed JSON, an empty server list, and an invalid entry', () => {
    expect(() => parseMcpConfigsImport('not json')).toThrow(/not valid JSON/u)
    expect(() => parseMcpConfigsImport('{"servers":[]}')).toThrow(/non-empty/u)
    expect(() => parseMcpConfigsImport('{"servers":[{"config":{"transport":"stdio"}}]}')).toThrow(/invalid/u)
    expect(() => parseMcpConfigsImport('{"servers":[{"config":null}]}')).toThrow(/no config/u)
  })
})
