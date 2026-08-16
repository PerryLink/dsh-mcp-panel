/** Tool trial console: server → registered mcp__* tool → JSON args → official pipeline. */

import { useEffect, useState, type ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { McpServerView, McpTrialResultWire } from '../wire.ts'

/** Trial console props supplied by the tab. */
export interface TrialConsoleProps {
  t: PropsLocale<'settings.mcpPanel'>['t']
  /** Snapshot server rows (tool lists ride along). */
  servers: readonly McpServerView[]
  /** Panel-side trial policy from the snapshot. */
  policy: { enabled: boolean; timeoutMs: number; maxResultChars: number }
  callTool: (requestJson: string) => Promise<McpTrialResultWire>
}

/** Render the trial console. */
export function TrialConsole({ t, servers, policy, callTool }: TrialConsoleProps): ReactNode {
  const configured = servers.filter(server => server.entryId !== '')
  const [serverName, setServerName] = useState('')
  const [toolName, setToolName] = useState('')
  const [argsText, setArgsText] = useState('{}')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<McpTrialResultWire | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the selection pointing at a real server/tool when the snapshot changes.
  const server = configured.find(candidate => candidate.serverName === serverName) ?? configured[0]
  useEffect(() => {
    if (configured.length > 0 && serverName === '') setServerName(configured[0]?.serverName ?? '')
  }, [configured, serverName])
  const tools = server?.tools ?? []
  useEffect(() => {
    if (tools.length > 0 && !tools.some(tool => tool.name === toolName)) setToolName(tools[0]?.name ?? '')
    if (tools.length === 0 && toolName !== '') setToolName('')
  }, [tools, toolName])

  const run = (): void => {
    const selectedServer = server
    if (selectedServer === undefined || toolName === '') return
    let parsed: unknown
    try {
      parsed = JSON.parse(argsText.trim() === '' ? '{}' : argsText)
    } catch {
      setError(t('trialArgsInvalid'))
      return
    }
    void parsed
    setError(null)
    setResult(null)
    setRunning(true)
    void Promise.resolve().then(() => callTool(JSON.stringify({
      serverName: selectedServer.serverName,
      toolName,
      argsJson: argsText.trim() === '' ? '{}' : argsText,
    }))).then(
      (outcome) => { setResult(outcome); setRunning(false) },
      (failure: unknown) => { setError(failure instanceof Error ? failure.message : String(failure)); setRunning(false) },
    )
  }

  if (!policy.enabled) {
    return (
      <div className="dmcp-trial">
        <h3 className="dmcp-heading">{t('trial')}</h3>
        <p className="dmcp-status">{t('trialDisabled')}</p>
      </div>
    )
  }

  const pretty = result === null ? null : prettyJson(result.resultJson)

  return (
    <div className="dmcp-trial">
      <h3 className="dmcp-heading">{t('trial')}</h3>
      <p className="dmcp-status">{t('trialHint')}</p>
      {configured.length === 0 ? <p className="dmcp-status">{t('empty')}</p> : (
        <>
          <div className="dmcp-trial-row">
            <label className="dmcp-field">
              <span>{t('trialServer')}</span>
              <select
                value={server?.serverName ?? ''}
                onChange={(event) => { setServerName(event.currentTarget.value); setToolName('') }}
              >
                {configured.map(candidate => <option key={candidate.serverName} value={candidate.serverName}>{candidate.serverName}</option>)}
              </select>
            </label>
            <label className="dmcp-field">
              <span>{t('trialTool')}</span>
              <select value={toolName} onChange={(event) => { setToolName(event.currentTarget.value) }}>
                {tools.length === 0 ? <option value="">{t('trialNoTools')}</option> : null}
                {tools.map(tool => <option key={tool.name} value={tool.name}>{tool.name}</option>)}
              </select>
            </label>
            <button type="button" className="dmcp-action" onClick={run} disabled={running || toolName === ''}>
              {running ? t('trialRunning') : t('trialRun')}
            </button>
          </div>
          <label className="dmcp-field">
            <span>{t('trialArgs')}</span>
            <textarea
              rows={4}
              spellCheck={false}
              value={argsText}
              onChange={(event) => { setArgsText(event.currentTarget.value) }}
            />
          </label>
        </>
      )}
      {error !== null ? <p className="dmcp-error-text" role="alert">{error}</p> : null}
      {result !== null ? (
        <div className="dmcp-trial-result">
          <p className="dmcp-trial-meta">
            <BadgeTone ok={!result.isError} label={result.isError ? 'error' : 'ok'} />
            <span>{t('trialDuration').replace('{ms}', String(result.durationMs))}</span>
            {result.truncated ? <span className="dmcp-warn-text">{t('trialTruncated')}</span> : null}
            <span className="dmcp-trial-call">{result.callId}</span>
          </p>
          <pre className="dmcp-fragment dmcp-trial-json">{pretty}</pre>
        </div>
      ) : null}
      <p className="dmcp-status">{t('trialApprovalNote')}</p>
    </div>
  )
}

/** One tone-colored badge chip (label is visible text). */
function BadgeTone({ ok, label }: { readonly ok: boolean; readonly label: string }): ReactNode {
  return (
    <span className="dmcp-badge" data-tone={ok ? 'ok' : 'error'}>
      <span className="dmcp-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

/** Pretty-print one result JSON; unparseable (truncated) text renders raw. */
function prettyJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}
