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

/** Configuration for the MCP management panel. */
export interface Config {
  /** Register the optional `mcp_probe` connectivity tool (default true). */
  probeEnabled?: boolean
  /** Per-probe timeout in milliseconds (default 10000). */
  probeTimeoutMs?: number
}

/** Fully resolved configuration captured at plugin load. */
export interface ResolvedConfig {
  /** Whether the `mcp_probe` tool is registered. */
  probeEnabled: boolean
  /** Per-probe timeout in milliseconds. */
  probeTimeoutMs: number
}

/** Schemastery schema for loader-validated configuration. */
export const Config: z<Config> = z.object({
  probeEnabled: z.boolean().default(true),
  probeTimeoutMs: z.number().min(1).max(MAX_PROBE_TIMEOUT_MS).default(DEFAULT_PROBE_TIMEOUT_MS),
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
  return Object.freeze({ probeEnabled, probeTimeoutMs })
}
