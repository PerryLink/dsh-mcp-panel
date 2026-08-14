# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Panel probe action (`mcpPanel/probe`): one-click connectivity probe of one streamable-http server from the settings tab; results stay panel-only.
- Passive background probes (`passiveProbeEnabled` / `passiveProbeIntervalMs`) with per-server reachability badges kept separate from connection status.
- Suggested panel polling (`refreshIntervalMs`); the tab refreshes automatically on the suggested interval.
- `/mcp` output language (`outputLanguage: 'en' | 'zh'`); renderers parameterized on a message dictionary, patch lines stay machine-identical.
- Probe record cap (`maxProbes`) and upstream event freshness (`observedAt` → "last event Ns ago").
- Panel polish: focus-visible rings, attempt x/y budget row, bounded server-info display in probe details.

### Engineering

- `.gitattributes` pins LF line endings so Windows checkouts stop producing CRLF diff noise.
- Version-consistency tripwire: the probe's MCP `clientInfo.version` must equal the package version.

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
