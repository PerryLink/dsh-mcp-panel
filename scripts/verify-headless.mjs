// Headless /mcp verification over the REAL web profile composition.
// Run from the deepseek-harness checkout:
//   node --import tsx/esm Project/Plugins/dsh-mcp-panel/scripts/verify-headless.mjs
// Boots the profile's full plugin tree (bundles + user patch layers) in
// process, binds the webserver to an ephemeral port (--port 0), executes
// /mcp against a fake agent through the real commands service, and prints
// the exact model-readable output plus the gateway-registered descriptor.
import { loadProfile, loadOptionalPatches, composeEntries, boot } from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { SessionId } from '@deepseek-ai/dsh-session'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BIN = 'dsh-verify-headless'
const home = resolveDshHome()
const installAnchor = fileURLToPath(new URL('../../../apps/cli/package.json', import.meta.url))

const profile = loadProfile(BIN, 'web', installAnchor)
const homePatches = loadOptionalPatches(BIN, join(home, 'cordis.patch.yml')) ?? []
const layers = structuredClone([
  ...profile.layers.flatMap(layer => layer.patches),
  ...profile.patches,
  ...homePatches,
])
const rootConfig = join(profile.dir, 'cordis.yml')

const ctx = await boot(BIN, rootConfig, layers, (hostCtx) => {
  provideCmdline(hostCtx, { args: ['--port', '0'], exit: () => {} })
})

try {
  // Gateway registration check: the host typert manifest must be live.
  const descriptor = ctx.typert.local.get('mcpPanel/status')
  console.log(`[gateway] mcpPanel/status typert descriptor: ${descriptor === undefined ? 'MISSING' : 'registered'}`)

  // The mcpPanel service itself.
  const service = ctx.get('mcpPanel')
  const snapshot = service.status()
  console.log(`[service] mcpPanel.status(): ${snapshot.servers.length} server(s), observed=${snapshot.observed}, patchFile=${snapshot.patchFile}`)

  // A fake agent over a real session, exercised through the REAL commands service.
  const session = ctx.sessions.create(SessionId('verify-headless'))
  const agent = {
    id: session.id, options: {}, session, inbox: {}, status: 'idle',
    ctx, cancel: () => undefined, whenIdle: async () => undefined,
    runMaintenance: async (task) => task(new AbortController().signal),
    send: () => undefined, followup: () => undefined, steer: () => undefined, inject: () => undefined,
  }
  const run = async (line) => {
    const execution = await ctx.commands.execute(agent, line, new AbortController().signal)
    return execution
  }

  for (const line of ['/mcp', '/mcp everything tools', '/mcp everything disable']) {
    const execution = await run(line)
    console.log(`\n===== ${line} =====`)
    console.log(`kind: ${execution?.result.kind}`)
    if (execution?.result.text !== undefined) console.log(execution.result.text)
  }

  // Log reconstructability: the command lifecycle events landed in the session.
  const eventTypes = session.events.map(event => event.type)
  console.log(`\n[log] command/run present: ${eventTypes.includes('command/run')}, command/done present: ${eventTypes.includes('command/done')}`)
} finally {
  await ctx.fiber.dispose()
}
