# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

- Engineering & product improvements per `docs/optimization-plan.zh.md`.

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
