# Contributing to dsh-mcp-panel

Thanks for your interest! PRs fixing bugs, improving tests, or tightening docs are welcome.

## Repository gates

```sh
pnpm install
pnpm run typecheck        # requires a deepseek-harness checkout (see below)
pnpm test
pnpm run build
pnpm run verify:self-contained
pnpm run verify:artifacts
```

CI runs `test → build → verify:self-contained → verify:artifacts` on Linux and Windows (`.github/workflows/ci.yml`).

## Typecheck boundary

`tsconfig.json` maps `@deepseek-ai/cordis`, `@deepseek-ai/dsh-typert-protocol` and
the four client type faces to **relative paths into a deepseek-harness checkout**
(`../../../packages/…`, `../../../vendor/cordis/…`): the harness's published npm
packages are older than its source tree, and its client type faces are not
published at all. Consequences:

- `pnpm run typecheck` works only when this repository sits at
  `<checkout>/Project/Plugins/dsh-mcp-panel` (the shipped layout).
- Everything else — tests, build, and both verify scripts — resolves from
  `node_modules` and needs no checkout; CI therefore does not run `tsc`, and
  that is a documented decision, not an omission (vendoring the transitive
  type closure spans ~6 packages and would drift faster than it helps; see
  `docs/optimization-plan.zh.md` §5.1).

## Style

- Every module and export has JSDoc for its non-obvious contract.
- Tests describe behavior: prefer the smallest case that pins a regression.
- Commit messages follow conventional-commits style (`fix:`, `docs:`, …).

## Security

Do not paste secrets, keys, or tokens into issues or PRs.
