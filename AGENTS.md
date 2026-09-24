# AGENTS.md

Standalone DeepSeek Harness plugin repository (`dsh-mcp-panel`). Development follows the dsh-plugin-guide skill and the official plugin contract; this file records repo-local decisions.

## Layout

- `src/index.ts` — function-plugin contract (`name`/`inject`/`Config`/`apply`; NO default export — the Loader unwraps `exports.default ?? exports`).
- `src/service.ts` — `McpPanelService` (`TypertRemoteService`, namespace `mcpPanel`): read-only snapshot assembly from loader rows + tool registry + upstream status observations. Serves `mcpPanel/status`, starts panel-only probes through `mcpPanel/probe` (`probe(serverName)`; needs `ctx.jobs`, streamable-http and stdio rows), appends CRUD fragments through `mcpPanel/writePatch` (approval-gated, backup-first, and RE-VERIFIED against the loader's re-applied state — a skipped patch never reads as success; `writeVerifyEnabled`/`writeVerifyTimeoutMs` tune the gate), and trials tools (including the three shared resource tools) through `mcpPanel/callTool`. Resources capability = `ctx.mcpResources` present AND the three shared tools registered in this scope.
- `src/wire.ts` — the snapshot vocabulary, its zod v4 wire schema, and the single `mcpPanel/status` invocation descriptor shared verbatim by the host `./typert` manifest (`src/typert.host.ts`) and the client Remote contribution (`src/client/remote.ts`) — one canonical source so the two codecs can never drift.
- `src/upstream.ts` — the proposed upstream `mcp/status` seam (event + query service face), declared here via cordis declaration merging and consumed with feature detection; when upstream ships it, its identical declarations merge cleanly and a conflicting signature fails this compile (intended tripwire). Proposal text: `docs/upstream-proposal.md` in the deepseek-harness repo. Resources are bridged by the SHIPPED `@deepseek-ai/dsh-mcp-resources` service; this file declares its minimal structural face (`mcpResources`) for presence detection only — resource trials go through the OFFICIAL shared tools, never provider internals.
- `src/sanitize.ts` — display redaction (URL query credentials, userinfo passwords, header values, bearer tokens, JWTs). Pure; extreme-case tests in `tests/sanitize.spec.ts`.
- `src/grouping.ts` / `src/aggregate.ts` — pure enumeration/grouping and status aggregation with missing-field tolerance.
- `src/command.ts` — the `/mcp` command (standard `CommandResult`; logged via `command/run` + `command/done`).
- `src/patch.ts` — pure module: config validation against the official client's face, keep-semantics merging, and the loader-dialect fragment renderer. CRUD emits `insert` (add) and id-targeted overrides (`- id:` + `name:` + `disabled:`/`config:`) — the harness patch dialect has NO `set` and no remove, so disabling a row IS the canonical removal (issue #27).
- `src/trial.ts` — the official-pipeline trial caller: `mcp__*` tools plus the three shared resource tools `list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource`, with the requested `server` injected into their arguments (conflicts fail closed).
- `src/probe.ts` — optional `mcp_probe` background-job tool (unowned job: panel-only results). Both transports probe: streamable-http via one `initialize` POST; stdio via spawning the row's `command`/`args` under `scrubbedParentEnv` (the same base the mcp-client bridge uses, imported from `@deepseek-ai/dsh-subprocess`) + explicit `env`/`cwd`, one `initialize` handshake over stdin/stdout, sanitized serverInfo or failure detail.
- `src/client/` — browser half: `$mount` the Remote contribution, register the `settings.plugins.tab` entry id `mcp`, pure presenter in `present.ts`, inline scoped stylesheet in `styles.ts` (standalone bundles cannot use the in-repo CSS-module pipeline).
- `tests/` — vitest; REAL `Context` + `Session`/`ToolRuntime`/`CommandRuntime` from the `0.1.7-rc.1` peers, fake Loader face, fake Agent, optional fake jobs.

## Hard rules applied here

- Read-only panel: never write a config file, never call `Entry.update`, never fake a connection state. Unobservable fields read `unknown`/`-1`/`—` with `statusSource: 'derived'`.
- Panel content is never model context; `/mcp` output is model-readable and log-reconstructable.
- Everything displayed is sanitized; configured `headers` never enter any snapshot.
- No mcp-client changes: transport/OAuth/protocol stay untouched (upstream proposal only).
- Host-side data channel is the `mcpPanel` Typert Remote namespace (the ui-settings-plugin-inventory precedent), not session projections — MCP status is app-level, runtime-varying state, and the session-projection `view`-reads-live-service pattern is sanctioned only for boot-constant units.

## Config

Schema in `src/config.ts` (Schemastery, fail-loud bounds, explicit `resolveConfig`): `probeEnabled` (default true), `probeTimeoutMs` (10000), `maxProbes` (10), `refreshIntervalMs` (0 = on demand), `outputLanguage` (`'en' | 'zh' | 'es' | 'pt' | 'hi'`), `passiveProbeEnabled` (false), `passiveProbeIntervalMs` (60000), `writeEnabled` (true), `writeVerifyEnabled` (true), `writeVerifyTimeoutMs` (3000), `backupCount` (5). `cordis.patch.yml` comments document the same keys; the five-language READMEs carry the user-facing table. `package.json#dshWorkshop` is the omdsh-workshop-package/v1 intake manifest for the DSH Hub Workshop registry (declarations only — evidence paths stay null until their adapter runs).

## Build

`typescript` + `tsdown` are regular `dependencies` on purpose: pnpm does not install devDependencies of git-hosted packages, and the git channel's `prepare` must build with production dependencies alone. `scripts/prepare.mjs` is the single build entry (tsc declarations → `lib/types`, tsdown bundles → `lib/index.js` + `lib/typert.host.js` + `lib/client.js`).

## Checks

`pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack`. The plain `typecheck` resolves the local harness checkout's fresh type faces through tsconfig `paths`; `typecheck:ci` resolves the npm-published `0.1.7-rc.1` faces (no paths) and is what CI runs — keep both green.

`scripts/verify-headless.mjs` boots the real web profile with this plugin installed (temp `DSH_HOME` + `dsh plugin --profile web add <tarball>`) and prints the exact `/mcp` output; `.github/workflows/compat.yml` runs the same flow monthly against a pinned harness SHA (set `DSH_INSTALL_ANCHOR` when plugin and harness are siblings).

## Release

`node scripts/release.mjs <x.y.z>` bumps `package.json` (and the hardcoded probe `clientInfo.version` in `src/probe.ts`), stamps the `## [Unreleased]` CHANGELOG section to `[<x.y.z>] - <UTC date>`, re-runs the gate, commits, and tags `v<x.y.z>` locally — never pushes. Push with `git push origin main --follow-tags`; the `release` workflow (release.yml) then gates again, publishes npm with provenance (secret `NPM_TOKEN`), and creates the GitHub Release from the CHANGELOG section (`scripts/changelog-section.mjs`). Tags are `v<x.y.z>`; a missing historical tag gets backfilled at its release commit.

## Docs

- Five-language READMEs (`README.md`, `README-zh.md`, `README-es.md`, `README-pt.md`, `README-hi.md`) — keep all five in sync; the English file is the source of truth.
- GitHub topics: `dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `mcp`, `mcp-client`, `observability`, `panel` (the ecosystem's visibility channel is the `dsh-plugin` topic; see dsh-plugin-guide §9). npm keywords mirror them.

## Peer versions

Peer deps range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0`; the package runs against harness installations ≥ 0.1.2-rc.1 (the profile's hoisted module fallback resolves peers to the installation's own copies). `@types/node` deliberately tracks the `engines` floor (Node 22 line, `^22.19.0`): major bumps such as dependabot's 26.2.0 proposal describe APIs the supported runtime does not have and are declined (dependabot.yml ignores semver-major for it; rationale also on PR #3). Client type faces come from the four `@deepseek-ai/dsh-client-*` devDependencies (`connection`/`locale`/`ui-settings`/`ui-slots`, `0.1.7-rc.1`) — imports in `src/client` resolve against them, so a clean checkout typechecks with `typecheck:ci` alone.
