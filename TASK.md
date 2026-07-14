# Task: Verify Playwright Tests Pass

**Priority:** HIGH — #1 on Next Session Priority Order

**Problem:** Playwright tests in `tests/electron.spec.ts` are blocked because Vitest picks up the file (rejecting `test.beforeAll()`), and the tests require a running Electron + Vite dev server. Now that `preload.cjs` and `fengari-interop` are fixed, the tests should be runnable.

## Steps

1. **Run Playwright tests** — Execute `npm run test:e2e` and capture the full output (logs, errors, exit code).

2. **Diagnose failures** — If tests fail or crash, read `tests/electron.spec.ts` and `playwright.config.ts` to understand what the tests expect. Cross-reference with recent fixes (preload sync, fengari-interop) to identify remaining issues.

3. **Fix Vitest pickup** — If Vitest still picks up `electron.spec.ts`, either rename the file to exclude it from Vitest (e.g. `electron.e2e.spec.ts`) or add a Vitest config exclusion for `tests/`.

4. **Fix test failures** — Address any failing assertions, missing APIs, or Electron startup issues. Check that `EDGWARE_NO_DEVTOOLS` env var is correctly handled.

5. **Run full validation** — `npm run check` must pass with zero errors.

6. **Run lint** — `npm run lint` must pass with zero errors.

7. **Run Vitest** — `npm run test` must pass (54 tests).

8. **Improve comments** — Review all modified files, add or update `FUTUREWORK`/`DISCUSSION`/`REMOVABLE`/`FIXME` markers where appropriate for documentation.

9. **Commit changes** — Stage and commit with a descriptive conventional commit message (e.g. `fix: resolve Playwright/Vitest conflict and verify e2e tests`).

10. **Update HANDOVER.md** — Update "Current Status", "Known Issues", and "Recent Commits" to reflect the completed work. Remove Playwright from "What's NOT Done" if fully resolved.
