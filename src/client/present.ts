/**
 * Pure presentation for the MCP settings tab: maps the wire snapshot onto
 * render-ready rows and badge codes. No I/O, no clock, no random — a session
 * replay or a test may call it any number of times and get the same result.
 * Localization happens in the component through the locale dictionaries;
 * this module emits stable codes only.
 *
 * @module dsh-mcp-panel/client/present
 */

import type { McpPanelSnapshot, McpServerView, McpProbeView } from '../wire.ts'

/** Badge tones the stylesheet understands. */
export type BadgeTone = 'ok' | 'warn' | 'error' | 'muted'

/** Render-ready server row plus derived badge facts. */
export interface PresentedServerRow {
  /** The wire server view, unchanged. */
  readonly view: McpServerView
  /** Badge tone for the connection state. */
  readonly tone: BadgeTone
  /** Badge code: `disabled` | `failed` | a connection phase | `unknown`. */
  readonly badge: 'disabled' | 'failed' | 'connecting' | 'connected' | 'waiting' | 'exhausted' | 'disposed' | 'unknown'
  /** Whether the row shows an error badge (sanitized `lastError` present). */
  readonly hasError: boolean
  /** Display form of the reconnect count (`-1` → null = dash). */
  readonly reconnects: number | null
  /** Whole seconds since the last upstream event; `null` = never observed. */
  readonly ageSeconds: number | null
  /** Whether the attempt/maxAttempts pair is displayable (either is known). */
  readonly hasAttemptBudget: boolean
}

/** Render-ready probe row. */
export interface PresentedProbeRow {
  /** The wire probe view, unchanged. */
  readonly view: McpProbeView
  /** Badge tone for the probe state. */
  readonly tone: BadgeTone
  /** Badge code for the probe state. */
  readonly badge: 'running' | 'completed' | 'failed' | 'killed' | 'stopping'
}

/** The complete render-ready tab model. */
export interface PresentedMcpPanel {
  /** Servers in snapshot order. */
  readonly servers: readonly PresentedServerRow[]
  /** Probes in snapshot order (newest first). */
  readonly probes: readonly PresentedProbeRow[]
  /** Whether the snapshot carries any server rows. */
  readonly empty: boolean
  /** Whether connection fields came from upstream or are derived. */
  readonly observed: boolean
  /** Absolute profile patch-layer path for the hint line, or null. */
  readonly patchFile: string | null
  /** Suggested refresh interval in ms (`0` = on demand only). */
  readonly refreshIntervalMs: number
}

/**
 * Derive the connection badge for one server row. Order matters: the entry
 * being disabled or its fiber failed is a configuration fact that beats the
 * (derived or upstream) connection phase.
 *
 * @param view - the assembled server view.
 * @returns the badge code and tone.
 */
export function connectionBadge(view: McpServerView): { badge: PresentedServerRow['badge']; tone: BadgeTone } {
  // A leftover namespace (foreign mcp__ tools, no loader row) is unconfigured,
  // not disabled: its config facts do not exist, so it reads "unknown".
  if (view.entryId === '') return { badge: 'unknown', tone: 'muted' }
  if (!view.enabled) return { badge: 'disabled', tone: 'muted' }
  if (view.fiberPhase === 'failed') return { badge: 'failed', tone: 'error' }
  switch (view.phase) {
    case 'connected': return { badge: 'connected', tone: 'ok' }
    case 'connecting':
    case 'waiting': return { badge: view.phase, tone: 'warn' }
    case 'exhausted': return { badge: 'exhausted', tone: 'error' }
    case 'disposed': return { badge: 'disposed', tone: 'muted' }
    default: return { badge: 'unknown', tone: 'muted' }
  }
}

/** Badge for one probe state. */
export function probeBadge(status: McpProbeView['status']): { badge: PresentedProbeRow['badge']; tone: BadgeTone } {
  switch (status) {
    case 'completed': return { badge: 'completed', tone: 'ok' }
    case 'running': return { badge: 'running', tone: 'warn' }
    case 'stopping': return { badge: 'stopping', tone: 'warn' }
    case 'failed': return { badge: 'failed', tone: 'error' }
    case 'killed': return { badge: 'killed', tone: 'muted' }
  }
}

/**
 * Project the wire snapshot onto render-ready rows.
 *
 * @param snapshot - the `mcpPanel/status` value.
 * @param now - epoch ms anchor for age computations (keeps the fold pure).
 * @returns the tab model.
 */
export function presentMcpPanel(snapshot: McpPanelSnapshot, now = Date.now()): PresentedMcpPanel {
  const servers = snapshot.servers.map((view): PresentedServerRow => {
    const { badge, tone } = connectionBadge(view)
    return {
      view,
      badge,
      tone,
      hasError: view.lastError !== null && view.lastError !== '',
      reconnects: view.reconnectCount < 0 ? null : view.reconnectCount,
      ageSeconds: view.observedAt === null ? null : Math.max(0, Math.floor((now - view.observedAt) / 1000)),
      hasAttemptBudget: view.attempt >= 0 || view.maxAttempts > 0,
    }
  })
  const probes = snapshot.probes.map((view): PresentedProbeRow => {
    const { badge, tone } = probeBadge(view.status)
    return { view, badge, tone }
  })
  return {
    servers,
    probes,
    empty: snapshot.servers.length === 0,
    observed: snapshot.observed,
    patchFile: snapshot.patchFile,
    refreshIntervalMs: snapshot.refreshIntervalMs,
  }
}
