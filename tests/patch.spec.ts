/**
 * Patch-fragment generation tests: config validation against the official
 * client's face, keep-semantics merging (secret values never round-trip),
 * YAML scalar quoting, deterministic fragment rendering, and entry-id
 * allocation.
 *
 * @module dsh-mcp-panel/test/patch.spec
 */

import { describe, expect, it } from 'vitest'
import {
  defaultEntryId,
  mergeServerConfig,
  nextEntryId,
  renderPatchFragment,
  resolvePatchOp,
  validateServerConfig,
  yamlScalar,
} from '../src/patch.ts'
import type { McpServerConfigView } from '../src/wire.ts'

describe('validateServerConfig', () => {
  it('accepts a complete stdio config', () => {
    const result = validateServerConfig({
      serverName: 'github',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'pkg'],
      env: { TOKEN: 'x' },
    })
    expect(result.ok).toBe(true)
  })

  it('accepts a complete streamable-http config', () => {
    const result = validateServerConfig({ serverName: 'web', transport: 'streamable-http', url: 'http://localhost/mcp' })
    expect(result.ok).toBe(true)
  })

  it('rejects bad server names, transports, and missing transport fields', () => {
    expect(validateServerConfig({ serverName: 'has space', transport: 'stdio', command: 'x' }).ok).toBe(false)
    expect(validateServerConfig({ serverName: '', transport: 'stdio', command: 'x' }).ok).toBe(false)
    expect(validateServerConfig({ serverName: 'a', command: 'x' }).ok).toBe(false)
    expect(validateServerConfig({ serverName: 'a', transport: 'ftp' }).ok).toBe(false)
    expect(validateServerConfig({ serverName: 'a', transport: 'stdio' }).ok).toBe(false)
    expect(validateServerConfig({ serverName: 'a', transport: 'streamable-http' }).ok).toBe(false)
    expect(validateServerConfig({ serverName: 'a', transport: 'streamable-http', url: 'not-a-url' }).ok).toBe(false)
  })

  it('rejects malformed input and non-string map values', () => {
    expect(validateServerConfig(null).ok).toBe(false)
    expect(validateServerConfig('x').ok).toBe(false)
    expect(validateServerConfig({ serverName: 'a', transport: 'stdio', command: 'x', env: { K: 1 } }).ok).toBe(false)
  })
})

describe('yamlScalar', () => {
  it('keeps plain-safe scalars plain', () => {
    expect(yamlScalar('abc')).toBe('abc')
    expect(yamlScalar('http://a/b')).toBe('http://a/b')
    expect(yamlScalar('@deepseek-ai/dsh-mcp-client')).toBe("'@deepseek-ai/dsh-mcp-client'")
  })

  it('quotes ambiguous and special values', () => {
    expect(yamlScalar('')).toBe("''")
    expect(yamlScalar('true')).toBe("'true'")
    expect(yamlScalar('null')).toBe("'null'")
    expect(yamlScalar('yes')).toBe("'yes'")
    expect(yamlScalar('-y')).toBe("'-y'")
    expect(yamlScalar('a b')).toBe("'a b'")
    expect(yamlScalar("it's")).toBe("'it''s'")
    expect(yamlScalar('line\nbreak')).toBe(JSON.stringify('line\nbreak'))
  })
})

describe('renderPatchFragment', () => {
  const date = new Date('2026-08-20T00:00:00Z')

  it('renders an add operation as an insert block with quoted values', () => {
    const fragment = renderPatchFragment({
      kind: 'add',
      entryId: 'mcp-github',
      rowConfig: {
        serverName: 'github',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'has space'],
        env: { TOKEN: 'yes' },
      },
    }, date)
    expect(fragment).toContain('# dsh-mcp-panel: add server (2026-08-20)')
    expect(fragment).toContain('- insert:')
    expect(fragment).toContain('- id: mcp-github')
    expect(fragment).toContain("name: '@deepseek-ai/dsh-mcp-client'")
    expect(fragment).toContain("command: npx")
    expect(fragment).toContain("args:")
    expect(fragment).toContain("  - '-y'")
    expect(fragment).toContain("  - 'has space'")
    expect(fragment).toContain("TOKEN: 'yes'")
    expect(fragment).not.toContain('!!js')
  })

  it('renders edit, disable, and enable operations', () => {
    expect(renderPatchFragment({ kind: 'edit', entryId: 'mcp-github', rowConfig: { serverName: 'github', transport: 'stdio', command: 'x' } }, date))
      .toContain('- set:')
    expect(renderPatchFragment({ kind: 'disable', entryId: 'mcp-github' }, date))
      .toContain("disabled: true")
    expect(renderPatchFragment({ kind: 'enable', entryId: 'mcp-github' }, date))
      .toContain("disabled: false")
  })
})

