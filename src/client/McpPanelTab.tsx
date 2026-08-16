/** The MCP management console tab: server cards, CRUD editor, trial console, capabilities, probes. */

import { useEffect, useId, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { filterServers, presentMcpPanel, probeBadge, summarizePanel, type BadgeTone, type PresentedServerRow } from './present.ts'
import { ServerEditor } from './ServerEditor.tsx'
import { TrialConsole } from './TrialConsole.tsx'
import type {
  McpPanelSnapshot,
  McpProbeView,
  McpServerView,
  McpTrialResultWire,
  PatchPreview,
  PatchWriteResult,
  ProbeStarted,
} from '../wire.ts'

/** Registration-side injected face: the console RPCs (RemoteResult already unwrapped). */
export interface McpPanelTabInjected {
  /** Read the current Host snapshot. */
  status: () => Promise<McpPanelSnapshot>
  /** Start a one-shot probe of one streamable-http server (panel-only result). */
  probe: (serverName: string) => Promise<ProbeStarted>
  /** Render one CRUD operation as its patch fragment (no write). */
  previewPatch: (opJson: string) => Promise<PatchPreview>
  /** Approval-gated append of one CRUD operation to the profile patch layer. */
  writePatch: (opJson: string, confirmed: boolean) => Promise<PatchWriteResult>
  /** Trial-call one tool through the official pipeline. */
  callTool: (requestJson: string) => Promise<McpTrialResultWire>
}

/** Full component props assembled by the Settings slot renderer. */
export type McpPanelTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.mcpPanel'>
  & InjectFace<McpPanelTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
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
    default: return t('probeUnknown')
  }
}

/** Local wall-clock range for one probe row; component-layer formatting only. */
function formatProbeTime(view: McpProbeView): string {
  const format = (ms: number): string => new Date(ms).toLocaleTimeString(undefined, { hour12: false })
  const start = format(view.startedAt)
  return view.finishedAt === null ? start : `${start}–${format(view.finishedAt)}`
}

/** Localized text for one diagnostic code (fallback: the wire's English text). */
function diagnosticText(code: string, text: string, t: McpPanelTabProps['t']): string {
  const key = `diag_${code}` as const
  const candidate = (t as unknown as (key: string) => string)(key)
  return candidate === key ? text : candidate
}

