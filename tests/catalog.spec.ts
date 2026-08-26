/**
 * Community MCP server catalog: the built-in directory is non-empty and every
 * entry validates, the user overlay overrides by id and appends new entries,
 * and catalog entries convert into editor `add` config inputs.
 * @module dsh-mcp-panel/test/catalog.spec
 */

import { describe, expect, it } from 'vitest'
import { catalogIssues, catalogOverlayIssues, catalogToConfigInput, DEFAULT_CATALOG, mergeCatalog } from '../src/catalog.ts'
import type { CatalogEntry } from '../src/catalog.ts'

describe('DEFAULT_CATALOG', () => {
  it('ships a non-empty, fully valid directory', () => {
    expect(DEFAULT_CATALOG.length).toBeGreaterThan(0)
    for (let index = 0; index < DEFAULT_CATALOG.length; index += 1) {
      expect(catalogIssues(DEFAULT_CATALOG[index], index)).toEqual([])
    }
  })
})

describe('mergeCatalog', () => {
  it('overrides a built-in entry by id and appends new ones', () => {
    const override: CatalogEntry = { id: 'github', name: 'GitHub (patched)', description: 'x', transport: 'stdio', command: 'npx' }
    const added: CatalogEntry = { id: 'my-server', name: 'My Server', description: 'y', transport: 'stdio', command: 'node' }
    const merged = mergeCatalog(DEFAULT_CATALOG, [override, added])
    const github = merged.find(entry => entry.id === 'github')
    expect(github?.name).toBe('GitHub (patched)')
    expect(merged.some(entry => entry.id === 'my-server')).toBe(true)
    // Built-in order is preserved first; the appended entry is last.
    expect(merged[merged.length - 1]?.id).toBe('my-server')
  })
})

describe('catalogOverlayIssues', () => {
  it('accepts a valid overlay and rejects a malformed entry', () => {
    expect(catalogOverlayIssues(undefined)).toEqual([])
    expect(catalogOverlayIssues([{ id: 'a', name: 'A', description: 'd', transport: 'stdio', command: 'x' }])).toEqual([])
    const issues = catalogOverlayIssues([{ id: 'bad id', name: '', transport: 'bogus' }])
    expect(issues.length).toBeGreaterThan(0)
  })

  it('requires the transport-specific field', () => {
    expect(catalogIssues({ id: 'x', name: 'X', description: 'd', transport: 'stdio' }, 0)
      .some(issue => issue.field.endsWith('.command'))).toBe(true)
    expect(catalogIssues({ id: 'x', name: 'X', description: 'd', transport: 'streamable-http' }, 0)
      .some(issue => issue.field.endsWith('.url'))).toBe(true)
  })
})

describe('catalogToConfigInput', () => {
  it('maps a catalog entry to a one-click add config', () => {
    const input = catalogToConfigInput({ id: 'git', name: 'Git', description: 'd', transport: 'stdio', command: 'uvx', args: ['mcp-server-git'] })
    expect(input).toEqual({ serverName: 'git', transport: 'stdio', command: 'uvx', args: ['mcp-server-git'] })
  })
})
