# TASK: Playwright Integration Tests

**Session:** 2026-07-14
**Branch:** `macos-cross-platform`

## Goal

Add Playwright browser-level integration tests for the Electron app.

## Status: PARTIAL — NOT RUNNABLE

Steps 1–5 completed. Step 6 (run tests) blocked by preload.cjs sync and fengari CJS/ESM issues. See HANDOVER.md.

## Completed

1. ✅ Install Playwright and configure for Electron (`@playwright/test`)
2. ✅ Create `tests/electron.spec.ts` with 6 test cases
3. ✅ Create `playwright.config.ts`
4. ✅ Add `test:e2e` and `test:e2e:ui` npm scripts
5. ✅ Fix `EDGWARE_NO_DEVTOOLS` env var in `electron/main.ts`
6. ✅ Fix `fengari-interop` CJS import in `electron/scripting/api_v1.ts` (partial)
7. ✅ Update HANDOVER.md with blockers as high-priority tasks
8. ✅ Update ARCHITECTURE.md with Playwright section

## Blocked

- **preload.cjs out of sync with preload.ts** — Renderer crashes calling missing APIs
- **fengari-interop CJS/ESM** — Production builds crash; dev mode works
- **App component throws** — `#root` stays empty due to missing preload APIs

## Next Steps (HANDOVER.md priority order)

1. Fix preload.cjs to match preload.ts
2. Fix fengari-interop import pattern
3. Verify Playwright tests pass
