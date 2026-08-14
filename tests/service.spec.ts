/**
 * Host service tests: the panel probe action (streamable-http gating, jobs
 * gating, unowned job start), the probe-record cap, and passive-probe state
 * aggregation. No network — the fetch path is covered in `probe.spec.ts`.
 *
 * @module dsh-mcp-panel/test/service.spec
 */

import { describe, expect, it } from 'vitest'
import { mcpRow, mountHarness } from './harness.ts'
import { resolveConfig } from '../src/config.ts'

const HTTP_CONFIG = {
  serverName: 'web',
  transport: 'streamable-http',
  url: 'http://localhost:3000/mcp',
  headers: { Authorization: 'Bearer secret-header' },
}

const STDIO_CONFIG = {
  serverName: 'cli',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
}

function fakeJobs(startImpl?: (spec: { kind: string; label: string; owner?: unknown; run: () => unknown }) => string) {
  const started: Array<{ kind: string; label: string; owner: unknown }> = []
  return {
    started,
    attachController: () => () => undefined,
    start: (spec: { kind: string; label: string; owner?: unknown; run: () => unknown }) => {
      started.push({ kind: spec.kind, label: spec.label, owner: spec.owner })
      return startImpl?.(spec) ?? 'mcp-probe-1'
    },
    list: () => [],
  }
}

describe('McpPanelService.probe', () => {
  it('starts an unowned panel-only probe job for a streamable-http server', async () => {
    const jobs = fakeJobs()
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)], {}, jobs as never)
    const result = harness.service.probe('web')
    expect(result.jobId).toBe('mcp-probe-1')
    expect(result.note).toContain('panel-only')
    expect(jobs.started).toEqual([{ kind: 'mcp-probe', label: 'mcp_probe web', owner: undefined }])
  })

  it('rejects stdio servers and unknown names', async () => {
    const harness = await mountHarness([mcpRow('mcp-cli', STDIO_CONFIG)], {}, fakeJobs() as never)
    expect(() => harness.service.probe('cli')).toThrow('not a configured streamable-http MCP server')
    expect(() => harness.service.probe('missing')).toThrow('not a configured streamable-http MCP server')
  })

  it('fails loudly when no job registry is composed', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)])
    expect(() => harness.service.probe('web')).toThrow('ctx.jobs is not composed')
  })
})

describe('probe record cap', () => {
  it('keeps only the newest maxProbes records', async () => {
    const probes = Array.from({ length: 15 }, (_value, index) => ({
      id: `mcp-probe-${index + 1}`,
      kind: 'mcp-probe',
      label: `mcp_probe web ${index + 1}`,
      status: 'completed',
      startedAt: index + 1,
      finishedAt: index + 2,
      detail: `ok ${index + 1}`,
    }))
    const jobs = {
      attachController: () => () => undefined,
      start: () => 'mcp-probe-1',
      list: () => probes,
    }
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)], { maxProbes: 5 }, jobs as never)
    const snapshot = harness.service.status()
    expect(snapshot.probes).toHaveLength(5)
    // Newest first: the reversed list keeps the highest ids.
    expect(snapshot.probes[0]!.id).toBe('mcp-probe-15')
    expect(snapshot.probes[4]!.id).toBe('mcp-probe-11')
  })
})

describe('config bounds', () => {
  it('rejects out-of-range values loudly', () => {
    expect(() => resolveConfig({ maxProbes: 0 })).toThrow('maxProbes')
    expect(() => resolveConfig({ refreshIntervalMs: -1 })).toThrow('refreshIntervalMs')
    expect(() => resolveConfig({ passiveProbeIntervalMs: 100 })).toThrow('passiveProbeIntervalMs')
    expect(() => resolveConfig({ outputLanguage: 'fr' as never })).toThrow('outputLanguage')
  })

  it('defaults the passive probe loop off', () => {
    expect(resolveConfig(undefined)).toMatchObject({ passiveProbeEnabled: false, outputLanguage: 'en' })
  })
})
