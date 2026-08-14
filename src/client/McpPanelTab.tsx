/** The read-only MCP management tab: server rows, badges, tools, probes. */

import { useEffect, useId, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { presentMcpPanel, probeBadge, type BadgeTone, type PresentedServerRow } from './present.ts'
import type { McpPanelSnapshot } from '../wire.ts'

/** Registration-side injected face: the unwrapped snapshot read. */
export interface McpPanelTabInjected {
  /** Read the current Host snapshot (RemoteResult already unwrapped). */
  status: () => Promise<McpPanelSnapshot>
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

/** Render the read-only MCP management tab. */
export function McpPanelTab({ status, t }: McpPanelTabProps): ReactNode {
  const listId = useId()
  const [request, setRequest] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => status()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [status, request])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
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
                            <div><dt>{t('reconnects')}</dt><dd>{row.reconnects ?? t('none')}</dd></div>
                            <div><dt>{t('lastError')}</dt><dd className={row.hasError ? 'dmcp-error-text' : undefined}>{row.view.lastError ?? t('none')}</dd></div>
                            <div><dt>{t('fiber')}</dt><dd>{row.view.fiberPhase ?? t('none')}</dd></div>
                            {row.view.delayMs !== null ? <div><dt>{t('retryIn')}</dt><dd>{row.view.delayMs} {t('ms')}</dd></div> : null}
                          </dl>
                          <code className="dmcp-target" title={row.view.target}>{row.view.transport} {row.view.target}</code>
                          {row.view.tools.length === 0 ? (
                            <p className="dmcp-status">{t('noTools')}</p>
                          ) : (
                            <ul className="dmcp-tools">
                              {row.view.tools.map(tool => (
                                <li key={tool.name}>
                                  <code>{tool.name}</code>
                                  {tool.description !== '' ? <span className="dmcp-tool-description">{tool.description}</span> : null}
                                </li>
                              ))}
                            </ul>
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
          <h3 className="dmcp-heading">{t('probes')}</h3>
          {model.probes.length === 0 ? <p className="dmcp-status">{t('probeEmpty')}</p> : (
            <ul className="dmcp-probes">
              {model.probes.map((probe) => {
                const badge = probeBadge(probe.view.status)
                return (
                  <li key={probe.view.id} className="dmcp-probe" data-mcp-probe={probe.view.id}>
                    <Badge tone={badge.tone} label={probeLabel(badge.badge, t)} />
                    <code>{probe.view.serverName}</code>
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
