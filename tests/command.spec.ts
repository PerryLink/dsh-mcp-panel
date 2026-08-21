/**
 * `/mcp` command tests through the REAL commands and tools services:
 * registration, the listing row format, tool listings, controlled
 * enable/disable patch suggestions, usage errors, honest unknown status,
 * upstream `mcp/status` consumption, secret exclusion, log
 * reconstructability, and the optional probe tool.
 *
 * @module dsh-mcp-panel/test/command.spec
 */

import { describe, expect, it } from 'vitest'
import { mcpRow, mountHarness, nestedMcpRow, runCommand } from './harness.ts'
import { parseMcpArgs } from '../src/command.ts'

function text(result: unknown): string {
  return (result as { result?: { text?: string }; text?: string }).result?.text ?? (result as { text?: string }).text ?? ''
}

const GITHUB_CONFIG = {
  serverName: 'github',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_TOKEN: 'env-secret' },
}

const WEB_CONFIG = {
  serverName: 'web',
  transport: 'streamable-http',
  url: 'http://localhost:3000/mcp?token=url-secret',
  headers: { Authorization: 'Bearer header-secret' },
}

/** Fake job registry recording every start; the panel's probe paths read it. */
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

describe('/mcp command', () => {
  it('registers with its usage hint', async () => {
    const harness = await mountHarness()
    expect(harness.ctx.commands.list(harness.agent).map(command => command.name)).toContain('mcp')
    expect(harness.ctx.commands.find(harness.agent, 'mcp')).toMatchObject({
      input: { hint: '[server] [tools|call|health|disable|enable|probe]' },
    })
  })

  it('reports no servers when none are configured', async () => {
    const harness = await mountHarness()
    const result = await runCommand(harness, '/mcp')
    expect(result?.result.kind).toBe('success')
    expect(text(result)).toContain('No MCP servers configured')
  })

  it('lists servers with transport, target, tool counts, and honest unknown status', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG), mcpRow('mcp-web', WEB_CONFIG)])
    harness.ctx.tools.register({
      name: 'mcp__github__create_issue',
      description: 'Create an issue',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [] },
      execute: () => Promise.resolve(null),
    })
    harness.ctx.tools.register({
      name: 'mcp__web__search',
      description: 'Search the web',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [] },
      execute: () => Promise.resolve(null),
    })
    const output = text(await runCommand(harness, '/mcp'))
    expect(output).toContain('MCP servers (2):')
    expect(output).toContain('- github [mcp-github] stdio npx -y @modelcontextprotocol/server-github | 1 tools | enabled')
    expect(output).toContain('status: unknown (source: derived)')
    expect(output).toContain('reconnects: —')
    expect(output).toContain('last error: —')
    expect(output).toContain('- web [mcp-web] streamable-http http://localhost:3000/mcp?token=*** | 1 tools | enabled')
    // Secrets from env, headers, and the URL query never reach the output.
    expect(output).not.toContain('env-secret')
    expect(output).not.toContain('header-secret')
    expect(output).not.toContain('url-secret')
  })

  it('lists one server detail with /mcp <server>', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    const output = text(await runCommand(harness, '/mcp github'))
    expect(output).toContain('- github [mcp-github] stdio npx')
  })

  it('lists tool names with descriptions via /mcp <server> tools', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    harness.ctx.tools.register({
      name: 'mcp__github__create_issue',
      description: 'Create a new issue in a GitHub repository',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [] },
      execute: () => Promise.resolve(null),
    })
    const output = text(await runCommand(harness, '/mcp github tools'))
    expect(output).toContain('Tools of "github" (1, model-visible public names):')
    expect(output).toContain('- mcp__github__create_issue — Create a new issue in a GitHub repository')
  })

  it('reports no tools honestly instead of guessing', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    const output = text(await runCommand(harness, '/mcp github tools'))
    expect(output).toContain('No tools registered for "github"')
  })

  it('suggests the exact patch line for disable without editing anything', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    const output = text(await runCommand(harness, '/mcp github disable'))
    expect(output).toContain("- set: { id: mcp-github, name: '@deepseek-ai/dsh-mcp-client', disabled: true }")
    expect(output).toContain('has no runtime toggle')
    expect(output).toContain('never edits your config')
    // The loader row is untouched: the command only suggested a patch.
    const rows = [...harness.ctx.loader.entries()]
    expect(rows[0]?.disabled).toBe(false)
  })

  it('suggests the enable patch for a disabled row', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG, 2, true)])
    const output = text(await runCommand(harness, '/mcp github enable'))
    expect(output).toContain("- set: { id: mcp-github, name: '@deepseek-ai/dsh-mcp-client', disabled: false }")
  })

  it('suggests the user-writable id for rows nested under a loader group', async () => {
    // entry.id carries the enclosing group prefix (`include:`); patch files
    // match the bare options.id, so the suggestion must use the bare id.
    const harness = await mountHarness([nestedMcpRow('include', 'mcp-github', GITHUB_CONFIG)])
    const listOutput = text(await runCommand(harness, '/mcp'))
    expect(listOutput).toContain('- github [mcp-github] stdio')
    expect(listOutput).not.toContain('include:mcp-github')
    const output = text(await runCommand(harness, '/mcp github disable'))
    expect(output).toContain("- set: { id: mcp-github, name: '@deepseek-ai/dsh-mcp-client', disabled: true }")
    expect(output).not.toContain('include:mcp-github')
  })

  it('rejects unknown servers and bad usage', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    const unknown = await runCommand(harness, '/mcp nope tools')
    expect(unknown?.result.kind).toBe('error')
    expect(text(unknown)).toContain('Unknown MCP server "nope"')
    const usage = await runCommand(harness, '/mcp github tools extra')
    expect(usage?.result.kind).toBe('error')
    expect(text(usage)).toContain('Usage: /mcp')
  })

  it('marks leftover mcp__ namespaces as unconfigured, not disabled', async () => {
    const harness = await mountHarness([])
    harness.ctx.tools.register({
      name: 'mcp__foreign__thing',
      description: 'A tool from another plugin',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [] },
      execute: () => Promise.resolve(null),
    })
    const output = text(await runCommand(harness, '/mcp'))
    expect(output).toContain('MCP servers (1):')
    expect(output).toContain('unconfigured')
    expect(output).not.toContain('| disabled')
  })

  it('refuses a patch suggestion for a leftover namespace instead of emitting an empty id', async () => {
    const harness = await mountHarness([])
    harness.ctx.tools.register({
      name: 'mcp__foreign__thing',
      description: 'A tool from another plugin',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [] },
      execute: () => Promise.resolve(null),
    })
    const result = await runCommand(harness, '/mcp foreign disable')
    expect(result?.result.kind).toBe('error')
    const output = text(result)
    expect(output).toContain('not a configured server')
    expect(output).not.toContain('id:')
  })

  it('consumes upstream mcp/status events: phase, reconnects, errors', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    harness.ctx.emit('mcp/status', {
      serverName: 'github',
      phase: 'waiting',
      attempt: 2,
      maxAttempts: 10,
      delayMs: 2000,
      error: 'spawn failed GITHUB_TOKEN=secret-token',
      toolCount: 0,
    })
    const output = text(await runCommand(harness, '/mcp github'))
    expect(output).toContain('status: waiting (source: upstream-event)')
    expect(output).toContain('retry in 2000ms')
    expect(output).not.toContain('secret-token')
    harness.ctx.emit('mcp/status', { serverName: 'github', phase: 'connecting', attempt: 3, maxAttempts: 10, toolCount: 0 })
    const after = text(await runCommand(harness, '/mcp github'))
    expect(after).toContain('status: connecting (source: upstream-event)')
    expect(after).toContain('reconnects: 1')
  })

  it('is reconstructable from the session log (command/run + command/done)', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    await runCommand(harness, '/mcp github')
    const events = harness.session.events.map(event => event.type)
    expect(events).toContain('command/run')
    expect(events).toContain('command/done')
    const done = harness.session.events.find(event => event.type === 'command/done')
    expect(done?.data).toMatchObject({ kind: 'success' })
  })
})

