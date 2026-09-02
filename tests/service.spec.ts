/**
 * Host service tests: the panel probe action (transport gating, jobs gating,
 * unowned job start), the probe-record cap, and passive-probe state
 * aggregation. No network — the fetch path is covered in `probe.spec.ts`.
 *
 * @module dsh-mcp-panel/test/service.spec
 */

import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { mcpRow, mountHarness, nestedMcpRow } from './harness.ts'
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

  it('starts an unowned panel-only probe job for a stdio server', async () => {
    const jobs = fakeJobs()
    const harness = await mountHarness([mcpRow('mcp-cli', STDIO_CONFIG)], {}, jobs as never)
    const result = harness.service.probe('cli')
    expect(result.jobId).toBe('mcp-probe-1')
    expect(result.note).toContain('panel-only')
    expect(jobs.started).toEqual([{ kind: 'mcp-probe', label: 'mcp_probe cli', owner: undefined }])
  })

  it('rejects unknown names', async () => {
    const harness = await mountHarness([mcpRow('mcp-cli', STDIO_CONFIG)], {}, fakeJobs() as never)
    expect(() => harness.service.probe('missing')).toThrow('not a configured MCP server (streamable-http or stdio)')
  })

  it('fails loudly when no job registry is composed', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)])
    expect(() => harness.service.probe('web')).toThrow('ctx.jobs is not composed')
  })

  it('targets nested rows by the bare options.id, not the group-composed entry.id', async () => {
    // A nested row without an explicit serverName falls back to
    // `entry:<options.id>` in the snapshot; the probe lookup must use the
    // same namespace or the panel's own probe action cannot find the row.
    const nestedConfig = { transport: 'streamable-http', url: 'http://localhost:3000/mcp' }
    const jobs = fakeJobs()
    const harness = await mountHarness([nestedMcpRow('include', 'mcp-web', nestedConfig)], {}, jobs as never)
    expect(harness.service.status().servers[0]?.serverName).toBe('entry:mcp-web')
    const result = harness.service.probe('entry:mcp-web')
    expect(result.jobId).toBe('mcp-probe-1')
  })
})

describe('upstream observation', () => {
  const CONNECTING_2 = { serverName: 'web', phase: 'connecting', attempt: 2, maxAttempts: 5, toolCount: 0 } as const

  it('stores valid payloads and flips statusSource to upstream-event', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)])
    harness.service.observe({ ...CONNECTING_2 })
    const view = harness.service.status().servers[0]!
    expect(view.phase).toBe('connecting')
    expect(view.attempt).toBe(2)
    expect(view.statusSource).toBe('upstream-event')
  })

  it('drops payloads the wire codec would reject instead of poisoning the snapshot', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)])
    harness.service.observe({ ...CONNECTING_2, phase: 'haunted' } as never)
    harness.service.observe({ ...CONNECTING_2, attempt: Number.NaN } as never)
    harness.service.observe({ ...CONNECTING_2, maxAttempts: 'lots' } as never)
    harness.service.observe({ ...CONNECTING_2, serverName: 42 } as never)
    harness.service.observe(null as never)
    const view = harness.service.status().servers[0]!
    expect(view.statusSource).toBe('derived')
    expect(view.phase).toBe('unknown')
  })

  it('counts each reconnect attempt once, ignoring re-observations of the same payload', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)])
    harness.service.observe({ ...CONNECTING_2 })
    harness.service.observe({ ...CONNECTING_2 })
    expect(harness.service.status().servers[0]!.reconnectCount).toBe(1)
    harness.service.observe({ ...CONNECTING_2, attempt: 3 })
    expect(harness.service.status().servers[0]!.reconnectCount).toBe(2)
  })

  it('resets the reconnect counter after a recovery so the next outage counts from attempt 1', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)])
    harness.service.observe({ ...CONNECTING_2 })
    harness.service.observe({ ...CONNECTING_2, attempt: 3 })
    expect(harness.service.status().servers[0]!.reconnectCount).toBe(2)
    harness.service.observe({ serverName: 'web', phase: 'connected', attempt: 0, maxAttempts: 5, toolCount: 1 })
    harness.service.observe({ ...CONNECTING_2, attempt: 1 })
    expect(harness.service.status().servers[0]!.reconnectCount).toBe(3)
    // The stale waiting payload of the previous outage does not re-arm a
    // double count on re-observation.
    harness.service.observe({ ...CONNECTING_2, attempt: 1, phase: 'waiting' })
    expect(harness.service.status().servers[0]!.reconnectCount).toBe(3)
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

  it('maps job states outside the panel vocabulary to unknown instead of failing the codec', async () => {
    const jobs = {
      attachController: () => () => undefined,
      start: () => 'mcp-probe-1',
      list: () => [{
        id: 'mcp-probe-1',
        kind: 'mcp-probe',
        label: 'mcp_probe web',
        status: 'queued', // a future job-registry state this panel does not know
        startedAt: 1,
        finishedAt: null,
        detail: 'queued…',
      }],
    }
    const harness = await mountHarness([mcpRow('mcp-web', HTTP_CONFIG)], {}, jobs as never)
    expect(harness.service.status().probes[0]!.status).toBe('unknown')
  })
})

