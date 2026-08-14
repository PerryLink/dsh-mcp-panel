/**
 * Aggregation tests: deriveTarget/deriveRow over raw configs, missing-field
 * tolerance (absent config, wrong types, `!!js` nodes, empty rows), the
 * upstream-vs-derived status merge, reconnect counting, URL sanitization
 * inside targets, and the wire-schema round trip.
 *
 * @module dsh-mcp-panel/test/aggregate.spec
 */

import { describe, expect, it } from 'vitest'
import {
  aggregateServerView,
  aggregateSnapshot,
  deriveTarget,
  serverNameOf,
  type McpLoaderRow,
} from '../src/aggregate.ts'
import { groupMcpTools } from '../src/grouping.ts'
import type { McpServerStatus } from '../src/upstream.ts'
import { MCP_PANEL_SNAPSHOT_SCHEMA } from '../src/wire.ts'

function row(entryId: string, config: unknown, disabled = false, fiberPhase: McpLoaderRow['fiberPhase'] = 'active'): McpLoaderRow {
  return { entryId, disabled, fiberPhase, config }
}

const NO_FACTS = { statuses: new Map(), reconnects: new Map(), observedAt: new Map(), probeStates: new Map() }

describe('deriveTarget', () => {
  it('derives stdio command lines with quoted args', () => {
    expect(deriveTarget({ transport: 'stdio', command: 'npx', args: ['-y', 'pkg with space'] }))
      .toEqual({ transport: 'stdio', target: 'npx -y "pkg with space"' })
    expect(deriveTarget({ transport: 'stdio', command: 'node', args: [] })).toEqual({ transport: 'stdio', target: 'node' })
  })

  it('derives sanitized streamable-http URLs', () => {
    expect(deriveTarget({ transport: 'streamable-http', url: 'http://localhost:3000/mcp?token=SECRET' }))
      .toEqual({ transport: 'streamable-http', target: 'http://localhost:3000/mcp?token=***' })
  })

  it('shows !!js expression arguments as markers instead of evaluating them', () => {
    const result = deriveTarget({ transport: 'stdio', command: 'node', args: [{ __jsExpr: 'process.env.X' }] })
    expect(result).toEqual({ transport: 'stdio', target: 'node <expression>' })
  })

  it('degrades missing or malformed config to unknown', () => {
    expect(deriveTarget(undefined)).toEqual({ transport: 'unknown', target: '(unconfigured)' })
    expect(deriveTarget(null)).toEqual({ transport: 'unknown', target: '(unconfigured)' })
    expect(deriveTarget('stdio')).toEqual({ transport: 'unknown', target: '(unconfigured)' })
    expect(deriveTarget({ transport: 'stdio' })).toEqual({ transport: 'unknown', target: '(unconfigured)' })
    expect(deriveTarget({ transport: 'streamable-http' })).toEqual({ transport: 'unknown', target: '(unconfigured)' })
    expect(deriveTarget({ transport: 'ftp', command: 'x' })).toEqual({ transport: 'unknown', target: '(unconfigured)' })
    expect(deriveTarget({ transport: 'stdio', command: { __jsExpr: 'x' } })).toEqual({ transport: 'unknown', target: '(unconfigured)' })
  })
})

describe('serverNameOf', () => {
  it('reads the namespace or falls back without throwing', () => {
    expect(serverNameOf({ serverName: 'github' }, 'x')).toBe('github')
    expect(serverNameOf(undefined, 'entry:mcp-1')).toBe('entry:mcp-1')
    expect(serverNameOf({ serverName: { __jsExpr: 'x' } }, 'entry:mcp-1')).toBe('entry:mcp-1')
    expect(serverNameOf({ serverName: 42 }, 'entry:mcp-1')).toBe('entry:mcp-1')
  })
})

