/**
 * Scoped stylesheet for the MCP tab. Standalone client bundles cannot use the
 * in-repo CSS-module pipeline, so the sheet ships as a string and is
 * installed effect-scoped into a `<style data-dsh-mcp-panel>` element.
 * Every selector is scoped under `[data-dsh-mcp-panel]` and uses theme
 * design tokens only, so it follows both color schemes.
 *
 * @module dsh-mcp-panel/client/styles
 */

/** One `<style>` installation; returns the exact disposer that removes it. */
export function installPanelStyles(): () => void {
  const existing = document.querySelector('style[data-dsh-mcp-panel]')
  if (existing !== null) return () => {}
  const element = document.createElement('style')
  element.dataset.dshMcpPanel = ''
  element.textContent = PANEL_CSS
  document.head.append(element)
  return () => { element.remove() }
}

/** The panel stylesheet, scoped and token-driven. */
const PANEL_CSS = `
[data-dsh-mcp-panel] .dmcp-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
[data-dsh-mcp-panel] .dmcp-status {
  color: var(--dsw-alias-label-secondary);
  margin: 0;
}
[data-dsh-mcp-panel] .dmcp-failure {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
[data-dsh-mcp-panel] .dmcp-failure button {
  font: inherit;
  cursor: pointer;
}
[data-dsh-mcp-panel] .dmcp-failure-detail {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}
[data-dsh-mcp-panel] .dmcp-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
[data-dsh-mcp-panel] .dmcp-heading {
  margin: 4px 0 0;
  font-size: 1em;
  color: var(--dsw-alias-label-primary);
}
[data-dsh-mcp-panel] .dmcp-summary {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-mcp-panel] .dmcp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
[data-dsh-mcp-panel] .dmcp-server-filter {
  flex: 1 1 180px;
  min-width: 0;
}
[data-dsh-mcp-panel] .dmcp-action {
  font: inherit;
  cursor: pointer;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 4px;
  padding: 4px 10px;
}
[data-dsh-mcp-panel] .dmcp-action:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
[data-dsh-mcp-panel] .dmcp-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
[data-dsh-mcp-panel] .dmcp-card {
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
[data-dsh-mcp-panel] .dmcp-card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  font: inherit;
  text-align: left;
  background: none;
  border: 0;
  color: var(--dsw-alias-label-primary);
  padding: 10px 12px;
  cursor: pointer;
}
[data-dsh-mcp-panel] .dmcp-card-content:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
[data-dsh-mcp-panel] .dmcp-tool-filter {
  font: inherit;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 4px;
  padding: 4px 8px;
}
[data-dsh-mcp-panel] .dmcp-probe-now {
  align-self: flex-start;
  font: inherit;
  cursor: pointer;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 4px;
  padding: 4px 10px;
}
[data-dsh-mcp-panel] .dmcp-probe-now:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
[data-dsh-mcp-panel] .dmcp-probe-now:disabled {
  opacity: 0.6;
  cursor: default;
}
[data-dsh-mcp-panel] .dmcp-card-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-dsh-mcp-panel] .dmcp-card-trailing {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
[data-dsh-mcp-panel] .dmcp-tool-count {
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
[data-dsh-mcp-panel] .dmcp-card-details {
  border-top: 1px solid var(--dsw-alias-border-l2);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
[data-dsh-mcp-panel] .dmcp-details {
  margin: 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
}
[data-dsh-mcp-panel] .dmcp-details dt {
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-mcp-panel] .dmcp-details dd {
  margin: 0;
  overflow-wrap: anywhere;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
}
[data-dsh-mcp-panel] .dmcp-error-text {
  color: var(--dsw-alias-state-error-primary);
}
[data-dsh-mcp-panel] .dmcp-target {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-mcp-panel] .dmcp-tools {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-dsh-mcp-panel] .dmcp-tools li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
[data-dsh-mcp-panel] .dmcp-tool-description {
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}
[data-dsh-mcp-panel] .dmcp-derived-note,
[data-dsh-mcp-panel] .dmcp-patch-hint {
  color: var(--dsw-alias-label-secondary);
  margin: 0;
  overflow-wrap: anywhere;
}
[data-dsh-mcp-panel] .dmcp-probes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-dsh-mcp-panel] .dmcp-probe {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
[data-dsh-mcp-panel] .dmcp-probe-time {
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}
[data-dsh-mcp-panel] .dmcp-probe-detail {
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
  flex: 1 1 100%;
}
[data-dsh-mcp-panel] .dmcp-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.85em;
  white-space: nowrap;
  border: 1px solid currentColor;
}
[data-dsh-mcp-panel] .dmcp-badge[data-tone='ok'] {
  color: var(--dsw-alias-state-success-primary);
}
[data-dsh-mcp-panel] .dmcp-badge[data-tone='warn'] {
  color: var(--dsw-alias-state-warn-primary);
}
[data-dsh-mcp-panel] .dmcp-badge[data-tone='error'] {
  color: var(--dsw-alias-state-error-primary);
}
[data-dsh-mcp-panel] .dmcp-badge[data-tone='muted'] {
  color: var(--dsw-alias-label-tertiary);
}
[data-dsh-mcp-panel] .dmcp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
[data-dsh-mcp-panel] .dmcp-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1);
  padding: 12px;
}
[data-dsh-mcp-panel] .dmcp-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
[data-dsh-mcp-panel] .dmcp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9em;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-mcp-panel] .dmcp-field input,
[data-dsh-mcp-panel] .dmcp-field select,
[data-dsh-mcp-panel] .dmcp-field textarea {
  font: inherit;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 4px;
  padding: 4px 8px;
}
[data-dsh-mcp-panel] .dmcp-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-mcp-panel] .dmcp-map {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}
[data-dsh-mcp-panel] .dmcp-map legend {
  font-size: 0.9em;
  color: var(--dsw-alias-label-secondary);
  padding: 0 4px;
}
[data-dsh-mcp-panel] .dmcp-map-row {
  display: flex;
  gap: 6px;
}
[data-dsh-mcp-panel] .dmcp-map-row input {
  font: inherit;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 4px;
  padding: 4px 8px;
  min-width: 0;
}
[data-dsh-mcp-panel] .dmcp-map-key {
  flex: 1 1 40%;
}
[data-dsh-mcp-panel] .dmcp-map-value {
  flex: 2 1 60%;
}
[data-dsh-mcp-panel] .dmcp-editor-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
[data-dsh-mcp-panel] .dmcp-action:disabled {
  opacity: 0.6;
  cursor: default;
}
[data-dsh-mcp-panel] .dmcp-danger {
  color: var(--dsw-alias-state-error-primary);
  border-color: currentColor;
}
[data-dsh-mcp-panel] .dmcp-confirm {
  color: var(--dsw-alias-state-warn-primary);
  border-color: currentColor;
}
[data-dsh-mcp-panel] .dmcp-patch {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
[data-dsh-mcp-panel] .dmcp-fragment {
  margin: 0;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  overflow: auto;
  max-height: 240px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--dsw-alias-font-mono, monospace);
  font-size: 0.85em;
}
[data-dsh-mcp-panel] .dmcp-notice {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}
[data-dsh-mcp-panel] .dmcp-warn-text {
  color: var(--dsw-alias-state-warn-primary);
}
[data-dsh-mcp-panel] .dmcp-health {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
[data-dsh-mcp-panel] .dmcp-health-title {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-mcp-panel] .dmcp-health-list {
  list-style: disc;
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--dsw-alias-label-primary);
}
[data-dsh-mcp-panel] .dmcp-diag-code {
  color: var(--dsw-alias-label-tertiary);
}
[data-dsh-mcp-panel] .dmcp-remove {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--dsw-alias-state-error-primary);
  border-radius: 4px;
  padding: 8px;
}
[data-dsh-mcp-panel] .dmcp-trial {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  padding-top: 12px;
}
[data-dsh-mcp-panel] .dmcp-trial-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: flex-end;
}
[data-dsh-mcp-panel] .dmcp-trial-row .dmcp-field {
  flex: 1 1 180px;
  min-width: 0;
}
[data-dsh-mcp-panel] .dmcp-trial-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-dsh-mcp-panel] .dmcp-trial-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0;
  color: var(--dsw-alias-label-secondary);
}
[data-dsh-mcp-panel] .dmcp-trial-call {
  color: var(--dsw-alias-label-tertiary);
  font-family: var(--dsw-alias-font-mono, monospace);
  font-size: 0.85em;
}
[data-dsh-mcp-panel] .dmcp-trial-json {
  max-height: 320px;
}
[data-dsh-mcp-panel] .dmcp-capabilities {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-dsh-mcp-panel] .dmcp-capabilities-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-dsh-mcp-panel] .dmcp-capabilities-list li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
`
