// Headless /mcp verification over the REAL web profile composition.
// Run from the deepseek-harness checkout:
//   node --import tsx/esm Project/Plugins/dsh-mcp-panel/scripts/verify-headless.mjs
// Boots the profile's full plugin tree (bundles + user patch layers) in
// process, binds the webserver to an ephemeral port (--port 0), executes
// /mcp against a fake agent through the real commands service, and prints
// the exact model-readable output plus the gateway-registered descriptor.
//
// Isolation: by default DSH_HOME is pinned to a throwaway directory under
// the OS temp root, overriding any shell-level or machine-scope value, so
// the profile, sessions, and storages never land in the real dsh home. Pass
// --use-real-home to boot against the default home (~/.dsh) deliberately.
import { loadProfile, loadOptionalPatches, composeEntries, boot, healProfilesModuleFallback } from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { SessionId } from '@deepseek-ai/dsh-session'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BIN = 'dsh-verify-headless'

// The verification home: a fresh mkdtemp sandbox under the OS temp root
// unless --use-real-home opts into the default home. The sandbox is created
// before resolveDshHome() reads the environment, so no inherited DSH_HOME
// (including machine-scope values) can redirect this script at real data.
const useRealHome = process.argv.includes('--use-real-home')
const sandboxHome = useRealHome ? undefined : mkdtempSync(join(tmpdir(), 'dsh-verify-headless-'))
if (sandboxHome !== undefined) process.env.DSH_HOME = sandboxHome
const home = resolveDshHome()
console.log(`[home] ${home} (${useRealHome ? 'real home' : 'temp sandbox'})`)

/**
 * Remove the verification sandbox, refusing any path outside the OS temp root.
 * @param path - the mkdtemp sandbox this script created.
 * @throws when the path is not a descendant of the OS temp root.
 */
function removeSandboxHome(path) {
  const tempRoot = resolve(tmpdir())
  const fromTempRoot = relative(tempRoot, path)
  if (fromTempRoot === '' || fromTempRoot === '..' || fromTempRoot.startsWith(`..${sep}`) || isAbsolute(fromTempRoot)) {
    throw new Error(`dsh-verify-headless: refusing to remove non-temp path ${path}`)
  }
  rmSync(path, { recursive: true, force: true })
}

// The dsh installation anchor: prefer an explicit env override, then walk up
// from this script until a directory carrying apps/cli/package.json is found
// (supports the plugin repo living at any depth under the harness checkout:
// HarnessRoot/<repo>, HarnessRoot/<group>/<repo>, HarnessRoot/Project/Plugins/<repo>).
const anchorCandidates = []
for (let depth = 2; depth <= 6; depth += 1) {
  anchorCandidates.push(new URL(`${'../'.repeat(depth)}apps/cli/package.json`, import.meta.url))
}
if (process.env.DSH_INSTALL_ANCHOR !== undefined) {
  const value = process.env.DSH_INSTALL_ANCHOR
  // Only a full scheme (`http://`, `file://`) counts as a URL; a Windows
  // drive-letter path like `D:\...` must go through pathToFileURL instead of
  // being parsed as a `d:`-schemed URL.
  anchorCandidates.push(/^[a-z][a-z0-9+.-]*:\/\//iu.test(value) ? new URL(value) : pathToFileURL(value))
}
const installAnchorPath = anchorCandidates.map(candidate => fileURLToPath(candidate)).find(path => existsSync(path))
if (installAnchorPath === undefined) {
  throw new Error('dsh-verify-headless: cannot locate apps/cli/package.json — run from inside the deepseek-harness checkout or set DSH_INSTALL_ANCHOR')
}
const installAnchor = installAnchorPath

let ctx
try {
  // The launcher's prepareProfile heals the flat module fallback before loading:
  // the profile's hoisted node_modules carries the plugin itself, and the
  // fallback symlinks resolve its peers (schemastery, cordis, dsh-*) from the
  // installation. Replicate that step here.
  healProfilesModuleFallback(installAnchor, home)

  const profile = loadProfile(BIN, 'web', installAnchor)
  // The launcher's prepareProfile always (re)writes the empty root config: the
  // whole composition is patch layers and the Loader needs a real include root
  // to anchor baseUrl at the profile directory. Replicate that step here.
  const PROFILE_ROOT_CONFIG = `# dsh profile root — an empty entry list. The tree is composed as patches:
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
[]
`
  writeFileSync(join(profile.dir, 'cordis.yml'), PROFILE_ROOT_CONFIG)
  const homePatches = loadOptionalPatches(BIN, join(home, 'cordis.patch.yml')) ?? []
  const layers = structuredClone([
    ...profile.layers.flatMap(layer => layer.patches),
    ...profile.patches,
    ...homePatches,
  ])
  const rootConfig = join(profile.dir, 'cordis.yml')

  ctx = await boot(BIN, rootConfig, layers, (hostCtx) => {
    provideCmdline(hostCtx, { args: ['--port', '0'], exit: () => {} })
  })

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
  await ctx?.fiber.dispose()
  if (sandboxHome !== undefined) removeSandboxHome(sandboxHome)
}
