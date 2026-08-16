/**
 * The tool trial console's host half: runs ONE registered `mcp__*` tool
 * through the OFFICIAL pipeline — `ctx.tools.execute()` — so permission
 * policy (`tools/pre-execute`), approval asks, guards, around-dispatch, and
 * post-execute all apply exactly as they do for model calls. The console is
 * a caller, not a bypass.
 *
 * Approval routing: the client may pass the current session id; the service
 * resolves the live agent through `ctx.agents` and forwards it as the
 * execution agent, so an `ask` decision routes to the web approval channel
 * during an open turn. Without an agent, the registry fails the ask closed
 * with its documented "no agent to route it through" denial — the trial
 * result shows that message verbatim.
 *
 * Results are capped (`maxResultChars`) and returned as a single JSON string
 * so the strict wire codec carries one bounded scalar; the client re-parses
 * and pretty-prints. Trial results never enter model context.
 *
 * @module dsh-mcp-panel/trial
 */

import type { ToolExecutionResult, ToolExecutionInput, ToolRuntime } from '@deepseek-ai/dsh-tools'

/** Wire result of one trial call (lossless-JSON scalar payload). */
export interface McpTrialResult {
  /** Panel-assigned correlation id (mirrors the callId on the execution). */
  callId: string
  /** Whether the pipeline settled the call as an error. */
  isError: boolean
  /** Whether the JSON projection hit the display cap. */
  truncated: boolean
  /** Wall-clock duration of the pipeline run in ms. */
  durationMs: number
  /** Capped JSON of `{ value, content }` or `{ error, content }`. */
  resultJson: string
}

/** Live agent registry face the trial reads opportunistically. */
export interface McpAgentRegistryFace {
  get(id: string): unknown | undefined
}

/** One trial request (decoded from the client's JSON). */
export interface McpTrialRequest {
  serverName: string
  toolName: string
  /** JSON text of the arguments (lossless by construction). */
  argsJson: string
}

/** Panel-side limits for one trial call. */
export interface McpTrialLimits {
  /** Deadline for the whole pipeline run. */
  timeoutMs: number
  /** Cap on the JSON projection in chars. */
  maxResultChars: number
}

/** Panel-owned marker prefix so trial callIds can never collide with model calls. */
const TRIAL_CALL_PREFIX = 'mcp-panel-trial'

/** Trial callId counter per service instance. */
let trialCounter = 0

/**
 * Validate one trial request structurally; returns an English error string
 * or null. Never throws on untrusted input.
 *
 * @param request - decoded client JSON.
 * @returns an error message, or null when the shape is acceptable.
 */
export function validateTrialRequest(request: unknown): string | null {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    return 'trial request must be a JSON object'
  }
  const candidate = request as Record<string, unknown>
  const serverName = candidate['serverName']
  if (typeof serverName !== 'string' || serverName === '') return 'serverName is required'
  const toolName = candidate['toolName']
  if (typeof toolName !== 'string' || toolName === '') return 'toolName is required'
  if (typeof candidate['argsJson'] !== 'string') return 'argsJson must be a JSON string'
  return null
}

/**
 * Run one trial call through the official tool pipeline.
 *
 * @param tools - the registry the call executes through.
 * @param agents - optional live agent registry for approval routing.
 * @param sessionId - optional current session id from the client.
 * @param request - the validated trial request.
 * @param limits - panel-side deadline and result cap.
 * @returns the wire result.
 */
export async function runTrialCall(
  tools: ToolRuntime,
  agents: McpAgentRegistryFace | undefined,
  sessionId: string | undefined,
  request: McpTrialRequest,
  limits: McpTrialLimits,
): Promise<McpTrialResult> {
  const { serverName, toolName } = request
  const prefix = `mcp__${serverName}__`
  if (!toolName.startsWith(prefix)) {
    throw new Error(`tool "${toolName}" does not belong to server "${serverName}" (expected the ${prefix}… namespace)`)
  }
  if (tools.get(toolName) === undefined) {
    throw new Error(`tool "${toolName}" is not registered — the server may be down or its sync failed`)
  }
  let argumentsValue: unknown
  try {
    argumentsValue = JSON.parse(request.argsJson)
  } catch {
    throw new Error('argsJson is not valid JSON')
  }
  const agent = sessionId === undefined || sessionId === '' ? undefined : agents?.get(sessionId)
  const callId = `${TRIAL_CALL_PREFIX}-${++trialCounter}` as unknown as ToolExecutionInput['callId']
  const started = Date.now()
  const execution: ToolExecutionInput = {
    callId,
    name: toolName,
    arguments: argumentsValue,
    ...agent === undefined ? {} : { agent: agent as NonNullable<ToolExecutionInput['agent']> },
    signal: AbortSignal.timeout(limits.timeoutMs),
  }
  const result = await tools.execute(execution)
  const durationMs = Date.now() - started
  const { json, truncated } = projectTrialResult(result, limits.maxResultChars)
  return { callId: String(callId), isError: result.isError, truncated, durationMs, resultJson: json }
}

/** Project the registry outcome onto the lossless JSON the client renders. */
function projectTrialResult(result: ToolExecutionResult, budget: number): { json: string; truncated: boolean } {
  const payload = result.isError
    ? {
        error: {
          message: result.error.message,
          ...result.error.info === undefined ? {} : { code: result.error.info.code },
        },
        content: result.content,
      }
    : { value: result.value, content: result.content }
  const { capped, truncated } = capJsonValue(payload, budget)
  const json = JSON.stringify(capped) ?? 'null'
  return json.length > budget ? { json: `${json.slice(0, budget)}…`, truncated: true } : { json, truncated }
}

/** Placeholder emitted when the display budget is exhausted mid-structure. */
const CAP_MARKER = '[dsh-mcp-panel: result exceeded the display cap]'

/** Recursively cap one JSON value to a character budget, keeping it valid JSON. */
function capJsonValue(value: unknown, budget: number): { capped: unknown; truncated: boolean } {
  if (budget <= 0) return { capped: CAP_MARKER, truncated: true }
  if (typeof value === 'string') {
    if (value.length <= budget) return { capped: value, truncated: false }
    return { capped: `${value.slice(0, budget)}…`, truncated: true }
  }
  if (typeof value !== 'object' || value === null) return { capped: value, truncated: false }
  if (Array.isArray(value)) {
    const capped: unknown[] = []
    let truncated = false
    let spent = 0
    for (const entry of value) {
      const step = capJsonValue(entry, budget - spent)
      capped.push(step.capped)
      truncated ||= step.truncated
      spent = measure(capped)
      if (spent >= budget) break
    }
    return { capped, truncated }
  }
  const capped: Record<string, unknown> = {}
  let truncated = false
  let spent = 0
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const step = capJsonValue(entry, budget - spent)
    capped[key] = step.capped
    truncated ||= step.truncated
    spent = measure(capped)
    if (spent >= budget) break
  }
  return { capped, truncated }
}

/** Rough serialized length of a partially assembled value. */
function measure(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}
