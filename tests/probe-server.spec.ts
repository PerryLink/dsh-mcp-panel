/**
 * Sealed fake Streamable HTTP server tests (community five-layer model,
 * adversarial fixture): a real `node:http` server bound to loopback drives
 * `probeEndpoint`/`probeJob` through 2xx-JSON, 401, 404, malformed-body, and
 * hang→timeout modes. No external network: the server listens on 127.0.0.1
 * only and is closed at the end of the suite.
 *
 * @module dsh-mcp-panel/test/probe-server.spec
 */

import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { probeEndpoint, probeJob } from '../src/probe.ts'

let server: Server
let baseUrl = ''

beforeAll(async () => {
  server = createServer((request, response) => {
    switch (request.url) {
      case '/unauthorized':
        response.writeHead(401, { 'content-type': 'text/plain' })
        response.end('unauthorized')
        return
      case '/notfound':
        response.writeHead(404, { 'content-type': 'text/plain' })
        response.end('not found')
        return
      case '/malformed':
        // A 2xx whose body is not JSON: connectivity succeeded, metadata absent.
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end('<html>definitely not json</html>')
        return
      case '/hang':
        // Never respond: the caller's timeout/abort must end the probe.
        return
      default:
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ result: { serverInfo: { name: 'fake-server', version: '1.0.0' } } }))
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fake server did not bind to a port')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

describe('probeEndpoint against a sealed fake server', () => {
  it('reports a successful MCP initialize with server info', async () => {
    const outcome = await probeEndpoint(`${baseUrl}/ok`, {}, 1000, new AbortController().signal)
    expect(outcome).toMatchObject({ status: 'completed' })
    expect(outcome.detail).toContain('MCP initialize ok (server fake-server 1.0.0)')
  })

  it('reports a 401 as a failed probe', async () => {
    const outcome = await probeEndpoint(`${baseUrl}/unauthorized`, {}, 1000, new AbortController().signal)
    expect(outcome).toMatchObject({ status: 'failed' })
    expect(outcome.detail).toMatch(/HTTP 401/)
  })

  it('reports a 404 as a failed probe', async () => {
    const outcome = await probeEndpoint(`${baseUrl}/notfound`, {}, 1000, new AbortController().signal)
    expect(outcome).toMatchObject({ status: 'failed' })
    expect(outcome.detail).toMatch(/HTTP 404/)
  })

  it('degrades to unnamed metadata for a 2xx non-JSON body', async () => {
    const outcome = await probeEndpoint(`${baseUrl}/malformed`, {}, 1000, new AbortController().signal)
    expect(outcome).toMatchObject({ status: 'completed' })
    expect(outcome.detail).toContain('server unnamed unknown version')
  })
})

describe('probeJob timeout against a sealed fake server', () => {
  it('aborts a hanging endpoint and settles the done hook as failed', async () => {
    const hooks = probeJob({ kind: 'http', url: `${baseUrl}/hang`, headers: {} }, 50)
    const outcome = await hooks.done
    expect(outcome).toMatchObject({ status: 'failed' })
    expect(outcome.detail).toMatch(/timeout after 50ms or cancelled/)
  })
})