describe('aggregateServerView', () => {
  it('derives honest unknown status without upstream data', () => {
    const view = aggregateServerView(
      row('mcp-github', { transport: 'stdio', command: 'npx', serverName: 'github' }),
      'github',
      { serverName: 'github', configured: true, tools: [{ name: 'mcp__github__t', description: 'd' }] },
      NO_FACTS,
    )
    expect(view).toMatchObject({
      serverName: 'github',
      entryId: 'mcp-github',
      enabled: true,
      phase: 'unknown',
      attempt: -1,
      maxAttempts: -1,
      reconnectCount: -1,
      lastError: null,
      connectedAt: null,
      delayMs: null,
      statusSource: 'derived',
      toolCount: 1,
    })
  })

  it('projects upstream status facts and sanitizes their errors', () => {
    const status: McpServerStatus = {
      serverName: 'github',
      phase: 'waiting',
      attempt: 2,
      maxAttempts: 10,
      delayMs: 2000,
      error: 'connect failed token=SECRET',
      toolCount: 3,
    }
    const facts = {
      statuses: new Map([['github', status]]),
      reconnects: new Map([['github', 5]]),
      observedAt: new Map([['github', 123_000]]),
      probeStates: new Map<string, { state: 'reachable' | 'unreachable'; checkedAt: number }>(),
    }
    const view = aggregateServerView(row('mcp-github', {}), 'github', undefined, facts)
    expect(view).toMatchObject({
      phase: 'waiting',
      attempt: 2,
      maxAttempts: 10,
      delayMs: 2000,
      reconnectCount: 5,
      connectedAt: null,
      observedAt: 123_000,
      statusSource: 'upstream-event',
      toolCount: 0,
    })
    expect(view.lastError).not.toContain('SECRET')
  })

  it('tolerates a missing row (leftover namespace) without throwing', () => {
    const view = aggregateServerView(undefined, 'stray', { serverName: 'stray', configured: false, tools: [] }, NO_FACTS)
    expect(view).toMatchObject({
      entryId: '',
      transport: 'unknown',
      target: '(unconfigured)',
      enabled: false,
      fiberPhase: null,
      toolCount: 0,
    })
  })

  it('reflects disabled and failed fibers as configuration facts', () => {
    const disabled = aggregateServerView(row('mcp-a', {}, true, 'active'), 'a', undefined, NO_FACTS)
    expect(disabled.enabled).toBe(false)
    const failed = aggregateServerView(row('mcp-b', {}, false, 'failed'), 'b', undefined, NO_FACTS)
    expect(failed.fiberPhase).toBe('failed')
  })

  it('derives config-declared policy facts for the panel detail row', () => {
    const view = aggregateServerView(row('mcp-a', {
      serverName: 'a',
      transport: 'stdio',
      command: 'x',
      reconnect: { enabled: false },
      failOnStartupError: true,
      toolCallTimeoutMs: 30_000,
    }), 'a', undefined, NO_FACTS)
    expect(view.configuredNote).toBe('reconnect off; fail on startup error; tool timeout 30s')
    const defaults = aggregateServerView(row('mcp-b', { serverName: 'b' }), 'b', undefined, NO_FACTS)
    expect(defaults.configuredNote).toBeNull()
  })
})

describe('aggregateSnapshot', () => {
  it('keeps one view per namespace with the enabled row winning', () => {
    const rows = [
      row('mcp-a-1', { serverName: 'a', transport: 'stdio', command: 'one' }, true),
      row('mcp-a-2', { serverName: 'a', transport: 'stdio', command: 'two' }, false),
    ]
    const groups = groupMcpTools([{ name: 'mcp__a__t', description: '' }], ['a'])
    const snapshot = aggregateSnapshot({ rows, groups, facts: NO_FACTS, probes: [], patchFile: null, refreshIntervalMs: 0 })
    expect(snapshot.servers).toHaveLength(1)
    expect(snapshot.servers[0]!.entryId).toBe('mcp-a-2')
    expect(snapshot.observed).toBe(false)
  })

  it('includes leftover namespaces from the tool registry', () => {
    const rows = [row('mcp-a', { serverName: 'a' })]
    const groups = groupMcpTools([{ name: 'mcp__stray__t', description: '' }], ['a'])
    const snapshot = aggregateSnapshot({ rows, groups, facts: NO_FACTS, probes: [], patchFile: '/p/cordis.patch.yml', refreshIntervalMs: 0 })
    expect(snapshot.servers.map(view => view.serverName)).toEqual(['a', 'stray'])
    expect(snapshot.patchFile).toBe('/p/cordis.patch.yml')
  })

  it('survives a fully empty environment', () => {
    const snapshot = aggregateSnapshot({ rows: [], groups: [], facts: NO_FACTS, probes: [], patchFile: null, refreshIntervalMs: 0 })
    expect(snapshot).toEqual({ observed: false, patchFile: null, refreshIntervalMs: 0, servers: [], probes: [] })
  })
})

describe('wire schema', () => {
  it('round-trips a representative snapshot through the strict codec', () => {
    const snapshot = aggregateSnapshot({
      rows: [row('mcp-github', { transport: 'stdio', command: 'npx', args: ['-y', 'x'], serverName: 'github' })],
      groups: groupMcpTools([{ name: 'mcp__github__t', description: 'd' }], ['github']),
      facts: NO_FACTS,
      probes: [{
        id: 'mcp-probe-1',
        serverName: 'github',
        status: 'completed',
        startedAt: 1,
        finishedAt: 2,
        detail: 'HTTP 200 ok',
      }],
      patchFile: '/p/cordis.patch.yml',
      refreshIntervalMs: 15000,
    })
    expect(MCP_PANEL_SNAPSHOT_SCHEMA.parse(snapshot)).toEqual(snapshot)
  })

  it('rejects malformed snapshots loudly at the wire boundary', () => {
    expect(() => MCP_PANEL_SNAPSHOT_SCHEMA.parse({ servers: 'no' })).toThrow()
  })
})
