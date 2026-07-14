# TASK — Notifications via Electron API

**Priority:** Medium
**Branch:** `macos-cross-platform`

## Objective

Wire `electron.Notification` API so the app can send desktop notifications
(e.g. on script events, hibernate start/end, or panic).

---

### Steps

1. **Add IPC handlers in `electron/ipc/`**
   - Create `electron/ipc/notifications.ts`
   - Implement `notification:show` handler using `electron.Notification`
   - Register the handler in `electron/main.ts`

2. **Expose in preload**
   - Add `showNotification(title, body)` to `electron/preload.ts` via `contextBridge`

3. **Update renderer types**
   - Add `showNotification` signature to `src/types/global.d.ts` in `ElectronAPI`

4. **Create a notification hook/store**
   - Either add a Zustand store slice or a React hook in `src/hooks/`
   - Expose a simple `notify(title, body)` function

5. **Wire to Lua scripting callbacks**
   - In `electron/scripting/callbacks.ts`, invoke `notification:show` when Lua scripts call a `notify()` function

6. **Verify**
   - `npm run check` — TypeScript passes
   - `npm run lint` — ESLint passes
   - `npm run test` — Vitest passes (54 tests)

7. **Commit**
   ```bash
   git add -A && git commit -m "feat: wire desktop notifications via Electron Notification API"
   ```

8. **Update HANDOVER.md**
   - Move "Notifications" from "What's NOT Done" to "What's Working"
   - Add a "Last Session: Notifications via Electron API" entry at top
   - Update test count if new tests were added
   - Remove or reorder "Next Session Priority Order"

---

**Proceed in order. Do not skip steps.**