describe('config bounds', () => {
  it('rejects out-of-range values loudly', () => {
    expect(() => resolveConfig({ maxProbes: 0 })).toThrow('maxProbes')
    expect(() => resolveConfig({ refreshIntervalMs: -1 })).toThrow('refreshIntervalMs')
    expect(() => resolveConfig({ passiveProbeIntervalMs: 100 })).toThrow('passiveProbeIntervalMs')
    expect(() => resolveConfig({ outputLanguage: 'fr' as never })).toThrow('outputLanguage')
    expect(() => resolveConfig({ trialTimeoutMs: 0 })).toThrow('trialTimeoutMs')
    expect(() => resolveConfig({ trialMaxResultChars: 10 })).toThrow('trialMaxResultChars')
    expect(() => resolveConfig({ backupCount: 0 })).toThrow('backupCount')
    expect(() => resolveConfig({ writeEnabled: 'yes' as never })).toThrow('writeEnabled')
    expect(() => resolveConfig({ trialEnabled: 1 as never })).toThrow('trialEnabled')
  })

  it('defaults the passive probe loop off and the console features on', () => {
    expect(resolveConfig(undefined)).toMatchObject({
      passiveProbeEnabled: false,
      outputLanguage: 'en',
      trialEnabled: true,
      trialTimeoutMs: 120_000,
      trialMaxResultChars: 60_000,
      writeEnabled: true,
      backupCount: 5,
    })
  })

  it('accepts every documented output language', () => {
    expect(resolveConfig({ outputLanguage: 'es' }).outputLanguage).toBe('es')
    expect(resolveConfig({ outputLanguage: 'pt' }).outputLanguage).toBe('pt')
    expect(resolveConfig({ outputLanguage: 'hi' }).outputLanguage).toBe('hi')
  })
})

