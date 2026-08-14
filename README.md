# dsh-mcp-panel

**Read-only runtime management panel for the official DeepSeek Harness MCP client — see every MCP server's status, tools, errors, and reconnect counts, without touching your config.**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

> 🔭 **Observability-first.** [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) keeps its connection state private — logs only. This plugin shows everything it *can* observe (config, tool registry, loader state) and says **"unknown"** for what it cannot, instead of guessing. It also proposes the minimal upstream seam that would make status real: see the [upstream proposal](docs/upstream-proposal.md).

## Compatibility

- **Runtime**: DeepSeek Harness ≥ `0.1.0-rc.5` (peer dependencies pin the `0.1.0-rc.6` package line).
- **Last verified**: 2026-08-14 against a source checkout of deepseek-harness (workspace packages at `0.1.0-rc.5`, mainline `7b9644f`) — headless `/mcp` end-to-end plus a live web profile; evidence in [docs/research-notes.zh.md](docs/research-notes.zh.md). Re-verified the same day against mainline `47f9438` with the `mcp/status` seam branch (`feat/mcp-client-status-observability-seam`): a real `server-everything` row renders `status: connected (source: upstream-event)` through the packed plugin, plus the launcher-faithful compat flow; record in [docs/optimization-plan-v2.zh.md](docs/optimization-plan-v2.zh.md).

## What you get

| Surface | What it shows |
|---|---|
| **`/mcp` command** | transport, target, tool count, connection status, last error, reconnect count — model-readable, session-log reconstructable, five output languages (`outputLanguage: en\|zh\|es\|pt\|hi`) |
| **Settings → Plugins → MCP tab** | the same snapshot read-only, with status badges, expandable tool lists, sanitized errors, probe results |
| **Panel probe button** | one-click connectivity probe of one streamable-http server from the tab; results stay panel-only |
| **Passive probes** | optional background reachability badges per server, kept separate from connection status |
| **Auto refresh** | the host suggests a refresh interval (`refreshIntervalMs`); the tab polls and pauses while hidden |
| **`/mcp <server> disable\|enable`** | the exact `cordis.patch.yml` line to apply — a *suggestion*, never a write |
| **`mcp_probe` tool** | one-shot Streamable HTTP connectivity probe as a background job; results are **panel-only** |

## Quick start

```sh
# git channel (builds via the package's prepare script)
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.2.0
# npm channel (published tarball, no build approval needed)
dsh plugin --profile web add dsh-mcp-panel@0.2.0
```

Then restart (or let the web surface hot-reload its `cordis.patch.yml`) and:

```text
/mcp
/mcp everything tools
/mcp everything disable
```

```text
MCP servers (1):
- everything [mcp-everything] stdio node …/server-everything/dist/index.js
  | 13 tools | enabled | status: unknown (source: derived) | reconnects: — | last error: —
```

Manual install: put `dsh-mcp-panel` into the profile's `node_modules` (or the shared
`$DSH_HOME/profiles/node_modules` fallback) and add the row to `cordis.patch.yml`:

```yaml
- insert:
    - id: mcp-panel
      name: dsh-mcp-panel
      config:
        probeEnabled: true
        probeTimeoutMs: 10000
```

### Uninstall

1. Remove the `mcp-panel` row from `cordis.patch.yml` (the web surface hot-reloads it; other surfaces restart).
2. Delete the package from the profile's `node_modules` (or the shared `profiles/node_modules` fallback).
3. Verify with `dsh web --dump-config` that no `mcp-panel` row remains.

## Honest by contract

- **Read-only.** No configuration file is ever written. `disable`/`enable` prints a suggestion you apply yourself.
- **No fake status.** Connection fields without upstream data read `unknown` / `—`, with `statusSource: derived`.
- **Sanitized display.** URL query credentials, userinfo passwords, header values, bearer tokens, and JWTs are redacted before rendering; configured `headers` never enter any snapshot.
- **Panel-only results.** Probe details live in the settings tab, never in model context; `/mcp` output is the model-readable surface and is fully reconstructable from the session log.
- **No mcp-client changes.** Transport, OAuth, and protocol stay untouched — the observability gap is covered by the [upstream proposal](docs/upstream-proposal.md), which this plugin already consumes (typed `mcp/status` event + `mcpStatus` query service, feature-detected at runtime).