describe('mcp_probe tool (optional)', () => {
  it('is not registered when the jobs service is absent', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', WEB_CONFIG)])
    expect(harness.ctx.tools.get('mcp_probe')).toBeUndefined()
  })

  it('starts an unowned panel-only background job and returns no probe detail', async () => {
    const jobs = fakeJobs()
    const harness = await mountHarness([mcpRow('mcp-web', WEB_CONFIG)], {}, jobs as never)
    const definition = harness.ctx.tools.get('mcp_probe')
    expect(definition).toBeDefined()
    const value = await definition!.execute({ server: 'web' }, {
      signal: new AbortController().signal,
    } as never)
    expect(value).toEqual({
      jobId: 'mcp-probe-1',
      note: 'Probe results are panel-only: Settings → Plugins → MCP.',
    })
    expect(jobs.started).toHaveLength(1)
    expect(jobs.started[0]).toMatchObject({ kind: 'mcp-probe', label: 'mcp_probe web' })
    // No owner: the job registry can never inject a completion notice into the model.
    expect(jobs.started[0]!.owner).toBeUndefined()
  })

  it('probes stdio servers and rejects unknown names', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)], {}, fakeJobs() as never)
    const definition = harness.ctx.tools.get('mcp_probe')!
    const result = await definition.execute({ server: 'github' }, { signal: new AbortController().signal } as never) as { jobId: string }
    expect(result.jobId).toBe('mcp-probe-1')
    await expect(definition.execute({ server: 'missing' }, { signal: new AbortController().signal } as never))
      .rejects.toThrow('not a configured MCP server (see /mcp)')
  })

  it('can be disabled by config', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', WEB_CONFIG)], { probeEnabled: false }, fakeJobs() as never)
    expect(harness.ctx.tools.get('mcp_probe')).toBeUndefined()
  })
})

