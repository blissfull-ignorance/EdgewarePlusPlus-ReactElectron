# TASK — Mitosis Mode Logic

**Priority:** Medium
**Branch:** `macos-cross-platform`

## Objective

Implement mitosis mode: when a popup is closed, spawn a new popup to maintain the target popup count.

---

### Steps

1. **Understand the existing config**
   - Check `configStore.ts` for mitosis-related config fields
   - Verify if `mitosis` boolean and related options already exist in the config type

2. **Add mitosis config fields if missing**
   - In `src/types/pack.ts`, ensure `ConfigData` has:
     - `mitosis: boolean` (enable/disable)
     - `mitosisChance: number` (0–1, probability of spawning on close)
     - `mitosisMax: number` (max popups to spawn per close event)

3. **Implement spawn-on-close logic in `src/stores/popupStore.ts`**
   - Add action: `spawnMitosisPopup(closedType)` 
   - When a popup is removed, if `mitosis` is enabled:
     - Roll random against `mitosisChance`
     - Spawn 1–`mitosisMax` new popups of same or compatible type
     - Use existing `addPopup` action to create them

4. **Wire close event to mitosis**
   - In `src/App.tsx` or popup components, when `removePopup` is called:
     - If mitosis is enabled, call `spawnMitosisPopup` with the closed popup's type
     - Ensure spawn doesn't trigger infinite loop (mitosis popups don't trigger mitosis)

5. **Add config toggle in ConfigPanel**
   - In `src/features/config/ConfigPanel.tsx`, add a Mitosis tab or section:
     - Toggle: Enable/Disable mitosis
     - Slider: Mitosis chance (0–100%)
     - Number input: Max popups per spawn

6. **Verify**
   - `npm run check` — TypeScript passes
   - `npm run lint` — ESLint passes
   - `npm run test` — Vitest passes (54 tests)

7. **Commit**
   ```bash
   git add -A && git commit -m "feat: implement mitosis mode spawn-on-close logic"
   ```

8. **Update HANDOVER.md**
   - Move "Mitosis mode" from "What's NOT Done" to "What's Working"
   - Update "Last Session" heading to "Mitosis mode logic"
   - Add the commit hash under Recent Commits
   - Remove from "Next Session Priority Order"

---

**Proceed in order. Do not skip steps.**