## Configuration

| Field | Default | Description |
|---|---|---|
| `probeEnabled` | `true` | Register the `mcp_probe` tool (needs `ctx.jobs` in the composition) |
| `probeTimeoutMs` | `10000` | Per-probe timeout |
| `maxProbes` | `10` | Cap on probe records shown in the panel |
| `refreshIntervalMs` | `0` | Suggested panel refresh interval in ms (`0` = on demand only) |
| `outputLanguage` | `en` | Output language of the `/mcp` command (`en` \| `zh` \| `es` \| `pt` \| `hi`) |
| `passiveProbeEnabled` | `false` | Periodically probe streamable-http servers in the background |
| `passiveProbeIntervalMs` | `60000` | Passive probe interval in milliseconds |

## Permissions & data

- **Reads**: loader entries, the tool registry (`mcp__<server>__` names), and — when upstream ships it — `mcp/status` events.
- **Writes**: none. No configuration file is ever modified.
- **Network**: only the one-shot `mcp_probe` (and the optional passive probe) POSTs one MCP `initialize` request to endpoints you configured; configured headers are used for the request and are never displayed or logged.
- No telemetry, no external services, no background work beyond the optional probe timers.

## Troubleshooting

- Row not visible? Run `dsh web --dump-config` and check that the `mcp-panel` insert landed with a unique id.
- Panel shows `status: unknown (source: derived)` — expected until the upstream seam lands; see [docs/upstream-proposal.md](docs/upstream-proposal.md).
- Panel looks stale? Set `refreshIntervalMs` to a positive value (e.g. `5000`) in the `mcp-panel` config row to poll automatically.
- Boot log shows a FAILED `mcp-panel` fiber — the package must resolve from the profile (bare `name: dsh-mcp-panel` resolves via the profile's `node_modules` or the shared fallback).
- Rollback: remove the row (see Uninstall).

## Security

Found a security issue? Open a GitHub issue **without** pasting secrets, keys, or tokens — redact everything first. This plugin holds the credentials of your configured MCP servers only in memory for probe requests; they never reach logs or snapshots.

## How it works

- **Host half** — a `mcpPanel` Typert Remote service assembles the snapshot from three read-only sources: loader rows (`@deepseek-ai/dsh-mcp-client` entries), `ctx.tools.schemas()` grouped by the `mcp__<server>__` namespace, and upstream `mcp/status` observations. The hand-written `./typert` manifest registers `mcpPanel/status` with the gateway; `zod` is bundled, so the host bundle is self-contained.
- **Browser half** — a `dsh.client` bundle (served at `/plugins/dsh-mcp-panel/client.js`) mounts the same descriptor via `ctx.remote.$mount` and registers a read-only `settings.plugins.tab` entry (`id: mcp`). The presenter is a pure function; styles are scoped and token-driven.
- **The `/mcp` command** goes through the standard command registry — every line lands in `command/run` + `command/done` session events.

## Development

```sh
pnpm install
pnpm run typecheck    # local gate: resolves the harness checkout's fresh type faces via tsconfig paths
pnpm run typecheck:ci # npm gate: resolves the published 0.1.0-rc.6 type faces (what CI runs)
pnpm test             # 105 tests: sanitizer extremes, grouping, aggregation tolerance, command output (5 languages), probe gating, client wiring, presenter
pnpm run build        # tsc declarations → lib/types; tsdown → lib/index.js + lib/typert.host.js + lib/client.js
pnpm run verify:self-contained
pnpm run verify:artifacts
pnpm pack
```

Verification against a real harness checkout:
`node --import tsx/esm scripts/verify-headless.mjs` boots the full web profile in process (ephemeral port) and prints the exact `/mcp`, `/mcp <server> tools`, and `/mcp <server> disable` output.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel contributors
