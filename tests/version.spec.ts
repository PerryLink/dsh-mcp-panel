/**
 * Version-consistency tripwire: the probe's MCP `clientInfo.version` is
 * advertised on the wire, so it must track the package version or probe
 * handshakes claim a stale release. Bumping `package.json` without touching
 * `PROBE_CLIENT_INFO` fails this test.
 *
 * @module dsh-mcp-panel/test/version.spec
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PROBE_CLIENT_INFO } from '../src/probe.ts'

/** Read the package manifest next to this source tree. */
function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  return pkg.version
}

describe('probe clientInfo version', () => {
  it('matches the package version', () => {
    expect(PROBE_CLIENT_INFO.version).toBe(packageVersion())
  })

  it('advertises the panel identity on the wire', () => {
    expect(PROBE_CLIENT_INFO.name).toBe('dsh-mcp-panel')
  })
})