describe('console actions', () => {
  it('previewPatch renders a fragment without touching any file', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)])
    const preview = harness.service.previewPatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }))
    expect(preview.ops).toBe(1)
    expect(preview.fragment).toContain('- insert:')
    expect(preview.fragment).toContain("name: '@deepseek-ai/dsh-mcp-client'")
  })

  it('rejects invalid operations before anything is written', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)])
    expect(() => harness.service.previewPatch(JSON.stringify({ kind: 'frobnicate' }))).toThrow('invalid patch operation')
    expect(() => harness.service.previewPatch('not-json')).toThrow('not valid JSON')
  })

  it('writePatch appends with a backup and reports the interactive approval path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-mcp-panel-service-'))
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)])
    ;(harness.ctx as { baseUrl?: string }).baseUrl = dir
    const result = await harness.service.writePatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }), true, undefined)
    expect(result.approvalPath).toBe('interactive-confirmation')
    expect(result.file).toBe(join(dir, 'cordis.patch.yml'))
    expect(result.backupPath.startsWith(`${result.file}.bak-`)).toBe(true)
    const content = await readFile(result.file, 'utf8')
    expect(content).toContain('serverName: new')
  })

  it('writePatch fails closed without confirmation and without a profile path', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)])
    // No baseUrl: the profile patch path is unknown, so the write refuses.
    await expect(harness.service.writePatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }), true, undefined)).rejects.toThrow('patch path is unknown')
    // With a path but no confirmation: still fail closed.
    const dir = await mkdtemp(join(tmpdir(), 'dsh-mcp-panel-service-'))
    ;(harness.ctx as { baseUrl?: string }).baseUrl = dir
    await expect(harness.service.writePatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }), false, undefined)).rejects.toThrow('needs confirmation')
  })

  it('writePatch honors the writeEnabled kill switch', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)], { writeEnabled: false })
    await expect(harness.service.writePatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }), true, undefined)).rejects.toThrow('writeEnabled')
  })

  it('routes the write through ctx.approval when an agent with an open turn exists', async () => {
    const asked: Array<{ toolName: string; agent: unknown }> = []
    const approval = { request: async (req: { toolName: string; agent: unknown }) => { asked.push(req); return 'allowed-once' } }
    const dir = await mkdtemp(join(tmpdir(), 'dsh-mcp-panel-service-'))
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)])
    ;(harness.ctx as { baseUrl?: string }).baseUrl = dir
    harness.ctx.provide('approval', approval as never)
    harness.ctx.provide('agents', {
      get: (id: string) => id === 's1' ? { session: { events: [{ type: 'turn/start' }] } } : undefined,
    } as never)
    const result = await harness.service.writePatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }), true, 's1')
    expect(result.approvalPath).toBe('harness-approval')
    expect(asked).toEqual([{
      toolName: 'mcp-panel/writePatch',
      reason: 'append a dsh-mcp-panel operation (add) to the profile patch layer',
      agent: { session: { events: [{ type: 'turn/start' }] } },
    }])
  })

  it('detects an open turn through a real Session (alpha.5 snapshotEvents surface)', async () => {
    const asked: Array<{ toolName: string; agent: unknown }> = []
    const approval = { request: async (req: { toolName: string; agent: unknown }) => { asked.push(req); return 'allowed-once' } }
    const dir = await mkdtemp(join(tmpdir(), 'dsh-mcp-panel-service-'))
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)])
    ;(harness.ctx as { baseUrl?: string }).baseUrl = dir
    harness.ctx.provide('approval', approval as never)
    harness.session.append('turn/start', { turn: 1 })
    harness.ctx.provide('agents', {
      get: (id: string) => id === 's1' ? { session: harness.session } : undefined,
    } as never)
    const result = await harness.service.writePatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }), true, 's1')
    expect(result.approvalPath).toBe('harness-approval')
    expect(asked).toHaveLength(1)
  })

  it('a rejected approval denies the write even when confirmed', async () => {
    const approval = { request: async () => 'rejected' }
    const dir = await mkdtemp(join(tmpdir(), 'dsh-mcp-panel-service-'))
    const harness = await mountHarness([mcpRow('mcp-github', STDIO_CONFIG)])
    ;(harness.ctx as { baseUrl?: string }).baseUrl = dir
    harness.ctx.provide('approval', approval as never)
    harness.ctx.provide('agents', { get: () => ({ session: { events: [{ type: 'turn/start' }] } }) } as never)
    await expect(harness.service.writePatch(JSON.stringify({
      kind: 'add',
      config: { serverName: 'new', transport: 'stdio', command: 'node' },
    }), true, 's1')).rejects.toThrow('rejected')
  })

  it('callTool runs a registered mcp__ tool through the registry pipeline', async () => {
    const harness = await mountHarness([mcpRow('mcp-demo', { serverName: 'demo', transport: 'stdio', command: 'node' })])
    const seen: unknown[] = []
    harness.ctx.tools.register({
      name: 'mcp__demo__echo',
      description: 'Echo',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [{ type: 'text', text: 'done' }] },
      execute: (args: unknown) => { seen.push(args); return Promise.resolve(null) },
    })
    const result = await harness.service.callTool(JSON.stringify({
      serverName: 'demo',
      toolName: 'mcp__demo__echo',
      argsJson: '{"who":"panel"}',
    }), undefined)
    expect(result.isError).toBe(false)
    expect(seen).toEqual([{ who: 'panel' }])
    expect(JSON.parse(result.resultJson)).toEqual({ value: null, content: [{ type: 'text', text: 'done' }] })
  })

  it('callTool rejects cross-server names, unknown tools, bad JSON, and disabled trials', async () => {
    const harness = await mountHarness([mcpRow('mcp-demo', { serverName: 'demo', transport: 'stdio', command: 'node' })])
    harness.ctx.tools.register({
      name: 'mcp__demo__echo',
      description: 'Echo',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [] },
      execute: () => Promise.resolve(null),
    })
    await expect(harness.service.callTool(JSON.stringify({ serverName: 'other', toolName: 'mcp__demo__echo', argsJson: '{}' }), undefined))
      .rejects.toThrow('does not belong to server')
    await expect(harness.service.callTool(JSON.stringify({ serverName: 'demo', toolName: 'mcp__demo__nope', argsJson: '{}' }), undefined))
      .rejects.toThrow('not registered')
    await expect(harness.service.callTool(JSON.stringify({ serverName: 'demo', toolName: 'mcp__demo__echo', argsJson: '{' }), undefined))
      .rejects.toThrow('not valid JSON')
    const disabled = await mountHarness([mcpRow('mcp-demo', { serverName: 'demo', transport: 'stdio', command: 'node' })], { trialEnabled: false })
    await expect(disabled.service.callTool(JSON.stringify({ serverName: 'demo', toolName: 'mcp__demo__echo', argsJson: '{}' }), undefined))
      .rejects.toThrow('trialEnabled')
  })
})
