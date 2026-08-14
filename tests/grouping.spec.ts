/**
 * Tool enumeration and grouping tests: prefix matching against configured
 * namespaces, leftover foreign `mcp__` registrations, underscore-bearing
 * server names, hash-normalized names, non-MCP tools, and empty inputs.
 *
 * @module dsh-mcp-panel/test/grouping.spec
 */

import { describe, expect, it } from 'vitest'
import { countServerTools, groupMcpTools, type ToolSchemaFace } from '../src/grouping.ts'

function tool(name: string, description = 'does things'): ToolSchemaFace {
  return { name, description }
}

describe('groupMcpTools', () => {
  it('groups configured namespaces by exact prefix and sorts by server name', () => {
    const groups = groupMcpTools([
      tool('mcp__github__create_issue'),
      tool('mcp__github__list_repos'),
      tool('mcp__web__search'),
      tool('bash'),
    ], ['github', 'web'])
    expect(groups.map(group => group.serverName)).toEqual(['github', 'web'])
    expect(groups.map(group => group.configured)).toEqual([true, true])
    expect(groups[0]!.tools.map(entry => entry.name)).toEqual(['mcp__github__create_issue', 'mcp__github__list_repos'])
    expect(groups[1]!.tools.map(entry => entry.name)).toEqual(['mcp__web__search'])
  })

  it('emits configured groups with zero tools', () => {
    const groups = groupMcpTools([tool('bash')], ['empty-server'])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ serverName: 'empty-server', configured: true, tools: [] })
  })

  it('does not mis-split server names containing underscores', () => {
    const groups = groupMcpTools([tool('mcp__my_server__do_work')], ['my_server', 'my'])
    const own = groups.find(group => group.serverName === 'my_server')
    expect(own?.tools.map(entry => entry.name)).toEqual(['mcp__my_server__do_work'])
    expect(groups.find(group => group.serverName === 'my')?.tools).toEqual([])
  })

  it('keeps foreign mcp__ registrations as unconfigured groups instead of dropping them', () => {
    const groups = groupMcpTools([tool('mcp__stray__probe')], ['known'])
    expect(groups.map(group => group.serverName)).toEqual(['known', 'stray'])
    expect(groups[1]).toMatchObject({ configured: false, tools: [{ name: 'mcp__stray__probe' }] })
  })

  it('handles hash-normalized public names under their server', () => {
    const groups = groupMcpTools([tool('mcp__github__to_ol_a1b2c3d4e5f6')], ['github'])
    expect(groups[0]!.tools.map(entry => entry.name)).toEqual(['mcp__github__to_ol_a1b2c3d4e5f6'])
  })

  it('ignores non-mcp tools entirely', () => {
    expect(groupMcpTools([tool('bash'), tool('read'), tool('mcp__')], ['s'])).toEqual([
      { serverName: 's', configured: true, tools: [] },
    ])
  })

  it('tolerates hostile schema entries without throwing', () => {
    const schemas = [
      { name: 'mcp__s__t' } as ToolSchemaFace,
      {} as ToolSchemaFace,
      { name: 42 } as unknown as ToolSchemaFace,
    ]
    const groups = groupMcpTools(schemas, ['s'])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.tools.map(entry => entry.name)).toEqual(['mcp__s__t'])
  })
})

describe('countServerTools', () => {
  it('counts only the exact server prefix', () => {
    const schemas = [tool('mcp__s__a'), tool('mcp__s__b'), tool('mcp__s2__c'), tool('mcp__s2__d')]
    expect(countServerTools(schemas, 's')).toBe(2)
    expect(countServerTools(schemas, 's2')).toBe(2)
  })

  it('returns zero without matches', () => {
    expect(countServerTools([tool('bash')], 's')).toBe(0)
  })
})