describe('mergeServerConfig', () => {
  const view: McpServerConfigView = {
    serverName: 'web',
    transport: 'streamable-http',
    command: null,
    args: [],
    cwd: null,
    url: 'http://localhost:3000/mcp?token=***',
    envKeys: [],
    headerKeys: ['Authorization'],
    toolCallTimeoutMs: null,
    failOnStartupError: null,
    reconnectEnabled: null,
    reconnectMaxAttempts: null,
  }
  const raw = {
    serverName: 'web',
    transport: 'streamable-http',
    url: 'http://localhost:3000/mcp?token=SECRET',
    headers: { Authorization: 'Bearer TOKEN' },
  }

  it('keeps the raw URL when the sanitized display value is unchanged', () => {
    const merged = mergeServerConfig(raw, {
      serverName: 'web',
      transport: 'streamable-http',
      url: 'http://localhost:3000/mcp?token=***',
      keepHeaders: ['Authorization'],
    }, view)
    expect(merged['url']).toBe('http://localhost:3000/mcp?token=SECRET')
    expect(merged['headers']).toEqual({ Authorization: 'Bearer TOKEN' })
  })

  it('takes an edited URL and header, and drops unlisted header keys', () => {
    const merged = mergeServerConfig(raw, {
      serverName: 'web',
      transport: 'streamable-http',
      url: 'http://other/mcp',
      headers: { 'X-New': 'v' },
    }, view)
    expect(merged['url']).toBe('http://other/mcp')
    expect(merged['headers']).toEqual({ 'X-New': 'v' })
  })

  it('merges env maps with keep/replace/drop semantics', () => {
    const stdioView: McpServerConfigView = { ...view, transport: 'stdio', url: null, command: 'x', envKeys: ['KEEP', 'DROP'] }
    const merged = mergeServerConfig(
      { serverName: 'x', transport: 'stdio', command: 'x', env: { KEEP: 'raw', DROP: 'raw' } },
      { serverName: 'x', transport: 'stdio', command: 'x', env: { KEEP: 'edited' }, keepEnv: ['KEEP'] },
      stdioView,
    )
    expect(merged['env']).toEqual({ KEEP: 'edited' })
  })
})

describe('resolvePatchOp + entry ids', () => {
  const rawFor = new Map([['mcp-github', { serverName: 'github', transport: 'stdio', command: 'npx' }]])
  const viewFor = new Map<string, McpServerConfigView>([['mcp-github', {
    serverName: 'github', transport: 'stdio', command: 'npx', args: [], cwd: null, url: null,
    envKeys: [], headerKeys: [], toolCallTimeoutMs: null, failOnStartupError: null,
    reconnectEnabled: null, reconnectMaxAttempts: null,
  }]])

  it('allocates unique entry ids for adds', () => {
    expect(defaultEntryId('github')).toBe('mcp-github')
    expect(nextEntryId('github', new Set())).toBe('mcp-github')
    expect(nextEntryId('github', new Set(['mcp-github']))).toBe('mcp-github-2')
  })

  it('resolves add/edit/disable ops and rejects unknown rows', () => {
    const add = resolvePatchOp({ kind: 'add', config: { serverName: 'new', transport: 'stdio', command: 'x' } }, rawFor, viewFor, new Set(['mcp-github']))
    expect(add.ok && add.op.kind).toBe('add')
    expect(add.ok && add.op.entryId).toBe('mcp-new')
    const edit = resolvePatchOp({ kind: 'edit', entryId: 'mcp-github', config: { serverName: 'github', transport: 'stdio', command: 'npx' } }, rawFor, viewFor, new Set())
    expect(edit.ok && edit.op.kind).toBe('edit')
    const disable = resolvePatchOp({ kind: 'disable', entryId: 'mcp-github' }, rawFor, viewFor, new Set())
    expect(disable.ok && disable.op.kind).toBe('disable')
    expect(resolvePatchOp({ kind: 'edit', entryId: 'nope', config: {} }, rawFor, viewFor, new Set()).ok).toBe(false)
    expect(resolvePatchOp({ kind: 'frobnicate' }, rawFor, viewFor, new Set()).ok).toBe(false)
  })
})
