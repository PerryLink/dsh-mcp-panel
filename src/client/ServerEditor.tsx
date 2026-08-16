/** Server CRUD editor: form → patch fragment → copy or approval-gated write. */

import { useState, type ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { McpServerConfigView, PatchPreview, PatchWriteResult } from '../wire.ts'

/** One editable key/value row of env or headers. */
interface MapRow {
  /** Row identity for React keys. */
  readonly id: number
  key: string
  value: string
}

/** Editor callbacks supplied by the tab. */
export interface ServerEditorActions {
  previewPatch: (opJson: string) => Promise<PatchPreview>
  writePatch: (opJson: string, confirmed: boolean) => Promise<PatchWriteResult>
}

/** Editor props: an existing row's sanitized view, or null for add mode. */
export interface ServerEditorProps {
  t: PropsLocale<'settings.mcpPanel'>['t']
  /** Sanitized config view to edit; null = add mode. */
  view: McpServerConfigView | null
  /** Existing entry id (edit mode only). */
  entryId: string
  /** Whether profile writes are enabled (kill switch). */
  writeEnabled: boolean
  actions: ServerEditorActions
  onClose: () => void
  onWritten: () => void
}

let rowCounter = 0

/** Render the CRUD editor. */
export function ServerEditor({ t, view, entryId, writeEnabled, actions, onClose, onWritten }: ServerEditorProps): ReactNode {
  const isEdit = view !== null
  const [serverName, setServerName] = useState(view?.serverName ?? '')
  const [transport, setTransport] = useState<'stdio' | 'streamable-http'>(view?.transport === 'streamable-http' ? 'streamable-http' : 'stdio')
  const [command, setCommand] = useState(view?.command ?? '')
  const [args, setArgs] = useState((view?.args ?? []).join('\n'))
  const [cwd, setCwd] = useState(view?.cwd ?? '')
  const [url, setUrl] = useState(view?.url ?? '')
  const [timeout, setTimeoutText] = useState(view?.toolCallTimeoutMs === null ? '' : String(view?.toolCallTimeoutMs))
  const [failFast, setFailFast] = useState(view?.failOnStartupError === true)
  const [reconnectEnabled, setReconnectEnabled] = useState(view === null || view.reconnectEnabled === null ? true : view.reconnectEnabled)
  const [reconnectAttempts, setReconnectAttempts] = useState(view === null || view.reconnectMaxAttempts === null ? '' : String(view.reconnectMaxAttempts))
  const [envRows, setEnvRows] = useState<MapRow[]>(() => initialRows(view?.envKeys ?? []))
  const [headerRows, setHeaderRows] = useState<MapRow[]>(() => initialRows(view?.headerKeys ?? []))
  const [preview, setPreview] = useState<PatchPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [written, setWritten] = useState<PatchWriteResult | null>(null)

  const rowsToMap = (rows: MapRow[], existingKeys: readonly string[]): { entries: Record<string, string>; keep: string[] } => {
    const entries: Record<string, string> = {}
    const keep: string[] = []
    for (const row of rows) {
      const key = row.key.trim()
      if (key === '') continue
      if (existingKeys.includes(key) && row.value === '') keep.push(key)
      else entries[key] = row.value
    }
    return { entries, keep }
  }

  const buildOp = (): unknown => {
    const existingEnv = view?.envKeys ?? []
    const existingHeaders = view?.headerKeys ?? []
    const env = rowsToMap(envRows, existingEnv)
    const headers = rowsToMap(headerRows, existingHeaders)
    const config: Record<string, unknown> = {
      serverName: serverName.trim(),
      transport,
      ...transport === 'stdio'
        ? {
            command: command.trim(),
            ...args.trim() === '' ? {} : { args: args.split('\n').map(line => line.trim()).filter(line => line !== '') },
            ...cwd.trim() === '' ? {} : { cwd: cwd.trim() },
            env: env.entries,
            ...isEdit ? { keepEnv: env.keep } : {},
          }
        : {
            url: url.trim(),
            headers: headers.entries,
            ...isEdit ? { keepHeaders: headers.keep } : {},
          },
      ...timeout.trim() === '' ? {} : { toolCallTimeoutMs: Number(timeout) },
      ...failFast ? { failOnStartupError: true } : {},
      ...reconnectEnabled === false ? { reconnectEnabled: false } : {},
      ...reconnectAttempts.trim() === '' ? {} : { reconnectMaxAttempts: Number(reconnectAttempts) },
    }
    return isEdit ? { kind: 'edit', entryId, config } : { kind: 'add', config }
  }

  const doPreview = (): void => {
    setError(null)
    setNotice(null)
    setWritten(null)
    setArmed(false)
    setBusy(true)
    void Promise.resolve().then(() => actions.previewPatch(JSON.stringify(buildOp()))).then(
      (result) => { setPreview(result); setBusy(false) },
      (failure: unknown) => { setError(messageOf(failure)); setBusy(false) },
    )
  }

  const doWrite = (): void => {
    if (preview === null) return
    setError(null)
    setNotice(null)
    setBusy(true)
    void Promise.resolve().then(() => actions.writePatch(JSON.stringify(buildOp()), true)).then(
      (result) => {
        setWritten(result)
        setBusy(false)
        setArmed(false)
        setNotice(t('writeDone').replace('{file}', result.file).replace('{backup}', result.backupPath))
        onWritten()
      },
      (failure: unknown) => { setError(t('writeFailed').replace('{message}', messageOf(failure))); setBusy(false) },
    )
  }

  const copy = (): void => {
    if (preview === null) return
    navigator.clipboard?.writeText(preview.fragment).then(
      () => { setNotice(t('patchCopied')) },
      (failure: unknown) => { setError(t('copyFailed').replace('{message}', messageOf(failure))) },
    )
  }

  return (
    <div className="dmcp-editor" data-mcp-editor={isEdit ? entryId : 'new'}>
      <h4 className="dmcp-heading">{isEdit ? t('editorTitleEdit').replace('{name}', view?.serverName ?? '') : t('editorTitleAdd')}</h4>
      <div className="dmcp-form">
        <label className="dmcp-field">
          <span>{t('fieldServerName')}</span>
          <input type="text" value={serverName} onChange={(event) => { setServerName(event.currentTarget.value) }} />
        </label>
        <label className="dmcp-field">
          <span>{t('fieldTransport')}</span>
          <select value={transport} onChange={(event) => { setTransport(event.currentTarget.value === 'streamable-http' ? 'streamable-http' : 'stdio') }}>
            <option value="stdio">stdio</option>
            <option value="streamable-http">streamable-http</option>
          </select>
        </label>
        {transport === 'stdio' ? (
          <>
            <label className="dmcp-field">
              <span>{t('fieldCommand')}</span>
              <input type="text" value={command} onChange={(event) => { setCommand(event.currentTarget.value) }} />
            </label>
            <label className="dmcp-field">
              <span>{t('fieldArgs')}</span>
              <textarea rows={3} value={args} onChange={(event) => { setArgs(event.currentTarget.value) }} />
            </label>
            <label className="dmcp-field">
              <span>{t('fieldCwd')}</span>
              <input type="text" value={cwd} onChange={(event) => { setCwd(event.currentTarget.value) }} />
            </label>
            <MapEditor label={t('fieldEnv')} rows={envRows} setRows={setEnvRows} t={t} />
          </>
        ) : (
          <>
            <label className="dmcp-field">
              <span>{t('fieldUrl')}</span>
              <input type="text" value={url} onChange={(event) => { setUrl(event.currentTarget.value) }} />
            </label>
            <MapEditor label={t('fieldHeaders')} rows={headerRows} setRows={setHeaderRows} t={t} />
          </>
        )}
        <label className="dmcp-field">
          <span>{t('fieldTimeout')}</span>
          <input type="number" min={1} value={timeout} onChange={(event) => { setTimeoutText(event.currentTarget.value) }} />
        </label>
        <label className="dmcp-check">
          <input type="checkbox" checked={failFast} onChange={(event) => { setFailFast(event.currentTarget.checked) }} />
          <span>{t('fieldFailFast')}</span>
        </label>
        <label className="dmcp-check">
          <input type="checkbox" checked={reconnectEnabled} onChange={(event) => { setReconnectEnabled(event.currentTarget.checked) }} />
          <span>{t('fieldReconnectEnabled')}</span>
        </label>
        <label className="dmcp-field">
          <span>{t('fieldReconnectMaxAttempts')}</span>
          <input type="number" min={1} value={reconnectAttempts} onChange={(event) => { setReconnectAttempts(event.currentTarget.value) }} />
        </label>
      </div>
      <div className="dmcp-editor-actions">
        <button type="button" className="dmcp-action" onClick={doPreview} disabled={busy}>{t('previewPatch')}</button>
        <button type="button" className="dmcp-action" onClick={onClose} disabled={busy}>{t('cancel')}</button>
      </div>
      {error !== null ? <p className="dmcp-error-text" role="alert">{error}</p> : null}
      {notice !== null ? <p className="dmcp-notice">{notice}</p> : null}
      {preview !== null ? (
        <div className="dmcp-patch">
          <p className="dmcp-patch-hint">
            {preview.file === null ? t('patchFileUnknown') : t('patchFor').replace('{file}', preview.file)}
          </p>
          <pre className="dmcp-fragment">{preview.fragment}</pre>
          <div className="dmcp-editor-actions">
            <button type="button" className="dmcp-action" onClick={copy}>{t('copyPatch')}</button>
            {writeEnabled && preview.file !== null ? (
              armed ? (
                <button type="button" className="dmcp-action dmcp-confirm" onClick={doWrite} disabled={busy}>{t('confirmWrite')}</button>
              ) : (
                <button type="button" className="dmcp-action" onClick={() => { setArmed(true) }} disabled={busy}>{t('writeToProfile')}</button>
              )
            ) : null}
          </div>
          {armed ? <p className="dmcp-notice">{t('writeRequiresConfirm')}</p> : null}
          {!writeEnabled ? <p className="dmcp-error-text">{t('writeDisabled')}</p> : null}
          {written !== null ? (
            <p className="dmcp-notice">{t(prevWrittenLabel(written.approvalPath))}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Localized approval-channel label for one write result. */
function prevWrittenLabel(path: PatchWriteResult['approvalPath']): 'approvalHarness' | 'approvalInteractive' {
  return path === 'harness-approval' ? 'approvalHarness' : 'approvalInteractive'
}

/** Build the initial row list from existing keys (values left blank = keep). */
function initialRows(keys: readonly string[]): MapRow[] {
  return keys.map(key => ({ id: ++rowCounter, key, value: '' }))
}

/** Key/value row editor with add/remove; blank values on existing keys mean "keep". */
function MapEditor({ label, rows, setRows, t }: {
  label: string
  rows: MapRow[]
  setRows: (updater: (current: MapRow[]) => MapRow[]) => void
  t: PropsLocale<'settings.mcpPanel'>['t']
}): ReactNode {
  return (
    <fieldset className="dmcp-map">
      <legend>{label}</legend>
      {rows.length === 0 ? <p className="dmcp-status">{t('none')}</p> : null}
      {rows.map(row => (
        <div className="dmcp-map-row" key={row.id}>
          <input
            type="text"
            className="dmcp-map-key"
            aria-label={t('keyColumn')}
            placeholder={t('keyColumn')}
            value={row.key}
            onChange={(event) => {
              setRows(current => current.map(entry => entry.id === row.id ? { ...entry, key: event.currentTarget.value } : entry))
            }}
          />
          <input
            type="text"
            className="dmcp-map-value"
            aria-label={t('valueColumn')}
            placeholder={t('unchanged')}
            value={row.value}
            onChange={(event) => {
              setRows(current => current.map(entry => entry.id === row.id ? { ...entry, value: event.currentTarget.value } : entry))
            }}
          />
          <button
            type="button"
            className="dmcp-action"
            aria-label={t('removeRow')}
            onClick={() => { setRows(current => current.filter(entry => entry.id !== row.id)) }}
          >
            {t('removeRow')}
          </button>
        </div>
      ))}
      <button type="button" className="dmcp-action" onClick={() => { setRows(current => [...current, { id: ++rowCounter, key: '', value: '' }]) }}>
        {t('addRow')}
      </button>
    </fieldset>
  )
}

/** Message text of an arbitrary thrown value. */
function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}
