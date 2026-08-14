/**
 * Shared test harness: real Cordis Context, real Session/ToolRuntime/
 * CommandRuntime services, a fake Loader face, and a minimal fake Agent.
 * The `/mcp` command is exercised through the REAL commands service, so the
 * command/run + command/done lifecycle events land in a real session log.
 *
 * @module dsh-mcp-panel/test/harness
 */

import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { McpLoaderRow } from '../src/aggregate.ts'
import type { McpPanelService } from '../src/service.ts'

/** Fake loader entry: the stable Entry face the service reads. */
export interface FakeEntry {
  /** Loader-composed id (may carry an enclosing group prefix such as `include:`). */
  readonly id: string
  readonly disabled: boolean
  readonly fiber: { readonly state: number } | undefined
  readonly options: {
    readonly id: string
    readonly name: string
    readonly config?: unknown
  }
}

/** Build one fake mcp-client loader row. */
export function mcpRow(entryId: string, config: unknown, state = 2, disabled = false): FakeEntry {
  return {
    id: entryId,
    disabled,
    fiber: state === -1 ? undefined : { state },
    options: { id: entryId, name: '@deepseek-ai/dsh-mcp-client', config },
  }
}

/** Build one fake row nested under an enclosing group (group-prefixed `id`). */
export function nestedMcpRow(groupId: string, entryId: string, config: unknown, state = 2, disabled = false): FakeEntry {
  return {
    id: `${groupId}:${entryId}`,
    disabled,
    fiber: state === -1 ? undefined : { state },
    options: { id: entryId, name: '@deepseek-ai/dsh-mcp-client', config },
  }
}

/**
 * A structurally complete fake agent: real session, real context; every
 * driver-shaped member is a no-op (the commands service only reads
 * `agent.session` and uses the agent as a scope key).
 *
 * @param session - the agent's session.
 * @returns the fake agent.
 */
export function makeAgent(session: Session): Agent {
  const fake = {
    id: session.id,
    options: {},
    session,
    inbox: {},
    status: 'idle',
    ctx: new Context(),
    cancel: () => undefined,
    whenIdle: async () => undefined,
    runMaintenance: async (task: (signal: AbortSignal) => Promise<unknown>) => task(new AbortController().signal),
    send: () => undefined,
    followup: () => undefined,
    steer: () => undefined,
    inject: () => undefined,
  }
  return fake as unknown as Agent
}

/** Everything a mounted harness hands back to a test. */
export interface Harness {
  readonly ctx: Context
  readonly session: Session
  readonly agent: Agent
  readonly service: McpPanelService
}

/**
 * Mount real session/tools/commands services, a fake loader, and this plugin.
 *
 * @param entries - fake loader entries (mcp-client rows and others).
 * @param config - raw plugin config.
 * @returns the mounted harness.
 */
export async function mountHarness(entries: FakeEntry[] = [], config: Record<string, unknown> = {}, jobs?: unknown): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  const session = ctx.sessions.create(SessionId('harness-session'))
  ctx.provide('systemPrompt', { tools: () => () => undefined, section: () => () => undefined } as never)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(CommandRuntime)
  if (jobs !== undefined) ctx.provide('jobs', jobs as never)
  ctx.provide('loader', {
    entries: function* (): IterableIterator<FakeEntry> {
      for (const entry of entries) yield entry
    },
  } as never)
  const plugin = await import('../src/index.ts')
  await ctx.plugin(plugin as unknown as import('@deepseek-ai/cordis').Plugin, config)
  const service = ctx.get('mcpPanel') as McpPanelService
  return { ctx, session, agent: makeAgent(session), service }
}

/** Run one slash command through the real commands service. */
export function runCommand(harness: Harness, line: string) {
  return harness.ctx.commands.execute(harness.agent, line, new AbortController().signal)
}

/** Re-exported for specs that assemble loader rows directly. */
export type { McpLoaderRow }
