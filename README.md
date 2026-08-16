# dsh-mcp-panel

**The MCP management console for the official DeepSeek Harness MCP client — add, edit, remove, and trial-call MCP servers from a settings page, with honest status, health diagnostics, and safe, reversible profile writes.**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![CI](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

## Architecture: official client = bridge, this plugin = console

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) is the **only bridge**: one plugin instance per MCP server, configured as a hand-written `cordis.yml` row, connecting the transport, syncing tools, and registering `mcp__<server>__<tool>` names. This plugin never replaces it — it is the **experience layer on top**:

```
                    ┌────────────────────────────────────────────┐
 profile            │  cordis.yml / cordis.patch.yml             │
 composition        │   - id: mcp-github                          │
 (one row per       │     name: '@deepseek-ai/dsh-mcp-client'     │
  server, hand-     │     config: { serverName, transport, … }    │
  written)          │   - id: mcp-panel                           │
                    │     name: dsh-mcp-panel   ◄── this plugin   │
                    └───────────────┬────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                        │
   ┌────▼──────────────┐        ┌───────────────────────────┐    │
   │ @deepseek-ai/dsh- │        │ dsh-mcp-panel (console)   │    │
   │ mcp-client        │        │                           │    │
   │ • transport       │        │ • /mcp command            │    │
   │ • tool sync       │        │ • Settings → Plugins →    │    │
   │ • mcp__* tools    │◄──────►│   MCP tab: CRUD, trial    │    │
   │ • mcp/status seam │ status │ • health diagnostics      │    │
   └───────────────────┘        │ • probes, capabilities    │    │
                                └───────────────────────────┘    │
```

The console **reads** the client through its shipped `mcp/status` observability seam (event + `mcpStatus` query service), the tool registry, and the loader; it **writes** only the profile's patch layer — append-only, approval-gated, always backed up. Transport, OAuth, and protocol stay untouched.

## Console vs. hand-written cordis.yml

| | Hand-written cordis.yml | dsh-mcp-panel console |
|---|---|---|
| Add a server | Edit YAML, mind indent/quoting | Form → patch fragment → **copy** or **write** (approval + auto backup) |
| Edit a server | Edit YAML, restart/hot-reload | Form pre-filled from the live row; unchanged secrets keep their raw values host-side |
| Remove a server | Delete the row | `set disabled: true` operation (the patch vocabulary has no remove) — re-enableable anytime |
| See status | Read logs | Badges + reconnects + last error, live from the `mcp/status` seam |
| Try a tool | Ask the model to call it | Trial console → official `ctx.tools.execute()` pipeline (permission & approval stay in force) |
| Diagnose failures | Grep logs | `/mcp <server> health` with derived self-heal suggestions |
| Mistakes | Manual revert | Every write is append-only and leaves a timestamped backup |

The console's output IS `cordis.patch.yml` vocabulary — the same lines you would write by hand, generated, previewed, and applied safely.

## What you get

