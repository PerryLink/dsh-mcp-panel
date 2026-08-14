/** The read-only MCP management tab: server rows, badges, tools, probes. */

import { useEffect, useId, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { presentMcpPanel, probeBadge, type BadgeTone, type PresentedServerRow } from './present.ts'
import type { McpPanelSnapshot, McpProbeView, ProbeStarted } from '../wire.ts'

/** Registration-side injected face: the unwrapped snapshot read + probe start. */
export interface McpPanelTabInjected {
  /** Read the current Host snapshot (RemoteResult already unwrapped). */
  status: () => Promise<McpPanelSnapshot>
  /** Start a one-shot probe of one streamable-http server (panel-only result). */
  probe: (serverName: string) => Promise<ProbeStarted>
}

/** Full component props assembled by the Settings slot renderer. */
export type McpPanelTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.mcpPanel'>
  & InjectFace<McpPanelTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: McpPanelSnapshot }

/** Localized label for one server badge code. */
function badgeLabel(badge: PresentedServerRow['badge'], t: McpPanelTabProps['t']): string {
  switch (badge) {
    case 'disabled': return t('statusDisabled')
    case 'failed': return t('statusFailed')
    case 'connecting': return t('statusConnecting')
    case 'connected': return t('statusConnected')
    case 'waiting': return t('statusWaiting')
    case 'exhausted': return t('statusExhausted')
    case 'disposed': return t('statusDisposed')
    default: return t('statusUnknown')
  }
}

/** Localized label for one probe badge code. */
function probeLabel(badge: ReturnType<typeof probeBadge>['badge'], t: McpPanelTabProps['t']): string {
  switch (badge) {
    case 'running': return t('probeRunning')
    case 'completed': return t('probeCompleted')
    case 'failed': return t('probeFailed')
    case 'killed': return t('probeKilled')
    case 'stopping': return t('probeStopping')
  }
}

/** Local wall-clock range for one probe row; component-layer formatting only. */
function formatProbeTime(view: McpProbeView): string {
  const format = (ms: number): string => new Date(ms).toLocaleTimeString(undefined, { hour12: false })
  const start = format(view.startedAt)
  return view.finishedAt === null ? start : `${start}–${format(view.finishedAt)}`
}

