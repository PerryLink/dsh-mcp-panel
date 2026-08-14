/**
 * Pure client presenter tests: badge derivation for every connection phase,
 * reconnect-count projection, error flags, probe badges, and the empty/
 * observed passthrough. The presenter is I/O-free, so these run under the
 * plain node environment.
 *
 * @module dsh-mcp-panel/test/present.spec
 */

import { describe, expect, it } from 'vitest'
import { connectionBadge, presentMcpPanel, probeBadge } from '../src/client/present.ts'
import type { McpPanelSnapshot, McpServerView } from '../src/wire.ts'

function server(overrides: Partial<McpServerView> = {}): McpServerView {
  return {
    serverName: 's',
    entryId: 'mcp-s',
    transport: 'stdio',
    target: 'npx x',
    enabled: true,
    fiberPhase: 'active',
    toolCount: 0,
    tools: [],
    phase: 'unknown',
    attempt: -1,
    maxAttempts: -1,
    delayMs: null,
    reconnectCount: -1,
    lastError: null,
    connectedAt: null,
    observedAt: null,
    probeState: null,
    probeCheckedAt: null,
    statusSource: 'derived',
    ...overrides,
  }
}

describe('connectionBadge', () => {
  it('prefers disabled and failed-fiber facts over the connection phase', () => {
    expect(connectionBadge(server({ enabled: false, phase: 'connected' }))).toEqual({ badge: 'disabled', tone: 'muted' })
    expect(connectionBadge(server({ fiberPhase: 'failed', phase: 'connected' }))).toEqual({ badge: 'failed', tone: 'error' })
  })

  it('maps every upstream phase to a badge and tone', () => {
    expect(connectionBadge(server({ phase: 'connected' }))).toEqual({ badge: 'connected', tone: 'ok' })
    expect(connectionBadge(server({ phase: 'connecting' }))).toEqual({ badge: 'connecting', tone: 'warn' })
    expect(connectionBadge(server({ phase: 'waiting' }))).toEqual({ badge: 'waiting', tone: 'warn' })
    expect(connectionBadge(server({ phase: 'exhausted' }))).toEqual({ badge: 'exhausted', tone: 'error' })
    expect(connectionBadge(server({ phase: 'disposed' }))).toEqual({ badge: 'disposed', tone: 'muted' })
    expect(connectionBadge(server({ phase: 'unknown' }))).toEqual({ badge: 'unknown', tone: 'muted' })
  })
})

describe('probeBadge', () => {
  it('maps every probe state', () => {
    expect(probeBadge('completed')).toEqual({ badge: 'completed', tone: 'ok' })
    expect(probeBadge('running')).toEqual({ badge: 'running', tone: 'warn' })
    expect(probeBadge('stopping')).toEqual({ badge: 'stopping', tone: 'warn' })
    expect(probeBadge('failed')).toEqual({ badge: 'failed', tone: 'error' })
    expect(probeBadge('killed')).toEqual({ badge: 'killed', tone: 'muted' })
  })
})

describe('presentMcpPanel', () => {
  it('projects reconnect counts, error flags, and empty/observed facts', () => {
    const snapshot: McpPanelSnapshot = {
      observed: true,
      patchFile: '/p/cordis.patch.yml',
      refreshIntervalMs: 15000,
      servers: [
        server({ phase: 'connected', reconnectCount: 3, lastError: 'spawn failed' }),
        server({ serverName: 't', reconnectCount: -1, lastError: null }),
      ],
      probes: [{ id: 'mcp-probe-1', serverName: 's', status: 'completed', startedAt: 1, finishedAt: 2, detail: 'ok' }],
    }
    const model = presentMcpPanel(snapshot)
    expect(model.empty).toBe(false)
    expect(model.observed).toBe(true)
    expect(model.patchFile).toBe('/p/cordis.patch.yml')
    expect(model.refreshIntervalMs).toBe(15000)
    expect(model.servers.map(row => row.reconnects)).toEqual([3, null])
    expect(model.servers.map(row => row.hasError)).toEqual([true, false])
    expect(model.servers[0]!.badge).toBe('connected')
    expect(model.probes[0]!.badge).toBe('completed')
  })

  it('computes event age and attempt-budget visibility from a fixed clock', () => {
    const snapshot: McpPanelSnapshot = {
      observed: true,
      patchFile: null,
      refreshIntervalMs: 0,
      servers: [
        server({ serverName: 'fresh', phase: 'waiting', attempt: 2, maxAttempts: 10, observedAt: 995_000 }),
        server({ serverName: 'quiet' }),
      ],
      probes: [],
    }
    const model = presentMcpPanel(snapshot, 1_000_000)
    expect(model.servers[0]!.ageSeconds).toBe(5)
    expect(model.servers[0]!.hasAttemptBudget).toBe(true)
    expect(model.servers[1]!.ageSeconds).toBeNull()
    expect(model.servers[1]!.hasAttemptBudget).toBe(false)
  })

  it('flags the empty composition', () => {
    const model = presentMcpPanel({ observed: false, patchFile: null, refreshIntervalMs: 0, servers: [], probes: [] })
    expect(model.empty).toBe(true)
    expect(model.observed).toBe(false)
  })
})
