# Changelog

All notable changes to this project are documented in this file.

## [0.3.0] - 2026-08-15

### Added

- Panel at a glance: a summary line above the cards (total servers, connected, with errors — counted from the same badge codes the rows show), a server search box that filters cards by name or target, and expand-all / collapse-all buttons (multi-card expansion replaces the single-open accordion).
- Release pipeline: `scripts/release.mjs` (version bump + changelog stamp + full gate + commit + annotated tag, with revert on failure), `scripts/check-tag-version.mjs` (tag/version tripwire for CI), `scripts/changelog-section.mjs` (prints one version's changelog section), and the tag-triggered `release` workflow — gate again → npm publish with provenance → GitHub Release with the packed tarball attached and notes from the changelog.
- Package metadata: `homepage`, `bugs`, and `author` fields.

### Changed

- The dependency line actually lands: typescript 7.0.2 (the TS7 build the tsconfigs were already prepared for), vitest 4.1.10, jsdom 30.0.1 — the full gate suite stays green. The 0.2.1 changelog had claimed these bumps prematurely; that claim is removed from the 0.2.1 entry.

### Engineering

- 109 tests (up from 105): summary counting, server-filter matching, and their agreement with badge derivation.

## [0.2.1] - 2026-08-14

### Fixed

- CI never passed: `pnpm/action-setup` had no pnpm version to install (no `packageManager` field and no `version` input). Added `packageManager: pnpm@11.7.0`, upgraded the actions (checkout@v7, setup-node@v7, pnpm/action-setup@v6), and pinned the pnpm version explicitly in `compat.yml` (its subdirectory checkout has no workspace-root `package.json` to auto-detect from).
- Probe targeting for rows nested under loader groups: `rawEndpoint` compared the group-composed `entry.id` (`include:…`) against the snapshot namespace derived from `entry.options.id`, so group-nested rows without an explicit `serverName` could never be probed.
- Upstream `mcp/status` payloads are validated before storage — a malformed payload (unknown phase, non-numeric counts) previously flowed into the snapshot verbatim and got the whole `mcpPanel/status` response rejected by the strict Typert codec on the client.
- Reconnect counting is idempotent per observed attempt: re-observing the same payload (HMR remount, event + query seed) no longer double counts; `connected`/`disposed` resets the counter so the next outage counts from attempt 1.
- `/mcp <server> disable|enable` on a leftover (unconfigured) `mcp__` namespace emitted a malformed `- set: { id: , … }` suggestion — it now refuses with a localized explanation, and listings mark those rows `unconfigured` instead of `disabled`.
- Job lifecycle states outside the panel vocabulary render as `unknown` (muted) instead of failing the wire codec or throwing at render.
- Repaired mojibake (corrupted em-dashes/arrows) in `docs/upstream-proposal.md`; its status header now points at the implemented fork branch and the Discussions handoff.

### Changed

- The tab polls on a short cadence while any probe is running, so probe rows and the disabled probe button settle even when `refreshIntervalMs` is `0`.
- The tab's error state now shows the underlying failure message instead of a generic notice.
- Badges no longer double-announce to screen readers (dropped `role="img"`/`aria-label`; the label is visible text).
- The `/mcp` command hint is served from the localized message dictionaries.

### Engineering

- tsdown config migrated off the deprecated `external`/`noExternal` options to `deps.neverBundle`/`deps.alwaysBundle`/`deps.onlyBundle`.
- Removed `baseUrl` from the tsconfigs (dropped in TypeScript 7; `paths` resolves relative to the config file), unblocking the typescript@7 line.
- `files` now ships `docs/`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, and all five READMEs (the published tarball was missing `docs/upstream-proposal.md`, which the READMEs link to).
- 105 tests (up from 96): observation validation and idempotent reconnect counting, nested-row probe targeting, leftover-namespace command behavior, and unknown job-state presentation.

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