describe('/mcp <server> probe command action', () => {
  it('starts an unowned panel-only probe and returns its job id', async () => {
    const jobs = fakeJobs()
    const harness = await mountHarness([mcpRow('mcp-web', WEB_CONFIG)], {}, jobs as never)
    const result = await runCommand(harness, '/mcp web probe')
    expect(result?.result.kind).toBe('success')
    expect(text(result)).toContain('Probe started for "web" (background job mcp-probe-1)')
    expect(text(result)).toContain('Settings → Plugins → MCP')
    expect(jobs.started).toEqual([{ kind: 'mcp-probe', label: 'mcp_probe web', owner: undefined }])
  })

  it('starts a stdio probe for stdio servers', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)], {}, fakeJobs() as never)
    const result = await runCommand(harness, '/mcp github probe')
    expect(result?.result.kind).toBe('success')
    expect(text(result)).toContain('Probe started for "github" (background job mcp-probe-1)')
  })

  it('reports a missing job registry as an error result', async () => {
    const harness = await mountHarness([mcpRow('mcp-web', WEB_CONFIG)])
    const result = await runCommand(harness, '/mcp web probe')
    expect(result?.result.kind).toBe('error')
    expect(text(result)).toContain('ctx.jobs is not composed')
  })
})

describe('/mcp health and call console actions', () => {
  it('renders the health block with derived suggestions and honest pending markers', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    harness.ctx.emit('mcp/status', {
      serverName: 'github',
      phase: 'waiting',
      attempt: 2,
      maxAttempts: 10,
      error: 'spawn npx ENOENT',
      toolCount: 0,
    })
    const output = text(await runCommand(harness, '/mcp github health'))
    expect(output).toContain('Health of "github":')
    expect(output).toContain('Suggestions:')
    expect(output).toContain('command-not-found')
    expect(output).toContain('reconnect-waiting')
    expect(output).toContain('pending upstream support')
    expect(output).not.toContain('ENOENT-secret')
  })

  it('trial-calls a tool through the official pipeline and reports the canonical result', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    harness.ctx.tools.register({
      name: 'mcp__github__create_issue',
      description: 'Create an issue',
      parameters: {},
      output: { schema: { type: 'null' }, render: () => [{ type: 'text', text: 'created' }] },
      execute: () => Promise.resolve(null),
    })
    const result = await runCommand(harness, '/mcp github call mcp__github__create_issue {"title":"hi"}')
    expect(result?.result.kind).toBe('success')
    const output = text(result)
    expect(output).toContain('Trial call mcp__github__create_issue through the official tool pipeline')
    expect(output).toContain(': ok.')
    expect(output).toContain('"value": null')
    expect(output).toContain('created')
  })

  it('reports trial-call errors as error results without touching any config', async () => {
    const harness = await mountHarness([mcpRow('mcp-github', GITHUB_CONFIG)])
    const unknown = await runCommand(harness, '/mcp github call mcp__github__nope {}')
    expect(unknown?.result.kind).toBe('error')
    expect(text(unknown)).toContain('not registered')
  })

  it('parses call arguments with embedded whitespace verbatim', () => {
    expect(parseMcpArgs('github call mcp__github__t {"a": 1, "b": "two words"}')).toEqual({
      kind: 'server',
      server: 'github',
      action: 'call',
      tool: 'mcp__github__t',
      argsJson: '{"a": 1, "b": "two words"}',
    })
    expect(parseMcpArgs('github call')).toEqual({ kind: 'usage' })
  })
})
