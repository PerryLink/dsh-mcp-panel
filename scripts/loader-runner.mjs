// scripts/loader-runner.mjs — real Loader composition runner for
// dsh-mcp-panel (community five-layer model, layer 4). An independent process
// boots a real Context, mounts the vendored Loader with the Include builtin,
// reads the given cordis.yml (service rows + plugin row + config), then
// asserts the plugin's contributions through the authoritative registries and
// executes one real behavior (the /mcp command) through the real commands
// service. Config is applied by the Loader, so a successful mount proves the
// built entry is loadable under plain Node (A1) and that inject resolution +
// config application both worked.
//
// Usage: node scripts/loader-runner.mjs <cordis.yml>
// Exit 0 prints DSH_LOADER_RESULT <json>; any load or assertion failure exits
// non-zero with the reason on stderr (used by the invalid-config and
// default-export regression cases).

import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const configArgument = process.argv[2]
if (configArgument === undefined) {
  console.error('usage: loader-runner.mjs <cordis.yml>')
  process.exit(2)
}

const configPath = resolve(configArgument)
// Resolve bare package rows from this repository's dependency tree so the
// composition works with config files written anywhere (e.g. a temp dir).
const configRequire = createRequire(resolve(import.meta.dirname, '../package.json'))

const ctx = new Context()
try {
  ctx.baseUrl = `${pathToFileURL(dirname(configPath)).href}/`
  await ctx.plugin(Loader)
  ctx.loader.internal = /** @type {any} */ ({
    version: 'v2',
    async import(specifier) {
      if (specifier.startsWith('file:')) return import(specifier)
      if (specifier.startsWith('node:')) return import(specifier)
      const absolute = /^([a-zA-Z]:)?[\\/]/u.test(specifier)
      return import(pathToFileURL(absolute ? specifier : configRequire.resolve(specifier)).href)
    },
  })
  ctx.loader.builtins.include = Include
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()

  // Authoritative registries carry the plugin's contributions.
  const service = ctx.get('mcpPanel')
  if (service === undefined) {
    throw new Error('Loader composition: mcpPanel service is missing from the context')
  }
  const session = ctx.sessions.create(SessionId('dsh-mcp-panel-loader-runner'))
  const agent = /** @type {any} */ ({
    id: session.id,
    options: { provider: 'deepseek', model: 'demo-model' },
    session,
    inbox: {},
    status: 'idle',
    ctx,
    cancel: () => undefined,
    whenIdle: async () => undefined,
    runMaintenance: async (task) => task(new AbortController().signal),
    send: () => undefined,
    followup: () => undefined,
    steer: () => undefined,
    inject: () => undefined,
  })
  if (ctx.commands.list(agent).find(entry => entry.name === 'mcp') === undefined) {
    throw new Error('Loader composition: /mcp command is missing from the commands registry')
  }

  // Real behavior: /mcp through the real commands service on an empty
  // composition reports the empty-state line (English default).
  // rc8 execute(agent, line, images, signal): plain invocations carry no images.
  const execution = await ctx.commands.execute(agent, '/mcp', [], new AbortController().signal)
  const text = execution?.result?.text ?? ''
  if (!text.includes('No MCP servers configured')) {
    throw new Error(`Loader composition: /mcp returned ${JSON.stringify(execution?.result)}`)
  }

  const summary = {
    service: 'mcpPanel',
    command: 'mcp',
    commands: ctx.commands.list(agent).map(entry => entry.name),
    tools: ctx.tools.schemas().map(schema => schema.name),
  }
  process.stdout.write(`DSH_LOADER_RESULT ${JSON.stringify(summary)}\n`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await ctx.fiber.dispose()
}
