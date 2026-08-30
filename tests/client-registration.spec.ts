// @vitest-environment jsdom
/**
 * Client registration wiring tests: the browser half mounts the exact Remote
 * contribution the host typert manifest carries, registers the settings tab
 * with the right identity, unwraps RemoteResult envelopes, and installs its
 * scoped stylesheet. Pure registration behavior — no component rendering.
 *
 * @module dsh-mcp-panel/test/client-registration.spec
 */

import { describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { apply, NS } from '../src/client/index.ts'
import { MCP_PANEL_REMOTE } from '../src/client/remote.ts'
import { TYPERT } from '../src/typert.host.ts'

/** Fake client root recording every registration the plugin makes. */
function makeCtx(remoteStatus: () => Promise<unknown>, remoteProbe: (name: string) => Promise<unknown> = async () => ({ ok: true, value: { jobId: 'mcp-probe-1', note: 'x' } })) {
  const registered: Array<{ options: Record<string, unknown>; component: unknown }> = []
  const mounted: unknown[] = []
  const slots = {
    inject: vi.fn((_name: string, register: () => void) => { register() }),
    register: vi.fn((options: Record<string, unknown>, component: unknown) => {
      registered.push({ options, component })
      return () => undefined
    }),
  }
  const ctx = {
    locale: {
      register: vi.fn(() => () => undefined),
      bind: vi.fn(() => (key: string) => key),
    },
    remote: {
      $mount: vi.fn(async (contribution: unknown) => {
        mounted.push(contribution)
        return () => undefined
      }),
      mcpPanel: { status: remoteStatus, probe: remoteProbe },
    },
    slots,
    inject: vi.fn((_deps: string[], callback: (scope: unknown) => void) => { callback(ctx) }),
    effect: vi.fn((callback: () => unknown) => {
      callback()
      return () => undefined
    }),
    // The client reads the slots registry through this service lookup; the
    // sessions store stays absent here (the call sites degrade to undefined).
    get: vi.fn((name: string) => (name === 'slots' ? slots : undefined)),
  }
  return { ctx: ctx as unknown as ClientContext, registered, mounted }
}

describe('client apply', () => {
  it('mounts the same descriptor the host typert manifest registers', async () => {
    const { ctx, mounted } = makeCtx(async () => ({ ok: true, value: null }))
    await apply(ctx)
    expect(ctx.remote.$mount).toHaveBeenCalledTimes(1)
    expect(mounted[0]).toBe(MCP_PANEL_REMOTE)
    // The host TYPERT and the client contribution share one canonical
    // descriptor object — the two codecs can never drift.
    expect(MCP_PANEL_REMOTE.descriptors[0]).toBe(TYPERT.invocations[0])
  })

  it('registers the MCP tab with its identity and dictionaries', async () => {
    const { ctx, registered } = makeCtx(async () => ({ ok: true, value: null }))
    await apply(ctx)
    expect(ctx.locale.register).toHaveBeenCalledWith(NS, expect.objectContaining({ zh: expect.anything(), en: expect.anything() }))
    expect(registered).toHaveLength(1)
    expect(registered[0]!.options).toMatchObject({
      name: 'settings.plugins.tab',
      id: 'mcp',
      order: 30,
      locale: 'settings.mcpPanel',
    })
    expect(typeof registered[0]!.options['label']).toBe('function')
  })

  it('unwraps a successful RemoteResult into the snapshot value', async () => {
    const snapshot = { servers: [], probes: [], observed: false, patchFile: null, refreshIntervalMs: 0 }
    const { ctx, registered } = makeCtx(async () => ({ ok: true, value: snapshot }))
    await apply(ctx)
    const injected = (registered[0]!.options['inject'] as () => { status: () => Promise<unknown> })()
    await expect(injected.status()).resolves.toBe(snapshot)
  })

  it('surfaces Remote failures as errors without leaking their envelope', async () => {
    const { ctx, registered } = makeCtx(async () => ({
      ok: false,
      error: { code: 'service-unavailable', message: 'host down', details: {} },
    }))
    await apply(ctx)
    const injected = (registered[0]!.options['inject'] as () => { status: () => Promise<unknown> })()
    await expect(injected.status()).rejects.toThrow('mcpPanel.status failed: service-unavailable: host down')
  })

  it('unwraps a successful probe RemoteResult and forwards failures', async () => {
    type ProbeFace = { ok: true; value: { jobId: string; note: string } } | { ok: false; error: { code: string; message: string } }
    const probe = vi.fn(async (_serverName: string): Promise<ProbeFace> => ({ ok: true, value: { jobId: 'mcp-probe-9', note: 'panel-only' } }))
    const { ctx, registered } = makeCtx(async () => ({ ok: true, value: null }), probe)
    await apply(ctx)
    const injected = (registered[0]!.options['inject'] as () => { probe: (name: string) => Promise<unknown> })()
    await expect(injected.probe('web')).resolves.toEqual({ jobId: 'mcp-probe-9', note: 'panel-only' })
    expect(probe).toHaveBeenCalledWith('web')
    probe.mockResolvedValueOnce({ ok: false, error: { code: 'business', message: 'nope' } })
    await expect(injected.probe('web')).rejects.toThrow('mcpPanel.probe failed: business: nope')
  })

  it('installs the scoped stylesheet once', async () => {
    const { ctx } = makeCtx(async () => ({ ok: true, value: null }))
    await apply(ctx)
    expect(document.querySelector('style[data-dsh-mcp-panel]')).not.toBeNull()
  })
})
