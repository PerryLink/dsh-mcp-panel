# Changelog

All notable changes to this project are documented in this file.

## [0.6.0] - 2026-08-26

### Added

- Recommended MCP server catalog plus configuration JSON import/export.

## [0.5.1] - 2026-08-22

### Changed

- All `@deepseek-ai/dsh-*` dependencies moved from the `0.1.0-rc.8` line to `0.1.1-rc.2`: the 15 devDependencies pin `0.1.1-rc.2` exactly, `@deepseek-ai/dsh-subprocess` (the one runtime dependency) pins `0.1.1-rc.2`, and the four peerDependencies (`dsh-commands` / `dsh-jobs` / `dsh-tools` / `dsh-typert-protocol`) keep their `>=0.1.0-rc.8 <0.2.0` range (no rc.2-exclusive API is used). `@deepseek-ai/cordis` and the non-dsh dependency lines are unchanged; the compatibility tables now claim `0.1.1-rc.2`–`0.2.0`, and the compat workflow pins the harness CLI and base/headless bundles to `0.1.1-rc.2`.
- The `/mcp` and `mcp_probe` surfaces are unchanged: rc.2 keeps the `commands.execute(agent, line, images, signal)` signature and the single-`CommandInvocation` handler shape this package already drives, so no call-site edits were needed.

### Engineering

- `pnpm-lock.yaml` regenerated against the rc.2 graph; `minimumReleaseAgeExclude` collapses the stale per-package rc.6 list to a single `@deepseek-ai/*` wildcard so fresh harness releases install without a release-age delay.

## [0.5.0] - 2026-08-21

### Added

- `mcp_probe`, the panel probe action, `/mcp <server> probe`, and the passive probe now support **stdio** MCP servers: a probe on a stdio row spawns the configured `command`/`args` under the same `scrubbedParentEnv` base the mcp-client bridge uses (credential-shaped and `DSH_*` names never leak into the child implicitly) plus the row's explicit `env`/`cwd`, completes one MCP `initialize` handshake over stdin/stdout, and records the sanitized server name/version or a sanitized failure detail — still panel-only, with the same unowned-job semantics (cancel, per-probe timeout, display cap). `ProbeTarget` is now a `kind`-discriminated union (`http` | `stdio`) resolved by `McpPanelService.probeSpec`; streamable-http rows are probed exactly as before.

## [0.4.2] - 2026-08-21

### Changed

- All `@deepseek-ai/dsh-*` dependencies moved from the `0.1.0-rc.6` line to rc.8: the 15 devDependencies pin `0.1.0-rc.8` exactly, and the four peerDependencies (`dsh-commands` / `dsh-jobs` / `dsh-tools` / `dsh-typert-protocol`) now range `>=0.1.0-rc.8 <0.2.0`. `@deepseek-ai/cordis` and the non-dsh dependency lines are unchanged; the compatibility tables now claim `0.1.0-rc.8`–`0.2.0`.
- The `/mcp` and `mcp_probe` surfaces are unchanged. The rc.8 `commands.execute(agent, line, images, signal)` signature carries a new image-attachment parameter; the internal call sites that drive plain invocations (test harness, loader runner, headless verifier) now pass an empty image list.

### Engineering

- `pnpm-lock.yaml` regenerated against the rc.8 graph so the client type faces (`dsh-typert-protocol`, `dsh-api-remotes`) resolve as one version, keeping the `mcpPanel` Remote namespace merge visible to `typecheck:ci`.

## [0.4.1] - 2026-08-19

### Fixed

- The trial console's callId counter now lives on a per-service-instance trial caller (`createTrialCaller`) instead of a module-level `let`, matching its documented per-instance semantics — a plugin reload no longer carries counter state across mounts. (`runTrialCall` is now exported through the caller factory.)

## [0.4.0] - 2026-08-16

### Added

- **MCP management console** (the official `@deepseek-ai/dsh-mcp-client` stays the only bridge; this plugin is now its full experience layer):
  - **Server CRUD in the Settings tab**: add/edit/remove servers through a visual form (stdio and streamable-http shapes); every edit renders as an APPEND-ONLY `cordis.patch.yml` operation (`insert` / `set` / `set disabled: true` — the patch vocabulary has no remove, so removal disables the row and keeps it re-enableable). One-click copy, or approval-gated write: the host asks `ctx.approval` when an agent with an open turn exists, otherwise the explicit interactive confirmation is the approval channel; every write first copies the file to a timestamped backup and prunes to the newest `backupCount`.
  - **Tool trial console**: pick a server → registered `mcp__*` tools → JSON arguments → call through the OFFICIAL `ctx.tools.execute()` pipeline (pre-execute permission policy, approval asks, guards, and post-execute all stay in force). Results show the canonical JSON value plus the rendered content, capped by `trialMaxResultChars`; panel-only, never model context. `/mcp <server> call <tool> [json]` exposes the same pipeline to the model with approval routed through the command's agent.
  - **Health diagnostics**: `/mcp <server> health` and per-card suggestion lists derived from sanitized error text (ENOENT → dependency missing, ECONNREFUSED, ETIMEDOUT, 401/403/404, DNS, rate limit, reconnect exhaustion, failed fiber). Child exit codes / stderr tails are honestly labeled "pending upstream support" until the official client exposes them (proposed in the harness `docs/upstream-proposal.md`).
  - **Capabilities board**: Resources/Prompts availability is feature-detected against a proposed upstream catalog seam; today the console clearly labels both "pending upstream support" (the official client bridges tools only).
- Config: `trialEnabled` / `trialTimeoutMs` / `trialMaxResultChars` / `writeEnabled` (kill switch) / `backupCount`, all with Schemastery schema, fail-loud bounds, and explicit `resolveConfig` re-validation.
- The panel injects NO prompt sections; the only model-facing text it adds remains the two tool/command descriptions.

### Changed

- The snapshot now carries sanitized per-server config views (env/header VALUES never leave the host — keys only, with keep-semantics re-merge for edits), derived diagnostics, and the trial/write policy; the upstream seam consumption now also carries the proposed `exitCode`/`stderrTail` fields when present.
- `/mcp` usage now documents `call` and `health`; the command output stays model-readable and log-reconstructable.
- Sanitization rules unchanged and extended over the new surfaces: fragment previews never contain `!!js` expressions and never echo secret values.

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
