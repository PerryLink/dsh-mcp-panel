/**
 * Health-diagnostic derivation tests: error-text patterns map to stable
 * suggestion codes, budget/phase facts add lifecycle suggestions, and absent
 * facts produce no fabricated diagnosis.
 *
 * @module dsh-mcp-panel/test/diagnostics.spec
 */

import { describe, expect, it } from 'vitest'
import { diagnoseServer, type McpHealthFacts } from '../src/diagnostics.ts'

function facts(overrides: Partial<McpHealthFacts> = {}): McpHealthFacts {
  return {
    lastError: null,
    phase: 'unknown',
    attempt: -1,
    maxAttempts: -1,
    fiberPhase: 'active',
    transport: 'stdio',
    probeState: null,
    enabled: true,
    ...overrides,
  }
}

const codesOf = (input: McpHealthFacts): string[] => diagnoseServer(input).map(entry => entry.code)

describe('diagnoseServer', () => {
  it('maps spawn/dependency failures to command-not-found', () => {
    expect(codesOf(facts({ lastError: "spawn npx ENOENT" }))).toContain('command-not-found')
    expect(codesOf(facts({ lastError: "'npx' is not recognized as an internal or external command" }))).toContain('command-not-found')
  })

  it('maps network failure classes', () => {
    expect(codesOf(facts({ lastError: 'fetch failed ECONNREFUSED 127.0.0.1:3000' }))).toContain('connection-refused')
    expect(codesOf(facts({ lastError: 'ETIMEDOUT after 60000ms' }))).toContain('timeout')
    expect(codesOf(facts({ lastError: 'getaddrinfo ENOTFOUND api.example.com' }))).toContain('dns')
    expect(codesOf(facts({ lastError: 'HTTP 401 Unauthorized' }))).toContain('auth-401')
    expect(codesOf(facts({ lastError: 'HTTP 403 Forbidden' }))).toContain('auth-403')
    expect(codesOf(facts({ lastError: 'HTTP 404 Not Found' }))).toContain('path-404')
    expect(codesOf(facts({ lastError: 'HTTP 429 Too Many Requests' }))).toContain('rate-limit')
    expect(codesOf(facts({ lastError: 'EACCES permission denied' }))).toContain('permission')
  })

  it('adds lifecycle suggestions from the reconnect budget and phases', () => {
    expect(codesOf(facts({ phase: 'exhausted' }))).toContain('reconnect-exhausted')
    expect(codesOf(facts({ phase: 'waiting' }))).toContain('reconnect-waiting')
    expect(codesOf(facts({ phase: 'connecting', attempt: 10, maxAttempts: 10 }))).toContain('reconnect-exhausted')
    expect(codesOf(facts({ fiberPhase: 'failed' }))).toContain('entry-failed')
    expect(codesOf(facts({ probeState: 'unreachable' }))).toContain('connection-refused')
  })

  it('derives nothing from absent facts and does not fabricate exit codes', () => {
    expect(diagnoseServer(facts())).toEqual([])
    expect(diagnoseServer(facts({ phase: 'connected' }))).toEqual([])
  })
})
