<div align="center">

# dsh-mcp-panel
- **1024 store channel**: `npm i -g dsh1024` once, then `dsh1024 plugin --profile web add dsh-mcp-panel` (counts toward the [deepseek1024.com](https://deepseek1024.com) install ranking).
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-mcp-panel)

**The MCP management console for the official DeepSeek Harness MCP client — add, edit, remove, and trial-call MCP servers from a settings page, with honest status, health diagnostics, and safe, reversible profile writes.**

*Official client = bridge, this plugin = console: read status through the `mcp/status` seam, write only append-only, approval-gated profile patches.*

> **Official repository.** This is the only official repository of dsh-mcp-panel, maintained by PerryLink. Same-name repositories under other accounts are not affiliated.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-mcp-panel/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-mcp-panel/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-mcp-panel?label=version)](https://github.com/PerryLink/dsh-mcp-panel/releases)
[![npm version](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![npm downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibility

| Surface | Status |
|---|---|
| Harness | DeepSeek Harness `0.1.2-alpha.5` (adapted 2026-09-02): the session envelope keeps its ignorable field for stored-log read compatibility only - Session.append still cannot stamp it, so audit-gate behavior is unchanged. |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Platforms | Web GUI (dual-face: host + browser) |
| Model | Any (the panel is read-only; only `/mcp` output is model-readable) |

## What you get

`dsh-mcp-panel` is the experience layer on top of the official MCP client: a read-only runtime view plus safe, reversible profile writes.

- **`/mcp` command** — one row per server: transport, target, tool count, connection status (from the upstream seam; `unknown` when unobserved), last error, reconnect count — model-readable, session-log reconstructable, five output languages.
- **`/mcp <server> tools`** — model-visible `mcp__*` tool names and descriptions.
- **`/mcp <server> health`** — derived self-heal suggestions (ENOENT → missing dependency, ECONNREFUSED, timeouts, 401/403/404, DNS, rate limit, reconnect exhaustion…); exit code / stderr tail honestly labeled *pending upstream support* until the client exposes them.
- **`/mcp <server> call <tool> [json]`** — trial-call through the **official tool pipeline** (`ctx.tools.execute()`); pre-execute permission policy, approval, guards, and post-execute all apply.
- **Settings → Plugins → MCP tab** — status cards with badges, diagnostics, and probes, plus the server CRUD and the tool trial console.
- **Server CRUD** — add/edit/remove forms → `insert`/`set`/`set disabled` fragments → clipboard copy or approval-gated write with automatic backups.
- **Recommended directory** — a built-in community MCP server catalog (filesystem, git, github, fetch, playwright, …) served in the snapshot; `catalogEntries` appends/overrides entries, and `catalogToConfigInput` turns one into a one-click add.
- **Config import/export** — `exportConfigs()` serializes the server rows to a versioned JSON document (a `!!js` row exports as `null` with a reason), and `importPreview()` parses an export back into per-server `add` patch fragments for review.
- **Tool trial console** — server → `mcp__*` tool → JSON args → canonical JSON result + rendered content; capped by `trialMaxResultChars`; panel-only, never model context.

## Architecture: official client = bridge, this plugin = console

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) is the **only bridge**: one plugin instance per MCP server, configured as a hand-written `cordis.yml` row, connecting the transport, syncing tools, and registering `mcp__<server>__<tool>` names. This plugin never replaces it — it is the **experience layer on top**:

```text
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

## Quick start

```sh
# 1. install the bundle into your profile
dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"

# or from npm (published releases)
dsh plugin --profile web add dsh-mcp-panel

# 2. restart and verify the row
dsh --profile web --dump-config | grep -A3 'id: mcp-panel'
```

Then open **Settings → Plugins → MCP**, or run:

```text
/mcp
/mcp everything tools
/mcp everything health
/mcp everything call echo '{"message": "hi"}'
```

## Install & uninstall

- **git channel** (latest `main`): `dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"` — the `prepare` script builds with production dependencies only.
- **npm channel** (published releases): `dsh plugin --profile web add dsh-mcp-panel`.
- **tarball channel**: `pnpm pack` in this repo, then `dsh plugin --profile web add ./dsh-mcp-panel-<version>.tgz`.
- **uninstall**: remove the `mcp-panel` row from `cordis.patch.yml` (the web surface hot-reloads it), delete the package from the profile's `node_modules`, and verify with `dsh web --dump-config` that no `mcp-panel` row remains.

## Configuration

All tunables are Schemastery `Config` fields (changeable from cordis.yml). `cordis.patch.yml` documents each key inline.

| Key | Default | Meaning |
|---|---|---|
| `probeEnabled` | `true` | Register the `mcp_probe` background-job tool (panel-only results) |
| `probeTimeoutMs` | `10000` | Per-probe timeout in ms |
| `maxProbes` | `10` | Probe records shown in the panel |
| `refreshIntervalMs` | `0` | Suggested panel refresh in ms; `0` = on demand |
| `outputLanguage` | `en` | `/mcp` output language: `en \| zh \| es \| pt \| hi` |
| `passiveProbeEnabled` | `false` | Periodically probe streamable-http servers |
| `passiveProbeIntervalMs` | `60000` | Passive probe interval in ms |
| `trialEnabled` | `true` | Tool trial console (settings tab + `/mcp call`) |
| `trialTimeoutMs` | `120000` | Panel-side deadline per trial call in ms |
| `trialMaxResultChars` | `60000` | Cap on the trial result payload in chars |
| `writeEnabled` | `true` | Kill switch: `false` rejects every profile write (copy still works) |
| `backupCount` | `5` | `cordis.patch.yml` backups retained per write |
| `catalogEntries` | `[]` | User overlay for the recommended server directory: entries append, an entry with the same `id` replaces the built-in one |

## Tools & surfaces

| Surface | Kind | Notes |
|---|---|---|
| `/mcp` | command | Per-server status row; model-readable and log-reconstructable |
| `/mcp <server> tools` | command | Model-visible `mcp__*` tool names + descriptions |
| `/mcp <server> health` | command | Derived self-heal suggestions from sanitized error text |
| `/mcp <server> call <tool> [json]` | command | Trial-call through the official tool pipeline |
| `mcp_probe` | tool | Optional Streamable HTTP connectivity probe (background job) |
| Settings → Plugins → MCP tab | UI slot | Status cards, server CRUD, and the tool trial console |
| `mcpPanel` Typert Remote | service | Read-only snapshot channel (host → client) |

## Resources & Prompts

The official client documents that *"Tools are the only bridged MCP capability"* — Resources and Prompts are deferred. The console feature-detects a proposed upstream catalog seam and will show read-only lists the day it ships; until then the capabilities board marks both **pending upstream support**.

## Permissions & data

- **Permissions**: the `dshWorkshop` manifest declares `network:outbound` and `native-code:none`.
- **Data**: the panel is read-only; it writes only append-only `cordis.patch.yml` fragments (approval-gated, backup-first). URL query credentials, userinfo passwords, header values, bearer tokens, and JWTs are redacted before rendering; configured `headers` never enter any snapshot, and env/header **values** never leave the host (the editor sees keys only).

## Security boundaries

- **The bridge stays the bridge.** No transport, OAuth, or protocol changes; one mcp-client row per server, exactly as hand-written.
- **No fake status.** Connection fields without upstream observations read `unknown` / `—` with `statusSource: 'derived'`; exit codes and stderr tails are never invented.
- **Writes are append-only, approval-gated, and backed up.** The console never rewrites `cordis.patch.yml`; it appends generated operations and keeps the newest `backupCount` backups.
- **No prompt injection.** The panel registers **no prompt sections**; its only model-facing text is the two tool/command descriptions.

## Known limitations

- **Resources & Prompts** are pending upstream support — the official client bridges tools only.
- **Exit codes / stderr tails** are labeled *pending upstream support* until the client exposes them.
- **Read-only panel** — the console never fakes a connection state; unobservable fields read `unknown` / `-1` / `—`.

## Development

```sh
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack
```

`scripts/verify-headless.mjs` boots the real web profile and prints the exact `/mcp` output. Releases: `node scripts/release.mjs <x.y.z>` runs the full gate, commits, and tags `v<x.y.z>` locally (never pushes).

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `mcp`, `mcp-client`, `observability`, `panel`

## Contributors

- [@PerryLink](https://github.com/PerryLink) — creator and maintainer.
- [@xiaoyuyu6420](https://github.com/xiaoyuyu6420) — diagnosed the missing client devDependencies behind clean-checkout build failures (PR #5).
- [@feiler0](https://github.com/feiler0) — contributed the stdio MCP server probe (one MCP initialize handshake over stdin/stdout) (PR #7, merged as PR #15).

## PerryLink DSH Plugin Family

This project is one of the [33 DeepSeek Harness plugins](https://github.com/PerryLink) maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-dsh-data-quality](https://github.com/PerryLink/dsh-dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |

### Install from the DSH Desktop Market

All PerryLink plugins are browsable in the built-in DSH Desktop Market: **Market → Sources → add source → paste** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ select it**. Installation still goes through the Market's npm-identity verification and your confirmation.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel contributors
