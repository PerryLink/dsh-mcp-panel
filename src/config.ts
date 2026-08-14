/**
 * Plugin configuration and its explicit resolve step. `resolveConfig` re-judges
 * every default and bound so programmatic construction that bypasses
 * Schemastery normalization still fails loud instead of running with hidden
 * defaults (the explicit-resolve contract).
 *
 * @module dsh-mcp-panel/config
 */

import z from '@deepseek-ai/schemastery'

/** Default per-probe timeout in milliseconds. */
export const DEFAULT_PROBE_TIMEOUT_MS = 10_000

/** Ceiling for a single probe timeout: a probe is a one-shot HTTP call. */
export const MAX_PROBE_TIMEOUT_MS = 300_000

/** Default cap on probe records shown in the panel. */
export const DEFAULT_MAX_PROBES = 10

/** Ceiling on the suggested panel refresh interval (1 hour). */
export const MAX_REFRESH_INTERVAL_MS = 3_600_000

/** Configuration for the MCP management panel. */
export interface Config {
  /** Register the optional `mcp_probe` connectivity tool (default true). */
  probeEnabled?: boolean
  /** Per-probe timeout in milliseconds (default 10000). */
  probeTimeoutMs?: number
  /** Cap on probe records shown in the panel (default 10). */
  maxProbes?: number
  /** Suggested panel refresh interval in ms; 0 = on demand only (default 0). */
  refreshIntervalMs?: number
  /** Output language of the `/mcp` command (default en). */
  outputLanguage?: 'en' | 'zh'
  /** Periodically probe streamable-http servers in the background (default false). */
  passiveProbeEnabled?: boolean
  /** Passive probe interval in milliseconds (default 60000). */
  passiveProbeIntervalMs?: number
}

/** Fully resolved configuration captured at plugin load. */
export interface ResolvedConfig {
  /** Whether the `mcp_probe` tool is registered. */
  probeEnabled: boolean
  /** Per-probe timeout in milliseconds. */
  probeTimeoutMs: number
  /** Cap on probe records shown in the panel. */
  maxProbes: number
  /** Suggested panel refresh interval in ms (0 = on demand). */
  refreshIntervalMs: number
  /** Output language of the `/mcp` command. */
  outputLanguage: 'en' | 'zh'
  /** Whether the passive probe loop runs. */
  passiveProbeEnabled: boolean
  /** Passive probe interval in milliseconds. */
  passiveProbeIntervalMs: number
}

/** Schemastery schema for loader-validated configuration. */
export const Config: z<Config> = z.object({
  probeEnabled: z.boolean().default(true),
  probeTimeoutMs: z.number().min(1).max(MAX_PROBE_TIMEOUT_MS).default(DEFAULT_PROBE_TIMEOUT_MS),
  maxProbes: z.number().min(1).max(100).default(DEFAULT_MAX_PROBES),
  refreshIntervalMs: z.number().min(0).max(MAX_REFRESH_INTERVAL_MS).default(0),
  outputLanguage: z.union(['en', 'zh'] as const).default('en'),
  passiveProbeEnabled: z.boolean().default(false),
  passiveProbeIntervalMs: z.number().min(1_000).max(MAX_REFRESH_INTERVAL_MS).default(60_000),
})

/**
 * Resolve raw config to the runtime policy, re-validating defaults and bounds.
 *
 * @param config - raw loader config; `undefined` for a bare row.
 * @returns the frozen resolved config.
 */
export function resolveConfig(config: Config | undefined): ResolvedConfig {
  const probeEnabled = config?.probeEnabled ?? true
  if (typeof probeEnabled !== 'boolean') {
    throw new TypeError('dsh-mcp-panel: config.probeEnabled must be a boolean')
  }
  const probeTimeoutMs = config?.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS
  if (!Number.isFinite(probeTimeoutMs) || probeTimeoutMs < 1 || probeTimeoutMs > MAX_PROBE_TIMEOUT_MS) {
    throw new Error(`dsh-mcp-panel: config.probeTimeoutMs must be a finite number between 1 and ${MAX_PROBE_TIMEOUT_MS}`)
  }
  const maxProbes = config?.maxProbes ?? DEFAULT_MAX_PROBES
  if (!Number.isInteger(maxProbes) || maxProbes < 1 || maxProbes > 100) {
    throw new Error('dsh-mcp-panel: config.maxProbes must be an integer between 1 and 100')
  }
  const refreshIntervalMs = config?.refreshIntervalMs ?? 0
  if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs < 0 || refreshIntervalMs > MAX_REFRESH_INTERVAL_MS) {
    throw new Error(`dsh-mcp-panel: config.refreshIntervalMs must be a finite number between 0 and ${MAX_REFRESH_INTERVAL_MS}`)
  }
  const outputLanguage = config?.outputLanguage ?? 'en'
  if (outputLanguage !== 'en' && outputLanguage !== 'zh') {
    throw new Error(`dsh-mcp-panel: config.outputLanguage must be "en" or "zh", got ${JSON.stringify(outputLanguage)}`)
  }
  const passiveProbeEnabled = config?.passiveProbeEnabled ?? false
  if (typeof passiveProbeEnabled !== 'boolean') {
    throw new TypeError('dsh-mcp-panel: config.passiveProbeEnabled must be a boolean')
  }
  const passiveProbeIntervalMs = config?.passiveProbeIntervalMs ?? 60_000
  if (!Number.isFinite(passiveProbeIntervalMs) || passiveProbeIntervalMs < 1_000 || passiveProbeIntervalMs > MAX_REFRESH_INTERVAL_MS) {
    throw new Error(`dsh-mcp-panel: config.passiveProbeIntervalMs must be a finite number between 1000 and ${MAX_REFRESH_INTERVAL_MS}`)
  }
  return Object.freeze({ probeEnabled, probeTimeoutMs, maxProbes, refreshIntervalMs, outputLanguage, passiveProbeEnabled, passiveProbeIntervalMs })
}
