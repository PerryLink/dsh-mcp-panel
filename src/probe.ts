/**
 * The optional `mcp_probe` tool: a one-shot connectivity probe of one
 * configured Streamable HTTP endpoint, executed as an UNOWNED background job.
 * Probe results are panel-only — the tool returns just the job id and a
 * pointer to the settings tab, the job carries no owner (so no completion
 * notice is injected into the model), and the panel reads the sanitized
 * snapshot back through `mcpPanel/status`.
 *
 * @module dsh-mcp-panel/probe
 */

import type { JobHooks, JobOutcome, JobRegistry } from '@deepseek-ai/dsh-jobs'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { sanitizeError, sanitizeText } from './sanitize.ts'
import type { McpPanelService } from './service.ts'

/** Producer kind; also the job-id prefix. */
export const PROBE_KIND = 'mcp-probe'

declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    /** One-shot Streamable HTTP connectivity probe (panel-only results). */
    'mcp-probe': 'mcp-probe'
  }
}

/** JSON-RPC MCP initialize request used by the probe (protocol constant). */
const INITIALIZE_PROTOCOL_VERSION = '2024-11-05'

/** MCP clientInfo facts; protocol constants, not configuration. Exported so the
 * version-consistency tripwire (`tests/version.spec.ts`) can assert the
 * advertised version tracks the package version. */
export const PROBE_CLIENT_INFO = { name: 'dsh-mcp-panel', version: '0.2.1' }

/** One settled probe: outcome status plus a sanitized one-line detail. */
export interface ProbeOutcome {
  /** How the job ended. */
  status: 'completed' | 'failed'
  /** Sanitized one-line detail (HTTP status, latency, server info, or error). */
  detail: string
}

/** Display cap for server-reported name/version fields in probe details. */
const DISPLAY_LIMIT = 80

/** Bound one display string so hostile server metadata cannot blow up layouts. */
function boundedDisplay(value: string): string {
  return value.length <= DISPLAY_LIMIT ? value : `${value.slice(0, DISPLAY_LIMIT - 1)}…`
}

/**
 * POST one MCP `initialize` request and describe the outcome in one sanitized
 * line. Never sends or echoes credentials: the configured headers are used
 * for the request itself (exactly as the bridge would) and never rendered.
 *
 * @param url - endpoint URL (already parsed by the caller).
 * @param headers - the configured request headers; used, never displayed.
 * @param timeoutMs - probe deadline.
 * @param signal - caller-owned abort (job kill or timeout).
 * @returns the settled probe outcome.
 */
export async function probeEndpoint(
  url: string,
  headers: Readonly<Record<string, string>>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<ProbeOutcome> {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: INITIALIZE_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: PROBE_CLIENT_INFO,
        },
      }),
      signal,
    })
    const ms = Date.now() - started
    if (!response.ok) {
      return { status: 'failed', detail: `HTTP ${response.status} ${response.statusText} (${ms}ms)` }
    }
    let serverInfo: { name?: unknown; version?: unknown } = {}
    try {
      const body = (await response.json()) as { result?: { serverInfo?: { name?: unknown; version?: unknown } } }
      serverInfo = body?.result?.serverInfo ?? {}
    } catch {
      // A 2xx without a JSON body: connectivity itself succeeded.
    }
    const name = typeof serverInfo.name === 'string' && serverInfo.name !== ''
      ? boundedDisplay(sanitizeText(serverInfo.name))
      : 'unnamed'
    const version = typeof serverInfo.version === 'string' && serverInfo.version !== ''
      ? boundedDisplay(sanitizeText(serverInfo.version))
      : 'unknown version'
    return { status: 'completed', detail: `HTTP ${response.status}, MCP initialize ok (server ${name} ${version}) in ${ms}ms` }
  } catch (error) {
    if (signal.aborted) return { status: 'failed', detail: `timeout after ${timeoutMs}ms or cancelled` }
    return { status: 'failed', detail: sanitizeError(error) }
  }
}

/**
 * Create the background-job hooks for one probe: cancel aborts the fetch, the
 * outcome settles `done` with sanitized detail only.
 *
 * @param url - endpoint URL.
 * @param headers - configured headers (used, never rendered).
 * @param timeoutMs - probe deadline.
 * @returns the registry hooks.
 */
export function probeJob(url: string, headers: Readonly<Record<string, string>>, timeoutMs: number): JobHooks {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, timeoutMs)
  timer.unref?.()
  const done: Promise<JobOutcome> = probeEndpoint(url, headers, timeoutMs, controller.signal)
    .then(outcome => ({ ...outcome }))
    .finally(() => { clearTimeout(timer) })
  return {
    cancel: () => { controller.abort() },
    done,
  }
}

/** Resolve one configured server's raw endpoint for probing. */
function probeTarget(
  service: McpPanelService,
  server: string,
): { url: string; headers: Record<string, string> } | undefined {
  return service.rawEndpoint(server)
}

/**
 * Build the `mcp_probe` tool definition.
 *
 * @param service - panel service (server lookup + snapshot for panel display).
 * @param jobs - background-job registry the probe runs on.
 * @param timeoutMs - per-probe deadline.
 * @returns the registration-ready definition.
 */
export function mcpProbeTool(service: McpPanelService, jobs: JobRegistry, timeoutMs: number): ToolDefinition {
  return defineTool({
    name: 'mcp_probe',
    description: 'Run a one-shot connectivity probe of a configured streamable-http MCP server as a background job. '
      + 'Results appear in the MCP settings panel only — they are not injected into model context.',
    parameters: {
      server: {
        type: 'string',
        required: true,
        description: 'serverName of a configured streamable-http MCP server (see /mcp for the list).',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          jobId: { type: 'string', required: true },
          note: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Probe started (background job ${value.jobId}). Read the result in the MCP panel: Settings → Plugins → MCP.`,
      }],
    },
    async execute(args) {
      const target = probeTarget(service, args.server)
      if (target === undefined) {
        throw new Error(
          `mcp_probe: "${args.server}" is not a configured streamable-http MCP server (see /mcp). `
          + 'stdio servers have no HTTP endpoint to probe.',
        )
      }
      const jobId = jobs.start({
        kind: PROBE_KIND,
        label: `mcp_probe ${args.server}`,
        // Unowned: no model completion notice, readable by the panel only.
        run: () => probeJob(target.url, target.headers, timeoutMs),
      })
      return {
        jobId,
        note: 'Probe results are panel-only: Settings → Plugins → MCP.',
      }
    },
  })
}
