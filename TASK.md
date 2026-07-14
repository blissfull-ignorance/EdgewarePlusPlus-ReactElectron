# TASK — Discord Presence via discord-rpc

**Priority:** Medium
**Branch:** `macos-cross-platform`

## Objective

Integrate `discord-rpc` to show presence on Discord (e.g. app name, state, timestamps, pack info, popup count).

---

### Steps

1. **Check package availability**
   - Verify if `discord-rpc` is already in `package.json`; if not:
     - `npm install discord-rpc` (main process Node.js dependency)
     - Confirm the module is compatible with macOS/Windows/Linux

2. **Create IPC handler** — `electron/ipc/discord.ts`
   - `discord:init` — authenticate with Discord, set activity
   - `discord:update` — update activity fields (state, details, timestamps)
   - `discord:destroy` — clear presence, dispose of RPC client
   - Register handlers in `electron/main.ts`

3. **Expose in preload** — `electron/preload.ts`
   - Add `initDiscord()`, `updateDiscord(activity)`, `destroyDiscord()` to contextBridge

4. **Update renderer types** — `src/types/global.d.ts`
   - Add the three new methods to the `ElectronAPI` interface

5. **Create Zustand store** — `src/stores/discordStore.ts`
   - State: `connected: boolean`, `error: string | null`
   - Actions: `initPresence()`, `updatePresence(state)`, `destroyPresence()`
   - Wire `updatePresence` to react to popupStore count and packStore changes

6. **Wire to app lifecycle**
   - In `src/App.tsx` or a dedicated side-effect hook:
     - `initPresence()` on startup
     - `updatePresence()` when popup count or pack changes
     - `destroyPresence()` on panic / quit

7. **Verify**
   - `npm run check` — TypeScript passes
   - `npm run lint` — ESLint passes
   - `npm run test` — Vitest passes (54 tests)

8. **Commit**
   ```bash
   git add -A && git commit -m "feat: integrate Discord presence via discord-rpc"
   ```

9. **Update HANDOVER.md**
   - Move "Discord presence" from "What's NOT Done" to "What's Working"
   - Update "Last Session" heading to "Discord presence via discord-rpc"
   - Add the commit hash under Recent Commits
   - Reorder or remove from "Next Session Priority Order"

---

**Proceed in order. Do not skip steps.**
