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

/** Languages the `/mcp` command renders in (mirrors the five-language READMEs). */
export type OutputLanguage = 'en' | 'zh' | 'es' | 'pt' | 'hi'

/**
 * Whether the tool trial console is enabled. The trial path runs MCP tools
 * through the official `ctx.tools.execute` pipeline, so permission policy,
 * guards, and approval stay in force exactly as for model calls.
 */
export const DEFAULT_TRIAL_ENABLED = true

/** Default panel-side deadline for one trial tool call (ms). */
export const DEFAULT_TRIAL_TIMEOUT_MS = 120_000

/** Ceiling for one trial call: the tool may block on a remote server. */
export const MAX_TRIAL_TIMEOUT_MS = 600_000

/** Default cap on the trial result payload (chars of the JSON projection). */
export const DEFAULT_TRIAL_MAX_RESULT_CHARS = 60_000

/** Ceiling on the trial result payload. */
export const MAX_TRIAL_RESULT_CHARS = 500_000

/** Whether profile-patch writes are allowed at all (kill switch; default true). */
export const DEFAULT_WRITE_ENABLED = true

/** Default number of `cordis.patch.yml` backups retained per write. */
export const DEFAULT_BACKUP_COUNT = 5

/** Ceiling on retained backups. */
export const MAX_BACKUP_COUNT = 50

/** Configuration for the MCP management console. */
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
  outputLanguage?: OutputLanguage
  /** Periodically probe streamable-http servers in the background (default false). */
  passiveProbeEnabled?: boolean
  /** Passive probe interval in milliseconds (default 60000). */
  passiveProbeIntervalMs?: number
  /** Enable the tool trial console (settings tab + /mcp call). Default true. */
  trialEnabled?: boolean
  /** Panel-side deadline for one trial tool call in ms (default 120000). */
  trialTimeoutMs?: number
  /** Cap on the trial result payload in chars (default 60000). */
  trialMaxResultChars?: number
  /** Whether profile-patch writes are allowed at all (kill switch). Default true. */
  writeEnabled?: boolean
  /** Number of `cordis.patch.yml` backups retained per write (default 5). */
  backupCount?: number
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
  outputLanguage: OutputLanguage
  /** Whether the passive probe loop runs. */
  passiveProbeEnabled: boolean
  /** Passive probe interval in milliseconds. */
  passiveProbeIntervalMs: number
  /** Whether the tool trial console is enabled. */
  trialEnabled: boolean
  /** Panel-side deadline for one trial tool call. */
  trialTimeoutMs: number
  /** Cap on the trial result payload in chars. */
  trialMaxResultChars: number
  /** Whether profile-patch writes are allowed at all. */
  writeEnabled: boolean
  /** Number of patch backups retained per write. */
  backupCount: number
}

/** Schemastery schema for loader-validated configuration. */
export const Config: z<Config> = z.object({
  probeEnabled: z.boolean().default(true),
  probeTimeoutMs: z.number().min(1).max(MAX_PROBE_TIMEOUT_MS).default(DEFAULT_PROBE_TIMEOUT_MS),
  maxProbes: z.number().min(1).max(100).default(DEFAULT_MAX_PROBES),
  refreshIntervalMs: z.number().min(0).max(MAX_REFRESH_INTERVAL_MS).default(0),
  outputLanguage: z.union(['en', 'zh', 'es', 'pt', 'hi'] as const).default('en'),
  passiveProbeEnabled: z.boolean().default(false),
  passiveProbeIntervalMs: z.number().min(1_000).max(MAX_REFRESH_INTERVAL_MS).default(60_000),
  trialEnabled: z.boolean().default(DEFAULT_TRIAL_ENABLED),
  trialTimeoutMs: z.number().min(1).max(MAX_TRIAL_TIMEOUT_MS).default(DEFAULT_TRIAL_TIMEOUT_MS),
  trialMaxResultChars: z.number().min(1_000).max(MAX_TRIAL_RESULT_CHARS).default(DEFAULT_TRIAL_MAX_RESULT_CHARS),
  writeEnabled: z.boolean().default(DEFAULT_WRITE_ENABLED),
  backupCount: z.number().min(1).max(MAX_BACKUP_COUNT).default(DEFAULT_BACKUP_COUNT),
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
  if (outputLanguage !== 'en' && outputLanguage !== 'zh' && outputLanguage !== 'es' && outputLanguage !== 'pt' && outputLanguage !== 'hi') {
    throw new Error(`dsh-mcp-panel: config.outputLanguage must be one of "en", "zh", "es", "pt", "hi", got ${JSON.stringify(outputLanguage)}`)
  }
  const passiveProbeEnabled = config?.passiveProbeEnabled ?? false
  if (typeof passiveProbeEnabled !== 'boolean') {
    throw new TypeError('dsh-mcp-panel: config.passiveProbeEnabled must be a boolean')
  }
  const passiveProbeIntervalMs = config?.passiveProbeIntervalMs ?? 60_000
  if (!Number.isFinite(passiveProbeIntervalMs) || passiveProbeIntervalMs < 1_000 || passiveProbeIntervalMs > MAX_REFRESH_INTERVAL_MS) {
    throw new Error(`dsh-mcp-panel: config.passiveProbeIntervalMs must be a finite number between 1000 and ${MAX_REFRESH_INTERVAL_MS}`)
  }
  const trialEnabled = config?.trialEnabled ?? DEFAULT_TRIAL_ENABLED
  if (typeof trialEnabled !== 'boolean') {
    throw new TypeError('dsh-mcp-panel: config.trialEnabled must be a boolean')
  }
  const trialTimeoutMs = config?.trialTimeoutMs ?? DEFAULT_TRIAL_TIMEOUT_MS
  if (!Number.isFinite(trialTimeoutMs) || trialTimeoutMs < 1 || trialTimeoutMs > MAX_TRIAL_TIMEOUT_MS) {
    throw new Error(`dsh-mcp-panel: config.trialTimeoutMs must be a finite number between 1 and ${MAX_TRIAL_TIMEOUT_MS}`)
  }
  const trialMaxResultChars = config?.trialMaxResultChars ?? DEFAULT_TRIAL_MAX_RESULT_CHARS
  if (!Number.isInteger(trialMaxResultChars) || trialMaxResultChars < 1_000 || trialMaxResultChars > MAX_TRIAL_RESULT_CHARS) {
    throw new Error(`dsh-mcp-panel: config.trialMaxResultChars must be an integer between 1000 and ${MAX_TRIAL_RESULT_CHARS}`)
  }
  const writeEnabled = config?.writeEnabled ?? DEFAULT_WRITE_ENABLED
  if (typeof writeEnabled !== 'boolean') {
    throw new TypeError('dsh-mcp-panel: config.writeEnabled must be a boolean')
  }
  const backupCount = config?.backupCount ?? DEFAULT_BACKUP_COUNT
  if (!Number.isInteger(backupCount) || backupCount < 1 || backupCount > MAX_BACKUP_COUNT) {
    throw new Error(`dsh-mcp-panel: config.backupCount must be an integer between 1 and ${MAX_BACKUP_COUNT}`)
  }
  return Object.freeze({
    probeEnabled,
    probeTimeoutMs,
    maxProbes,
    refreshIntervalMs,
    outputLanguage,
    passiveProbeEnabled,
    passiveProbeIntervalMs,
    trialEnabled,
    trialTimeoutMs,
    trialMaxResultChars,
    writeEnabled,
    backupCount,
  })
}
