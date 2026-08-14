# Contributing to dsh-mcp-panel

Thanks for your interest! PRs fixing bugs, improving tests, or tightening docs are welcome.

## Repository gates

```sh
pnpm install
pnpm run typecheck        # local gate: requires a deepseek-harness checkout (see below)
pnpm run typecheck:ci     # npm gate: published 0.1.0-rc.6 type faces, no checkout needed
pnpm test
pnpm run build
pnpm run verify:self-contained
pnpm run verify:artifacts
```

CI (`ci.yml`) runs `typecheck:ci → test → build → verify:self-contained → verify:artifacts`
on Linux and Windows with Node 22 and 24, plus a monthly `harness-compat` job
(`compat.yml`) that boots the real deepseek-harness web profile with the packed
plugin installed.

## Typecheck boundary

`tsconfig.json` maps `@deepseek-ai/cordis`, `@deepseek-ai/dsh-typert-protocol` and
the client type faces to **relative paths into a deepseek-harness checkout**
(`../../../packages/…`, `../../../vendor/cordis/…`), so the local `typecheck`
gate sees the harness's freshest type faces. The npm-resolved gate
(`typecheck:ci`, `tsconfig.ci.json` with the `paths` cleared) compiles the same
sources against the published `0.1.0-rc.6` faces and is what CI runs, so a PR
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
