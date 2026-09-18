# Canary: alpha.1 → alpha.2 type-face audit (0-R batch, 2026-09-18)

This repo is the family canary for the `0.1.6-alpha.2` published type faces
(exec card step 7). Recorded here for the other 31 repos' heads-up.

## This repo: result

- devDependencies (16 `@deepseek-ai/dsh-*` pins) raised `0.1.6-alpha.1` → `0.1.6-alpha.2`.
- `pnpm run typecheck` (checkout-paths face) → **exit 0, 0 errors**.
- `pnpm run typecheck:ci` (published npm face, no paths) → **exit 0, 0 errors**.
- **No newly exposed errors.** The alpha.2 face introduces no breakage on this
  repo's surface (A2/B5/A02 code fixes remain the W1 batch's own work and were
  not touched here).

## Family warning entries (observed elsewhere, not in this repo)

1. `@deepseek-ai/dsh-attachment`: `ImageRequestPolicy` moved from named export
   to **default export** in alpha.2 (TS2614 on named import). Observed in
   dsh-local-ai `src/adapter.ts(15,32)`.
2. `@deepseek-ai/dsh-llm`: `CallId` is no longer an exported member in alpha.2
   (TS2614). Transitive breakage observed via
   `@deepseek-ai/dsh-user-approval/lib/types/index.d.ts(9,15)`.
3. `@deepseek-ai/dsh-session`: `DEFAULT_PROFILE_PATCH_RELOAD` (alpha.1-only)
   absent — the M1 ruler-liveness counterexample symbol (expected red).

Any repo importing `ImageRequestPolicy`/`CallId` as named exports will turn
red when its devDependencies reach alpha.2; the default-export form is the
fix.