| Surface | What it does |
|---|---|
| **`/mcp` command** | one row per server: transport, target, tool count, connection status (from the upstream seam; `unknown` when unobserved), last error, reconnect count — model-readable, session-log reconstructable, five output languages |
| **`/mcp <server> tools`** | model-visible `mcp__*` tool names + descriptions |
| **`/mcp <server> health`** | derived self-heal suggestions (ENOENT → missing dependency, ECONNREFUSED, timeouts, 401/403/404, DNS, rate limit, reconnect exhaustion…); exit code / stderr tail honestly labeled *pending upstream support* until the client exposes them |
| **`/mcp <server> call <tool> [json]`** | trial-call through the **official tool pipeline** — pre-execute permission policy, approval (routed through the command's agent), guards, post-execute all apply |
| **`/mcp <server> disable\|enable`** | the exact `set` patch line, as before |
| **Settings → Plugins → MCP tab** | status cards with badges, diagnostics, probes, plus the three consoles below |
| **Server CRUD** | add/edit/remove forms → `insert`/`set`/`set disabled` fragments → clipboard copy or approval-gated write with automatic backups (`cordis.patch.yml.bak-<ts>`, newest `backupCount` kept) |
| **Tool trial console** | server → `mcp__*` tool → JSON args → canonical JSON result + rendered content; capped by `trialMaxResultChars`; panel-only, never model context |
| **Capabilities board** | Resources / Prompts availability, feature-detected; both read *pending upstream support* today (the official client bridges tools only) |
| **Probes** | one-click / passive Streamable HTTP connectivity probes (panel-only results) |

## Quick start

```sh
# git channel (builds via the package's prepare script)
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.4.0
# npm channel (published tarball, no build approval needed)
dsh plugin --profile web add dsh-mcp-panel@0.4.0
```

Then restart (or let the web surface hot-reload `cordis.patch.yml`) and open **Settings → Plugins → MCP**, or run:

```text
/mcp
/mcp everything tools
/mcp everything health
/mcp everything call echo '{"message": "hi"}'
```

Manual install: put `dsh-mcp-panel` into the profile's `node_modules` (or the shared `$DSH_HOME/profiles/node_modules` fallback) and add the row to `cordis.patch.yml`:

```yaml
- insert:
    - id: mcp-panel
      name: dsh-mcp-panel
      config:
        probeEnabled: true
```

### Uninstall

1. Remove the `mcp-panel` row from `cordis.patch.yml` (the web surface hot-reloads it; other surfaces restart).
2. Delete the package from the profile's `node_modules` (or the shared `profiles/node_modules` fallback).
3. Verify with `dsh web --dump-config` that no `mcp-panel` row remains.

## Honest by contract

- **The bridge stays the bridge.** No transport, OAuth, or protocol changes; one mcp-client row per server, exactly as hand-written.
- **No fake status.** Connection fields without upstream observations read `unknown` / `—` with `statusSource: 'derived'`; exit codes / stderr tails are never invented.
- **Sanitized display.** URL query credentials, userinfo passwords, header values, bearer tokens, and JWTs are redacted before rendering; configured `headers` never enter any snapshot; env/header **values** never leave the host (the editor sees keys only).
- **Writes are append-only, approval-gated, and backed up.** The console never rewrites `cordis.patch.yml`: it appends generated operations. When an approval service exists and the caller's session has a live agent inside an open turn, the write asks `ctx.approval` (only `allowed-once` proceeds); otherwise the explicit interactive confirmation is the approval channel. `writeEnabled: false` is a hard kill switch.
- **No prompt injection.** The panel registers **no prompt sections**; its only model-facing text is the two tool/command descriptions, in the official client's minimal style.

## Config

| Key | Default | Description |
|---|---|---|
| `probeEnabled` | `true` | register the `mcp_probe` background-job tool (panel-only results) |
| `probeTimeoutMs` | `10000` | per-probe timeout in ms |
| `maxProbes` | `10` | probe records shown in the panel |
| `refreshIntervalMs` | `0` | suggested panel refresh in ms; `0` = on demand |
| `outputLanguage` | `en` | `/mcp` output language: `en\|zh\|es\|pt\|hi` |
| `passiveProbeEnabled` | `false` | periodically probe streamable-http servers |
| `passiveProbeIntervalMs` | `60000` | passive probe interval in ms |
| `trialEnabled` | `true` | tool trial console (settings tab + `/mcp call`) |
| `trialTimeoutMs` | `120000` | panel-side deadline per trial call |
| `trialMaxResultChars` | `60000` | cap on the trial result payload |
| `writeEnabled` | `true` | kill switch: `false` rejects every profile write (copy still works) |
| `backupCount` | `5` | `cordis.patch.yml` backups retained per write |

## Resources & Prompts

The official client documents *"Tools are the only bridged MCP capability"* — Resources and Prompts are deferred. The console feature-detects a proposed upstream catalog seam and will show read-only lists the day it ships; until then the capabilities board marks both **pending upstream support** (see the harness `docs/upstream-proposal.md` addendum for the follow-up proposals).

## Development

```sh
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack
```

- `src/patch.ts` — validation, keep-semantics merge, YAML fragment rendering (pure).
- `src/write.ts` — backup + append + retention (the only file-write module).
- `src/trial.ts` — official-pipeline trial calls via `ctx.tools.execute()`.
- `src/diagnostics.ts` — error-pattern → suggestion mapping (pure).
- `src/client/` — the settings console (server editor, trial console, diagnostics).
- `scripts/verify-headless.mjs` boots the real web profile and prints exact `/mcp` output.

Releases: `node scripts/release.mjs <x.y.z>` runs the full gate, commits, and tags `v<x.y.z>` locally (never pushes).

## Contributors

Thanks to everyone who reported issues, reviewed, or contributed code — in particular [xiaoyuyu6420](https://github.com/xiaoyuyu6420), who diagnosed the missing client devDependencies behind clean-checkout build failures (PR #5).

## License

Apache-2.0 — see [LICENSE](LICENSE).
