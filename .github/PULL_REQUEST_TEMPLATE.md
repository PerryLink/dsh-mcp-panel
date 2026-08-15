Thanks for the PR! Please confirm the checklist before submitting.

## Checklist

- [ ] The full gate is green: `pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts`
- [ ] Tests were added or updated for the change
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]`
- [ ] All five READMEs (`README.md`, `README.zh.md`, `README.es.md`, `README.pt.md`, `README.hi.md`) stay in sync where the change touches docs (English is the source of truth)
- [ ] A related issue is referenced (`Fixes #N`), or a short note explains why none applies
- [ ] No credentials, tokens, keys, or private paths are included in the diff

## Summary

<!-- What does this change do and why? Keep it short; the CHANGELOG entry carries the details. -->
