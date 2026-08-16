/**
 * Probe network-path tests: the `fetch` legs of `probeEndpoint` and the
 * `probeJob` cancel contract. The fetch global is stubbed per case — no real
 * network. Covers 2xx/JSON, 2xx/non-JSON, non-2xx, network failure
 * sanitization, abort, display truncation, and the never-rejecting done hook.
 *
 * @module dsh-mcp-panel/test/probe.spec
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeEndpoint, probeJob, probeStdio } from '../src/probe.ts'

/** Minimal fetch Response face the probe reads. */
function fakeResponse(status: number, statusText: string, jsonBody?: unknown): Response {
  const ok = status >= 200 && status < 300
  return {
    ok,
    status,
    statusText,
    json: async () => {
      if (jsonBody === undefined) throw new Error('not json')
      return jsonBody
    },
  } as unknown as Response
}

const NEVER_ABORTED = new AbortController().signal

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('probeEndpoint', () => {
  it('reports a successful MCP initialize with server info', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, 'OK', {
      result: { serverInfo: { name: 'test-server', version: '1.2.3' } },
    })))
    const outcome = await probeEndpoint('https://example.com/mcp', {}, 1000, NEVER_ABORTED)
    expect(outcome.status).toBe('completed')
    expect(outcome.detail).toContain('HTTP 200')
    expect(outcome.detail).toContain('MCP initialize ok (server test-server 1.2.3)')
  })

  it('degrades to unnamed for a 2xx without a JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, 'OK')))
    const outcome = await probeEndpoint('https://example.com/mcp', {}, 1000, NEVER_ABORTED)
    expect(outcome).toMatchObject({ status: 'completed' })
    expect(outcome.detail).toContain('server unnamed unknown version')
  })

  it('reports non-2xx status without a body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(404, 'Not Found')))
    const outcome = await probeEndpoint('https://example.com/mcp', {}, 1000, NEVER_ABORTED)
    expect(outcome.status).toBe('failed')
    expect(outcome.detail).toMatch(/HTTP 404 Not Found \(\d+ms\)/)
  })

  it('sanitizes network failures before display', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect failed GITHUB_TOKEN=secret-token') }))
    const outcome = await probeEndpoint('https://example.com/mcp', {}, 1000, NEVER_ABORTED)
    expect(outcome.status).toBe('failed')
    expect(outcome.detail).not.toContain('secret-token')
  })

  it('reports the deadline when the caller aborts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
      const signal = init.signal
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }))
    const controller = new AbortController()
    const pending = probeEndpoint('https://example.com/mcp', {}, 1500, controller.signal)
    controller.abort()
    const outcome = await pending
    expect(outcome.status).toBe('failed')
    expect(outcome.detail).toBe('timeout after 1500ms or cancelled')
  })

  it('truncates overlong server-reported names', async () => {
    const longName = 's'.repeat(200)
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, 'OK', {
      result: { serverInfo: { name: longName, version: '1.0.0' } },
    })))
    const outcome = await probeEndpoint('https://example.com/mcp', {}, 1000, NEVER_ABORTED)
    expect(outcome.status).toBe('completed')
    expect(outcome.detail).not.toContain(longName)
    expect(outcome.detail).toContain(`${'s'.repeat(79)}…`)
  })

  it('uses configured headers for the request without exposing them', async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => fakeResponse(200, 'OK', { result: {} }))
    vi.stubGlobal('fetch', fetchMock)
    const outcome = await probeEndpoint('https://example.com/mcp', { Authorization: 'Bearer secret-header' }, 1000, NEVER_ABORTED)
    const headers = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer secret-header')
    expect(outcome.detail).not.toContain('secret-header')
  })
})

describe('probeJob', () => {
  it('cancel aborts the probe and done still settles as failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
      const signal = init.signal
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }))
    const hooks = probeJob('https://example.com/mcp', {}, 1000)
    hooks.cancel()
    const outcome = await hooks.done
    expect(outcome.status).toBe('failed')
  })

  it('done resolves the successful outcome without rejecting', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, 'OK', {
      result: { serverInfo: { name: 'srv', version: '0.1.0' } },
    })))
    const hooks = probeJob('https://example.com/mcp', {}, 1000)
    const outcome = await hooks.done
    expect(outcome.status).toBe('completed')
  })
})
describe('probeStdio', () => {
  const NEVER_ABORTED = new AbortController().signal

  it('completes an initialize handshake over a real stdio child', async () => {
    const script = 'const line = await new Promise((r) => process.stdin.once("data", (d) => r(d.toString())))'
      + '; process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "fake-stdio", version: "9.9.9" } } }) + "\\n")'
    const outcome = await probeStdio(
      { kind: 'stdio', command: process.execPath, args: ['-e', script], env: {} },
      5000,
      NEVER_ABORTED,
    )
    expect(outcome.status).toBe('completed')
    expect(outcome.detail).toContain('server fake-stdio 9.9.9')
  })

  it('reports failure when the child exits without responding', async () => {
    const outcome = await probeStdio(
      { kind: 'stdio', command: process.execPath, args: ['-e', 'process.exit(0)'], env: {} },
      5000,
      NEVER_ABORTED,
    )
    expect(outcome.status).toBe('failed')
    expect(outcome.detail).toContain('process exited before initialize response')
  })
})