/** Render the read-only MCP management tab. */
export function McpPanelTab({ status, probe, t }: McpPanelTabProps): ReactNode {
  const listId = useId()
  const [request, setRequest] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  // Per-card tool filter: one query per server so expanding two cards at once
  // never filters one card by the other card's search text.
  const [toolQueries, setToolQueries] = useState<Record<string, string>>({})

  const reload = (): void => {
    setRequest(value => value + 1)
  }

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => status()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [status, request])

  // Optional polling: the host suggests an interval through the snapshot
  // (0 = on demand only). Errors during polling keep the last good snapshot.
  // Polling pauses while the document is hidden and refreshes immediately on
  // becoming visible again, so background tabs neither spin nor show stale data.
  const intervalMs = state.status === 'ready' ? state.snapshot.refreshIntervalMs : 0
  useEffect(() => {
    if (intervalMs <= 0) return undefined
    const tick = (): void => { if (!document.hidden) reload() }
    const timer = setInterval(tick, intervalMs)
    const onVisible = (): void => { if (!document.hidden) reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])

  const retry = (): void => {
    setState({ status: 'loading' })
    reload()
  }

  const model = state.status === 'ready' ? presentMcpPanel(state.snapshot) : undefined

  return (
    <div className="dmcp-section" data-dsh-mcp-panel="" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className="dmcp-status">{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className="dmcp-failure">
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {model !== undefined ? (
        <div className="dmcp-panel">
          {model.empty ? <p className="dmcp-status">{t('empty')}</p> : (
            <>
              <h3 className="dmcp-heading">{t('servers')}</h3>
              <ul className="dmcp-cards">
                {model.servers.map((row) => {
                  const open = expanded === row.view.serverName
                  const detailId = `${listId}-${encodeURIComponent(row.view.serverName)}`
                  const toolQuery = toolQueries[row.view.serverName] ?? ''
                  const probeRunning = model.probes.some(
                    probe => probe.view.status === 'running' && probe.view.serverName === row.view.serverName,
                  )
                  return (
                    <li className="dmcp-card" key={row.view.serverName} data-mcp-server={row.view.serverName} data-open={open ? 'true' : undefined}>
                      <button
                        type="button"
                        className="dmcp-card-content"
                        aria-expanded={open}
                        aria-controls={detailId}
                        onClick={() => { setExpanded(current => current === row.view.serverName ? null : row.view.serverName) }}
                      >
                        <strong className="dmcp-card-title">{row.view.serverName}</strong>
                        <span className="dmcp-card-trailing">
                          {row.view.probeState !== null ? (
                            <Badge
                              tone={row.view.probeState === 'reachable' ? 'ok' : 'error'}
                              label={row.view.probeState === 'reachable' ? t('probeReachable') : t('probeUnreachable')}
                            />
                          ) : null}
                          <Badge tone={row.tone} label={badgeLabel(row.badge, t)} />
                          <span className="dmcp-tool-count">
                            {row.view.toolCount} {t('tools')}
                          </span>
                        </span>
                      </button>
                      {open ? (
                        <div className="dmcp-card-details" id={detailId}>
                          <dl className="dmcp-details">
                            <div><dt>{t('status')}</dt><dd>{badgeLabel(row.badge, t)}</dd></div>
                            {row.hasAttemptBudget ? (
                              <div>
                                <dt>{t('attempt')}</dt>
                                <dd>{row.view.attempt < 0 ? t('none') : row.view.attempt}/{row.view.maxAttempts < 0 ? t('none') : row.view.maxAttempts}</dd>
                              </div>
                            ) : null}
                            <div><dt>{t('reconnects')}</dt><dd>{row.reconnects ?? t('none')}</dd></div>
                            <div><dt>{t('lastError')}</dt><dd className={row.hasError ? 'dmcp-error-text' : undefined}>{row.view.lastError ?? t('none')}</dd></div>
                            <div><dt>{t('fiber')}</dt><dd>{row.view.fiberPhase ?? t('none')}</dd></div>
                            {row.view.configuredNote !== null ? <div><dt>{t('configured')}</dt><dd>{row.view.configuredNote}</dd></div> : null}
                            {row.ageSeconds !== null ? <div><dt>{t('lastEvent')}</dt><dd>{row.ageSeconds}s</dd></div> : null}
                            {row.view.delayMs !== null ? <div><dt>{t('retryIn')}</dt><dd>{row.view.delayMs} {t('ms')}</dd></div> : null}
                          </dl>
                          <code className="dmcp-target" title={row.view.target}>{row.view.transport} {row.view.target}</code>
                          {row.view.transport === 'streamable-http' ? (
                            <button
                              type="button"
                              className="dmcp-probe-now"
                              disabled={probeRunning}
                              onClick={() => {
                                setProbeError(null)
                                void Promise.resolve().then(() => probe(row.view.serverName)).then(
                                  () => { reload() },
                                  (error: unknown) => { setProbeError(error instanceof Error ? error.message : String(error)) },
                                )
                              }}
                            >
                              {probeRunning ? t('probeRunning') : t('probeNow')}
                            </button>
                          ) : null}
                          {row.view.tools.length === 0 ? (
                            <p className="dmcp-status">{t('noTools')}</p>
                          ) : (
                            <>
                              <input
                                type="search"
                                className="dmcp-tool-filter"
                                value={toolQuery}
                                placeholder={t('filterTools')}
                                aria-label={t('filterTools')}
                                onChange={(event) => {
                                  setToolQueries(current => ({ ...current, [row.view.serverName]: event.currentTarget.value }))
                                }}
                              />
                              <ul className="dmcp-tools">
                                {row.view.tools
                                  .filter(tool => toolQuery.trim() === ''
                                    || tool.name.toLocaleLowerCase().includes(toolQuery.trim().toLocaleLowerCase())
                                    || tool.description.toLocaleLowerCase().includes(toolQuery.trim().toLocaleLowerCase()))
                                  .map(tool => (
                                    <li key={tool.name}>
                                      <code>{tool.name}</code>
                                      {tool.description !== '' ? <span className="dmcp-tool-description">{tool.description}</span> : null}
                                    </li>
                                  ))}
                              </ul>
                            </>
                          )}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {!model.observed && !model.empty ? <p className="dmcp-derived-note">{t('derivedNote')}</p> : null}
          {probeError !== null ? <p className="dmcp-error-text" role="alert">{t('probeFailedAction')}: {probeError}</p> : null}
          <h3 className="dmcp-heading">{t('probes')}</h3>
          {model.probes.length === 0 ? <p className="dmcp-status">{t('probeEmpty')}</p> : (
            <ul className="dmcp-probes">
              {model.probes.map((probe) => {
                const badge = probeBadge(probe.view.status)
                return (
                  <li key={probe.view.id} className="dmcp-probe" data-mcp-probe={probe.view.id}>
                    <Badge tone={badge.tone} label={probeLabel(badge.badge, t)} />
                    <code>{probe.view.serverName}</code>
                    <span className="dmcp-probe-time">{formatProbeTime(probe.view)}</span>
                    <span className="dmcp-probe-detail">{probe.view.detail ?? t('none')}</span>
                  </li>
                )
              })}
            </ul>
          )}
          {model.patchFile !== null ? (
            <p className="dmcp-patch-hint">{t('patchHint')} <code>{model.patchFile}</code></p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** One tone-colored badge chip. */
function Badge({ tone, label }: { readonly tone: BadgeTone; readonly label: string }): ReactNode {
  return (
    <span className="dmcp-badge" data-tone={tone} role="img" aria-label={label} title={label}>
      <span className="dmcp-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
