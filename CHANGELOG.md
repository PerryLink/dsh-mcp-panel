# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - 2026-08-14

### Added

- Panel probe action (`mcpPanel/probe`): one-click connectivity probe of one streamable-http server from the settings tab; results stay panel-only.
- Passive background probes (`passiveProbeEnabled` / `passiveProbeIntervalMs`) with per-server reachability badges kept separate from connection status.
- Suggested panel polling (`refreshIntervalMs`); the tab refreshes automatically on the suggested interval.
- `/mcp` output language (`outputLanguage: 'en' | 'zh' | 'es' | 'pt' | 'hi'`); renderers parameterized on a message dictionary, patch lines stay machine-identical.
- Probe record cap (`maxProbes`) and upstream event freshness (`observedAt` → "last event Ns ago").
- `/mcp <server> probe` command action: start a panel-only probe from the command surface.
- Panel detail row for config-declared policy facts (`configuredNote`: reconnect budget, fail-fast, tool timeout).
- Probe rows show local start/end wall-clock times; the probe button disables while a probe for that server is running.
- Panel polish: focus-visible rings, attempt x/y budget row, bounded server-info display in probe details.

### Changed

- Tool filter input is now per-card: one query per expanded server, no cross-card leakage.
- Polling pauses while the document is hidden and refreshes on visibility regain.
- URL fragment credentials (`#token=…`) are redacted like query credentials, in URLs and free text.
- Leftover (unconfigured) `mcp__` namespaces badge as "unknown" instead of "disabled".
- The settings tab keeps following the app UI language (en/zh — the harness locale face supports those two codes today); the `/mcp` command language is the separate five-language `outputLanguage` config.

### Engineering

- `.gitattributes` pins LF line endings so Windows checkouts stop producing CRLF diff noise.
- Version-consistency tripwire: the probe's MCP `clientInfo.version` must equal the package version.
- CI restores typecheck: `typecheck:ci` resolves the npm-published `0.1.0-rc.6` type faces (new client-* devDeps, no checkout paths); CI matrix runs Node 22 + 24 on Ubuntu + Windows.
- Monthly harness-compat job (`.github/workflows/compat.yml`): packs the plugin, installs it into a fresh web profile of a pinned deepseek-harness SHA, and boots it end to end.
- `scripts/verify-headless.mjs` now replicates the launcher's `prepareProfile` steps (flat module fallback heal, empty root-config write) and locates the installation anchor by walking up (plus `DSH_INSTALL_ANCHOR` override) — it works for plugin repos checked out at any depth under the harness.
- Upstream `mcp/status` seam: implemented in a deepseek-harness branch (`feat/mcp-client-status-observability-seam`) with tests, docs, and an Agent Note; the panel consumes it unchanged — verified end to end with a real `server-everything` row reporting `status: connected (source: upstream-event)`.

## [0.1.0] - 2026-08-14

Initial release.

### Added

- Read-only MCP management panel for the official `@deepseek-ai/dsh-mcp-client`:
  - `/mcp` command (list, per-server detail, `tools`, controlled `disable`/`enable` patch suggestions), model-readable and session-log reconstructable.
  - Settings → Plugins → **MCP** tab (panel-only snapshot over the `mcpPanel` Typert Remote namespace): transport/target, status badges, tool inventory, sanitized errors, reconnect counts, probe results.
  - `mcp_probe` one-shot Streamable HTTP connectivity probe (background job, panel-only results).
  - Display sanitization (URL query credentials, userinfo passwords, header values, bearer tokens, JWTs, env-var credentials).
  - Consumption of the proposed upstream `mcp/status` seam (typed event + query service, feature-detected; honest `unknown`/`derived` fallback).
- Hand-written `./typert` host manifest + client Remote contribution sharing one canonical descriptor.
- 58 unit tests; headless verification script; Apache-2.0; five-language READMEs.

### Verified

- Against a source checkout of deepseek-harness (workspace packages `0.1.0-rc.5`, mainline `7b9644f`): headless `/mcp` end-to-end (13 real tools enumerated), live web profile (gateway RPC, client bundle, boot manifest).
