# Contributing to dsh-mcp-panel

Thanks for your interest! PRs fixing bugs, improving tests, or tightening docs are welcome.

## Repository gates

```sh
pnpm install
pnpm run typecheck        # local gate: requires a deepseek-harness checkout (see below)
pnpm run typecheck:ci     # npm gate: published 0.1.1-rc.2 type faces, no checkout needed
pnpm test
pnpm run build
pnpm run verify:self-contained
pnpm run verify:artifacts
```

CI (`ci.yml`) runs `typecheck:ci → test → build → verify:self-contained → verify:artifacts`
on Linux and Windows with Node 22 and 24, plus a monthly `harness-compat` job
(`compat.yml`) that boots the real deepseek-harness web profile with the packed
plugin installed. Pushing a `v*` tag triggers the `release` workflow
(`release.yml`): gate again → npm publish with provenance → GitHub Release from
the CHANGELOG section.

## Release

1. Put the release entries under a `## [Unreleased]` heading at the top of
   `CHANGELOG.md` (keep it in sync with the five READMEs).
2. Run `node scripts/release.mjs <x.y.z>` — it validates a clean tree, writes
   the version into `package.json`, stamps the `[Unreleased]` section into
   `[<x.y.z>] - <UTC date>`, re-runs the full gate (the version tripwire in
   `tests/version.spec.ts` runs inside), then commits and tags `v<x.y.z>`.
   On gate failure it reverts the two written files.
3. `git push origin main --follow-tags`. The `release` workflow refuses to
   publish when the tag does not name the package version (`scripts/check-tag-version.mjs`).
4. If a release commit needs notes outside the changelog, `node scripts/changelog-section.mjs <x.y.z>`
   prints the exact section used as the GitHub Release body.

## Typecheck boundary

`tsconfig.json` maps `@deepseek-ai/cordis`, `@deepseek-ai/dsh-typert-protocol` and
the client type faces to **relative paths into a deepseek-harness checkout**
(`../../../packages/…`, `../../../vendor/cordis/…`), so the local `typecheck`
gate sees the harness's freshest type faces. The npm-resolved gate
(`typecheck:ci`, `tsconfig.ci.json` with the `paths` cleared) compiles the same
sources against the published `0.1.1-rc.2` faces and is what CI runs, so a PR
cannot drift from the published type line. Consequences:

- `pnpm run typecheck` works only when this repository sits at
  `<checkout>/Project/Plugins/dsh-mcp-panel` (the shipped layout).
- Everything else — `typecheck:ci`, tests, build, and both verify scripts —
  resolves from `node_modules` and needs no checkout.

## Style

- Every module and export has JSDoc for its non-obvious contract.
- Tests describe behavior: prefer the smallest case that pins a regression.
- Commit messages follow conventional-commits style (`fix:`, `docs:`, …).

## Security

Do not paste secrets, keys, or tokens into issues or PRs.