/** Render the MCP management console tab. */
export function McpPanelTab({ status, probe, previewPatch, writePatch, callTool, t }: McpPanelTabProps): ReactNode {
  const listId = useId()
  const [request, setRequest] = useState(0)
  // Expanded card set: multiple cards may be open at once, so "expand all"
  // and "collapse all" can act on the whole (filtered) list.
  const [expanded, setExpanded] = useState<Record<string, true>>({})
  const [probeError, setProbeError] = useState<string | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  // Per-card tool filter: one query per server so expanding two cards at once
  // never filters one card by the other card's search text.
  const [toolQueries, setToolQueries] = useState<Record<string, string>>({})
  // Server search across names and display targets; filters the card list only.
  const [serverQuery, setServerQuery] = useState('')
  // CRUD editor state: null = closed; { view: null } = add mode.
  const [editor, setEditor] = useState<{ readonly entryId: string; readonly view: McpServerView['config'] } | { readonly entryId: ''; readonly view: null } | null>(null)
  // Armed removal (a disable-patch write) per server namespace.
  const [removeArm, setRemoveArm] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const reload = (): void => {
    setRequest(value => value + 1)
  }

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => status()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      (error: unknown) => {
        if (current) {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      },
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

  const model = state.status === 'ready' ? presentMcpPanel(state.snapshot) : undefined
  const visibleServers = model !== undefined ? filterServers(model.servers, serverQuery) : []
  const summary = model !== undefined ? summarizePanel(visibleServers) : null
  const summaryText = summary === null ? '' : t('summary')
    .replace('{total}', String(summary.total))
    .replace('{connected}', String(summary.connected))
    .replace('{errored}', String(summary.errored))
  const probeRunning = model !== undefined && model.probes.some(probeRow => probeRow.view.status === 'running')
  // While a probe runs, poll on a short fixed cadence so the probe row (and
  // the disabled probe button) settles even when refreshIntervalMs is 0.
  useEffect(() => {
    if (!probeRunning) return undefined
    const timer = setInterval(() => { if (!document.hidden) reload() }, 1500)
    return () => { clearInterval(timer) }
  }, [probeRunning])

  const retry = (): void => {
    setState({ status: 'loading' })
    reload()
  }

  return (
    <div className="dmcp-section" data-dsh-mcp-panel="" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className="dmcp-status">{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className="dmcp-failure">
          <p role="alert">{t('error')}</p>
          <p className="dmcp-failure-detail">{state.message}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {model !== undefined ? (
        <div className="dmcp-panel">
          {model.empty ? <p className="dmcp-status">{t('empty')}</p> : (
            <>
              <h3 className="dmcp-heading">{t('servers')}</h3>
              <p className="dmcp-summary">{summaryText}</p>
              <div className="dmcp-toolbar">
                <input
                  type="search"
                  className="dmcp-tool-filter dmcp-server-filter"
                  value={serverQuery}
                  placeholder={t('filterServers')}
                  aria-label={t('filterServers')}
                  onChange={(event) => { setServerQuery(event.currentTarget.value) }}
                />
                <button
                  type="button"
                  className="dmcp-action"
                  onClick={() => {
                    setExpanded(Object.fromEntries(visibleServers.map(row => [row.view.serverName, true] as const)))
                  }}
                >
                  {t('expandAll')}
                </button>
                <button type="button" className="dmcp-action" onClick={() => { setExpanded({}) }}>{t('collapseAll')}</button>
              </div>
              {visibleServers.length === 0 ? <p className="dmcp-status">{t('noMatch')}</p> : null}
              <ul className="dmcp-cards">
                {visibleServers.map((row) => {
                  const open = expanded[row.view.serverName] === true
                  const detailId = `${listId}-${encodeURIComponent(row.view.serverName)}`
                  const toolQuery = toolQueries[row.view.serverName] ?? ''
                  const rowProbeRunning = model.probes.some(
                    probeRow => probeRow.view.status === 'running' && probeRow.view.serverName === row.view.serverName,
                  )
                  return (
                    <li className="dmcp-card" key={row.view.serverName} data-mcp-server={row.view.serverName} data-open={open ? 'true' : undefined}>
                      <button
                        type="button"
                        className="dmcp-card-content"
                        aria-expanded={open}
                        aria-controls={detailId}
                        onClick={() => {
                          setExpanded((current) => {
                            const next = { ...current }
                            if (next[row.view.serverName] === true) delete next[row.view.serverName]
                            else next[row.view.serverName] = true
                            return next
                          })
                        }}
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
                            {row.view.exitCode !== null ? <div><dt>{t('exitCode')}</dt><dd>{row.view.exitCode}</dd></div> : null}
                            {row.view.stderrTail !== null ? <div><dt>{t('stderrTail')}</dt><dd>{row.view.stderrTail}</dd></div> : null}
                          </dl>
                          {row.view.diagnostics.length > 0 ? (
                            <div className="dmcp-health">
                              <p className="dmcp-health-title">{t('healthSuggestions')}</p>
                              <ul className="dmcp-health-list">
                                {row.view.diagnostics.map(diagnostic => (
                                  <li key={diagnostic.code}>{diagnosticText(diagnostic.code, diagnostic.text, t)} <code className="dmcp-diag-code">({diagnostic.code})</code></li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {row.view.exitCode === null && row.view.stderrTail === null ? (
                            <p className="dmcp-status">{t('healthPending')}</p>
                          ) : null}
                          <code className="dmcp-target" title={row.view.target}>{row.view.transport} {row.view.target}</code>
                          {row.view.config !== null ? (
                            <div className="dmcp-editor-actions">
                              <button type="button" className="dmcp-action" onClick={() => { setEditor({ entryId: row.view.entryId, view: row.view.config }) }}>
                                {t('editServer')}
                              </button>
                              <button
                                type="button"
                                className="dmcp-action dmcp-danger"
                                onClick={() => { setRemoveArm(row.view.serverName); setRemoveError(null) }}
                              >
                                {t('removeServer')}
                              </button>
                            </div>
                          ) : null}
                          {removeArm === row.view.serverName && row.view.entryId !== '' ? (
                            <div className="dmcp-remove">
                              <p className="dmcp-status">{t('removeConfirm')}</p>
                              {removeError !== null ? <p className="dmcp-error-text" role="alert">{removeError}</p> : null}
                              <div className="dmcp-editor-actions">
                                <button
                                  type="button"
                                  className="dmcp-action dmcp-danger"
                                  onClick={() => {
                                    setRemoveError(null)
                                    void Promise.resolve().then(() => writePatch(
                                      JSON.stringify({ kind: 'disable', entryId: row.view.entryId, serverName: row.view.serverName }),
                                      true,
                                    )).then(
                                      () => { setRemoveArm(null); reload() },
                                      (error: unknown) => { setRemoveError(error instanceof Error ? error.message : String(error)) },
                                    )
                                  }}
                                >
                                  {t('confirmWrite')}
                                </button>
                                <button type="button" className="dmcp-action" onClick={() => { setRemoveArm(null) }}>{t('cancel')}</button>
                              </div>
                            </div>
                          ) : null}
                          {row.view.transport === 'streamable-http' ? (
                            <button
                              type="button"
                              className="dmcp-probe-now"
                              disabled={rowProbeRunning}
                              onClick={() => {
                                setProbeError(null)
                                void Promise.resolve().then(() => probe(row.view.serverName)).then(
                                  () => { reload() },
                                  (error: unknown) => { setProbeError(error instanceof Error ? error.message : String(error)) },
                                )
                              }}
                            >
                              {rowProbeRunning ? t('probeRunning') : t('probeNow')}
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
          {model.patchFile !== null ? (
            <p className="dmcp-patch-hint">{t('patchHint')} <code>{model.patchFile}</code></p>
          ) : null}

          <div className="dmcp-toolbar">
            <button type="button" className="dmcp-action" onClick={() => { setEditor({ entryId: '', view: null }) }}>
              {t('addServer')}
            </button>
          </div>
          {editor !== null ? (
            <ServerEditor
              t={t}
              view={editor.view}
              entryId={editor.entryId}
              writeEnabled={model.writeEnabled}
              actions={{ previewPatch, writePatch }}
              onClose={() => { setEditor(null); reload() }}
              onWritten={() => { reload() }}
            />
          ) : null}

          <TrialConsole
            t={t}
            servers={model.servers.map(row => row.view)}
            policy={state.status === 'ready' ? state.snapshot.trial : { enabled: false, timeoutMs: 0, maxResultChars: 0 }}
            callTool={callTool}
          />

          <div className="dmcp-capabilities">
            <h3 className="dmcp-heading">{t('capabilities')}</h3>
            <ul className="dmcp-capabilities-list">
              <li>
                <Badge tone={model.capabilities.resources.available ? 'ok' : 'muted'} label={t('capResources')} />
                {!model.capabilities.resources.available ? <span className="dmcp-tool-description">{t('capPending')}</span> : null}
              </li>
              <li>
                <Badge tone={model.capabilities.prompts.available ? 'ok' : 'muted'} label={t('capPrompts')} />
                {!model.capabilities.prompts.available ? <span className="dmcp-tool-description">{t('capPending')}</span> : null}
              </li>
            </ul>
          </div>

          <h3 className="dmcp-heading">{t('probes')}</h3>
          {model.probes.length === 0 ? <p className="dmcp-status">{t('probeEmpty')}</p> : (
            <ul className="dmcp-probes">
              {model.probes.map((probeRow) => {
                const badge = probeBadge(probeRow.view.status)
                return (
                  <li key={probeRow.view.id} className="dmcp-probe" data-mcp-probe={probeRow.view.id}>
                    <Badge tone={badge.tone} label={probeLabel(badge.badge, t)} />
                    <code>{probeRow.view.serverName}</code>
                    <span className="dmcp-probe-time">{formatProbeTime(probeRow.view)}</span>
                    <span className="dmcp-probe-detail">{probeRow.view.detail ?? t('none')}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** One tone-colored badge chip. The label is visible text, so no `role="img"`
 * or `aria-label`: screen readers announce it exactly once. */
function Badge({ tone, label }: { readonly tone: BadgeTone; readonly label: string }): ReactNode {
  return (
    <span className="dmcp-badge" data-tone={tone} title={label}>
      <span className="dmcp-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
