/**
 * Lifecycle and export-contract suite: the HMR-safety test (dispose the
 * contributing fiber, re-query the authoritative registries), the
 * default-export guard (module namespace + Loader unwrap round-trip), the
 * tool three-interface assertion (model schema + canonical value + content
 * blocks), and the explicit resolveConfig negative (the second fail-loud
 * layer beyond the Loader's Schemastery pass).
 *
 * @module dsh-mcp-panel/test/lifecycle.spec
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { resolveConfig } from '../src/config.ts'
import { makeAgent, mcpRow } from './harness.ts'

const WEB_CONFIG = {
  serverName: 'web',
  transport: 'streamable-http',
  url: 'http://localhost:3000/mcp',
  headers: {},
}

function fakeJobs() {
  const started: Array<{ kind: string; label: string; owner: unknown }> = []
  return {
    started,
    attachController: () => () => undefined,
    start: (spec: { kind: string; label: string; owner?: unknown }) => {
      started.push({ kind: spec.kind, label: spec.label, owner: spec.owner })
      return 'mcp-probe-1'
    },
    list: () => [],
  }
}

async function mount(config: Record<string, unknown> = {}, jobs?: unknown, entries: unknown[] = []) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  const session = ctx.sessions.create(SessionId('dsh-mcp-panel-lifecycle'))
  ctx.provide('systemPrompt', { tools: () => () => undefined, section: () => () => undefined } as never)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(CommandRuntime)
  if (jobs !== undefined) ctx.provide('jobs', jobs as never)
  ctx.provide('loader', {
    entries: function* (): IterableIterator<unknown> {
      for (const entry of entries) yield entry
    },
  } as never)
  const plugin = await import('../src/index.ts')
  const pluginFiber = await ctx.plugin(plugin as unknown as import('@deepseek-ai/cordis').Plugin, config)
  return { ctx, session, agent: makeAgent(session), pluginFiber }
}

// ---------------------------------------------------------------------------
// C2: the function-plugin namespace must survive Loader unwrapping
// ---------------------------------------------------------------------------

describe('export contract', () => {
  it('module carries no default export and Loader unwrap round-trips the namespace', async () => {
    const plugin = await import('../src/index.ts')
    expect('default' in plugin).toBe(false)
    const loader = Object.create(Loader.prototype)
    const unwrapped = loader.unwrapExports(plugin)
    expect(unwrapped).toBe(plugin)
    expect(unwrapped.name).toBe('mcp-panel')
    expect(unwrapped.inject).toEqual(['tools', 'loader'])
    expect(typeof unwrapped.Config).toBe('function')
    expect(typeof unwrapped.apply).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// C1: disposing the contributing fiber removes every registry contribution
// ---------------------------------------------------------------------------

describe('fiber disposal', () => {
  it('removes the service, the /mcp command, and the mcp_probe tool on dispose', async () => {
    const harness = await mount({ probeEnabled: true }, fakeJobs())
    try {
      expect(harness.ctx.get('mcpPanel')).toBeDefined()
      expect(harness.ctx.commands.list(harness.agent).find(entry => entry.name === 'mcp')).toBeDefined()
      expect(harness.ctx.tools.get('mcp_probe')).toBeDefined()

      await harness.pluginFiber.dispose()

      expect(harness.ctx.get('mcpPanel')).toBeUndefined()
      expect(harness.ctx.commands.list(harness.agent).find(entry => entry.name === 'mcp')).toBeUndefined()
      expect(harness.ctx.tools.get('mcp_probe')).toBeUndefined()
    } finally {
      await harness.ctx.fiber.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// U2: the mcp_probe tool three interfaces in one assertion
// ---------------------------------------------------------------------------

describe('mcp_probe three interfaces', () => {
  it('keeps the model schema, canonical value, and content blocks stable', async () => {
    const jobs = fakeJobs()
    const harness = await mount({ probeEnabled: true }, jobs, [mcpRow('mcp-web', WEB_CONFIG)])
    try {
      const schemas = harness.ctx.tools.schemas()
      const schema = schemas.find(entry => entry.name === 'mcp_probe')
      expect(schema).toBeDefined()
      // The registry's normalized model projection: `required: true` collapses
      // into the top-level required list.
      expect(schema!.parameters).toEqual({
        type: 'object',
        properties: {
          server: {
            type: 'string',
            description: 'serverName of a configured streamable-http MCP server (see /mcp for the list).',
          },
        },
        required: ['server'],
      })

      const definition = harness.ctx.tools.get('mcp_probe')!
      const value = await definition.execute({ server: 'web' }, { signal: new AbortController().signal } as never)
      expect(value).toEqual({
        jobId: 'mcp-probe-1',
        note: 'Probe results are panel-only: Settings → Plugins → MCP.',
      })

      const content = definition.output.render({ server: 'web' } as never, value as never)
      expect(content).toEqual([{
        type: 'text',
        text: 'Probe started (background job mcp-probe-1). Read the result in the MCP panel: Settings → Plugins → MCP.',
      }])
    } finally {
      await harness.ctx.fiber.dispose()
    }
  })
})

// ---------------------------------------------------------------------------
// U4: the explicit resolveConfig layer rejects out-of-bounds values
// ---------------------------------------------------------------------------

describe('resolveConfig fail-loud', () => {
  it('rejects a non-integer maxProbes with the real message', () => {
    expect(() => resolveConfig({ maxProbes: 1.5 })).toThrow(/maxProbes must be an integer between 1 and 100/u)
  })

  it('rejects a closed-enum outputLanguage with the real message', () => {
    expect(() => resolveConfig({ outputLanguage: 'de' } as never)).toThrow(/outputLanguage must be one of "en", "zh", "es", "pt", "hi"/u)
  })

  it('rejects a probeTimeoutMs below the floor', () => {
    expect(() => resolveConfig({ probeTimeoutMs: 0 })).toThrow(/probeTimeoutMs must be a finite number between 1 and/u)
  })
})
