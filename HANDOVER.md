# Edgeware++ React App Migration — HANDOVER

## Current Status

**Last Session:** Popup overlap avoidance — grid-based weighted positioning, 12 new unit tests

**Date:** July 15, 2026

**Branch:** `macos-cross-platform`

### What's Working

- **Popup BrowserWindows** — borderless, transparent, always-on-top, resizable
- **Draggable headers** — 28px `-webkit-app-region: drag` bar on each popup
- **Popup scale** — `popupScale` config (0.5x–3x) with slider in Config Panel
- **Persistent movement** — directional vectors with bounce, 50ms tick, Math.round for IPC safety
- **Grid-based popup positioning** — 4×3 grid weighted by occupancy, avoids overlap with existing popups, handles oversized popups and all-cells-full fallback
- **Per-type limits** — separate `maxImages` and `maxVideos` caps (default 10 each)
- **Hypno overlays** — .gif only, applied to static images (png/jpg/bmp/webp), not gifs or videos
- **Denial filters** — CSS blur/saturate/brightness applied randomly based on `denialChance`
- **Click-to-close** — close button with pack-defined text (popupClose from index.json); buttonless mode allows body-click to close
- **Config persistence** — load/save via IPC to `userData/config.json`
- **Pack loading** — directory scanning, zip extraction, media categorization, popupClose from index.json
- **Keyboard shortcuts** — panic button via `globalShortcut`
- **Panic lockout runtime** — Timed lockout after timer mode enabled, safeword validation dialog (Mantine modal), lockout state tracking in appStore, IPC channels (startLockout/clearLockout/validateSafeword), blocks panic triggers during lockout
- **System tray** — context menu with Panic/Quit + "Skip to Hibernate" (when enabled)
- **Wallpaper** — cross-platform (osascript/gsettings/user32.dll) + reactive reset when popups clear + timer-based rotation with random variance
- **Splash screen** — fade animation on startup
- **Config Panel** — full settings UI with tabs (General, Popups, System, Theme, Pack, Hibernate)
- **Prompt modal** — Mantine modal with Levenshtein distance validation
- **Hibernate runtime** — Activity loop scheduling with 6 types (Original/Spaced/Glitch/Ramp/Pump-Scare/Chaos), sleep timer, pump-scare auto-close, tray skip button, reactive wallpaper reset, config validation (fixWallpaper forced off when hibernate disabled)
- **Hibernate panel** — hibernate activation with type selection
- **281 Vitest tests** — movement (47) + movement.runtime (6) + movement.flow (17) + hypno (11) + hypno.runtime (34) + corruption (44) + hibernate (38) + panic (32) + audio (33) + wallpaper rotation (19), all passing
- **Fengari scripting wired** — Lua VM lifecycle, IPC bridge (script:start/stop/execute), scriptStore dispatches Lua callbacks to popupStore, corruptionStore, moodStore, promptStore, and appStore
- **Notifications** — `electron.Notification` API wired via IPC, preload exposes `showNotification`, Lua `sendNotification` triggers native desktop notification
- **Discord presence** — `discord-rpc` integrated via IPC, preload, Zustand store; updates on popup count/pack changes; respects `showDiscord` config toggle; destroys on panic/quit
- **Mitosis mode** — spawn-on-close logic with `mitosisChance` (0–100%) and `mitosisStrength` (max popups per close); `mitosisSpawned` flag prevents infinite loops; config toggle + slider in Modes tab
- **Audio playback** — volume config (`audioVolume` 0–100), `maxAudio` limit enforcement, `audioMod` probability for spawning alongside visual media, fade in/out (`fadeInDuration`/`fadeOutDuration`), panic cleanup (pause on unmount)
- **Web open** — `shell.openExternal()` wired via IPC (`web:openExternal`), preload exposes `openExternal(url)`, opens URLs in default browser
- **Feature parity audit** — All 97 Python config options verified present; 11 runtime gaps identified and documented in FEATURE_PARITY_AUDIT.md
- **Corruption runtime** — Level progression with timed/popup/launch/script triggers; mood cycling via cumulative add/remove; config overrides per level (respecting CORRUPTION_BLOCK); pack corruption.json loading; ConfigPanel shows corruption level and override count; 44 unit tests

### Known Issues

1. **Tray icon missing** — No icon assets in repo, shows default Electron icon.

### Recent Commits

```
feat: popup overlap avoidance — grid-based weighted positioning, 12 tests
feat: wallpaper rotation — timer-based cycling with random variance, panic cleanup, 19 tests
fix: audio playback — volume config, maxAudio limit, audioMod probability, fade, panic cleanup, tests
feat: hibernate gap fixes — pump-scare auto-close, tray skip, reactive wallpaper reset, tests
feat: implement corruption runtime with level progression, mood cycling, and config overrides
docs: feature parity audit and comment improvements
899eab0 test: add hypno decision logic, large popup edge cases, mitosis close flow, and stress tests
test: improve test viability, remove 7 dead tests, add 18 new meaningful tests
feat: add close button with pack-defined text to popups
fix: resolve Playwright/Vitest conflict and verify e2e tests
89637b0 fix: sync preload.cjs with preload.ts to resolve renderer crash
feat: wire shell.openExternal via IPC for web links
fd71bb9 feat: implement mitosis mode spawn-on-close logic
15fac0b feat: integrate Discord presence via discord-rpc
e01b5fd feat: wire Fengari scripting engine to renderer via IPC
7e0251b fix: sync ConfigData type with renderer Config (add maxImages, popupScale)
c594a48 docs: add comprehensive comments with markers to all code files
5b6a031 docs: update ARCHITECTURE.md with current feature state
54fb42b feat: split maxVideos into maxImages + maxVideos
3b932db fix: only gif hypno overlays on static images, not gifs or videos
1e552c7 fix: round popup coordinates to integers for Electron IPC
dd7306d refactor: directional movement with per-popup moving flag and bounce
d7684ef feat: implement moving popups with screen-bounded random drift
cdb7b4e fix: use actual screen bounds for popup positioning
f9477ae fix: restrict video formats to Chromium-supported codecs
83dd187 feat: add draggable headers, popup scale slider, and resizable windows
37b2381 config parity: align with original Edgeware++ config options
```

### What's NOT Done

- **Panic lockout runtime** — ✅ Implemented: timer, safeword validation dialog, lockout state, IPC, 32 unit tests
- **Audio playback** — ✅ Implemented: volume config, maxAudio limit, audioMod probability, fade in/out, panic cleanup, 33 unit tests
- **Wallpaper rotation** — ✅ Implemented: timer-based cycling with random variance, panic cleanup, 19 unit tests
- **Popup overlap avoidance** — ✅ Implemented: 4×3 grid-based weighted positioning, occupancy-aware cell selection, oversized popup handling, 12 unit tests
- **Lowkey corner positioning** — Config exists but no corner-based positioning logic
- **Popup timeout (auto-close)** — Config exists but no auto-close timer on popups
- **Single mode spawn logic** — Config exists but spawn tick doesn't use weighted random selection
- **Booru download** — Config exists but no download logic wired
- **Run at startup** — Config exists but no OS-level auto-start registration
- **Media blacklist** — Not ported (Alt+click to blacklist media)
- **Danger warnings** — Python shows danger dialogs for extreme/major settings
- **Config validation** — Python validates against voluptuous schemas; TS has no runtime validation
- **Cross-platform verification** — Only tested on macOS
- **Tray icon assets** — No .icns/.ico/.png icons in repo

### Build Commands

```bash
npm run check            # TypeScript type checking (tsc --noEmit)
npm run lint             # ESLint
npm run test             # Vitest (281 tests)
npm run test:e2e         # Playwright Electron integration tests (6 tests)
npm run dev              # Vite dev server
npm run electron:dev     # Dev with Electron
npm run build            # Build React app
npm run electron:build   # Build Electron app
```

### Project Structure

```
EdgewarePlusPlus/
├── electron/              # Electron main process
│   ├── main.ts            # Entry point, IPC handler registration
│   ├── preload.ts         # contextBridge API (TypeScript source)
│   ├── preload.cjs        # contextBridge API (CJS, actually loaded — synced with preload.ts)
│   ├── popup.html         # Popup window HTML/CSS/JS
│   ├── ipc/               # IPC handlers
│   │   ├── config.ts      # Config load/save
│   │   ├── pack.ts        # Pack scanning, categorizeByExt, zip extraction
│   │   ├── popup.ts       # BrowserWindow creation, movement
│   │   ├── keyboard.ts    # Global shortcuts
│   │   ├── tray.ts        # System tray
│   │   ├── wallpaper.ts   # Cross-platform wallpaper
│   │   ├── filesystem.ts  # Drive fill, image replace
│   │   ├── shortcut.ts    # Desktop shortcuts
│   │   ├── scripting.ts   # Fengari IPC bridge (script:start/stop/execute)
│   │   ├── discord.ts     # Discord RPC IPC (init/update/destroy)
│   │   ├── panic.ts       # Panic lockout IPC (startLockout/clearLockout/validateSafeword)
│   │   └── web.ts         # Web open IPC (shell.openExternal)
│   └── scripting/         # Fengari Lua VM (wired to renderer via IPC)
│       ├── engine.ts      # Lua state lifecycle
│       ├── api_v1.ts      # edgeware_v1 module (fengari-interop CJS/ESM issue)
│       ├── api_v0.ts      # edgeware_v0 module
│       ├── api_basic.ts   # print() override
│       └── callbacks.ts   # Lua function reference management
├── src/                   # React app (renderer)
│   ├── App.tsx            # Main component: spawn tick, movement effect, routing
│   ├── main.tsx           # React entry (MantineProvider + HashRouter)
│   ├── theme.ts           # Mantine theme config
│   ├── stores/            # Zustand stores (10 stores)
│   │   ├── configStore.ts # All config defaults + updateConfig()
│   │   ├── popupStore.ts  # Active popups + addPopup/updatePopup/removePopup
│   │   ├── packStore.ts   # Loaded pack + getMedia()
│   │   ├── appStore.ts    # Splash, panic, running state
│   │   ├── scriptStore.ts # Script engine state, Lua→renderer event listeners
│   │   ├── discordStore.ts # Discord RPC connection state, activity updates
│   │   └── ...            # corruptionStore, hibernateStore, moodStore, etc.
│   ├── features/
│   │   ├── config/ConfigPanel.tsx   # Full settings UI (tabs: General, Popups, System, Theme, Pack, Hibernate)
│   │   ├── corruption/
│   │   │   ├── corruption.ts        # Pure functions: level progression, mood computation, fade, config overrides
│   │   │   └── corruption.test.ts   # 44 unit tests for corruption pure functions
│   │   ├── popup/
│   │   │   ├── movement.ts          # Pure functions: computeMove, computeSpawnPosition, tickPopups, shouldMove, randomDirection
│   │   │   ├── debug.ts             # Movement event logger
│   │   │   ├── ImagePopup.tsx        # Image popup component
│   │   │   ├── VideoPopup.tsx        # Video popup component
│   │   │   ├── AudioPopup.tsx        # Audio popup component
│   │   │   ├── HypnoOverlay.tsx      # Hypno overlay component
│   │   │   ├── SubliminalPopup.tsx   # Subliminal text overlay
│   │   │   └── *.test.ts            # 115 tests across 5 files
│   │   ├── prompt/PromptModal.tsx    # Mantine modal with Levenshtein
│   │   ├── panic/
│   │   │   ├── panic.ts              # Pure functions: lockout timer, safeword validation, shouldBlockPanic
│   │   │   ├── panic.test.ts         # 32 unit tests for panic lockout pure functions
│   │   │   └── SafewordModal.tsx     # Mantine modal for safeword entry during lockout
│   │   └── hibernate/
│   │       ├── hibernate.ts          # Pure functions: delay computation, activity scheduling, wallpaper reset
│   │       ├── hibernate.test.ts     # 38 unit tests for hibernate pure functions
│   │       └── HibernatePanel.tsx    # UI: type selection, activate/deactivate button
│   │   └── wallpaper/
│   │       ├── rotation.ts           # Pure functions: next index, interval with variance, schedule computation
│   │       └── rotation.test.ts      # 19 unit tests for wallpaper rotation pure functions
│   ├── components/
│   │   ├── SplashScreen.tsx          # Startup splash animation
│   │   └── PopupContainer.tsx        # In-app popup dispatch
│   ├── hooks/useElectronAPI.ts       # Typed access to window.electronAPI
│   └── types/
│       ├── pack.ts          # Config, Pack, PackInfo, CorruptionConfig types
│       ├── popup.ts         # Popup types
│       ├── global.d.ts      # window.electronAPI type declarations
│       └── fengari.d.ts     # Fengari module declarations
├── tests/                 # Playwright integration tests
│   └── electron.spec.ts   # 6 tests: splash/config, popup lifecycle, panic mode
├── playwright.config.ts   # Playwright configuration
├── ARCHITECTURE.md         # System architecture (up to date)
├── REACT-APP.md            # Migration plan (up to date)
├── AGENTS.md               # Agent instructions (up to date)
└── HANDOVER.md             # This file
```

### Next Session Priority Order

1. ~~**HIGH**: Implement panic lockout runtime~~ ✅ Done
2. ~~**MEDIUM**: Audio playback~~ ✅ Done
3. ~~**MEDIUM**: Implement wallpaper rotation~~ ✅ Done
4. ~~**MEDIUM**: Implement popup overlap avoidance positioning~~ ✅ Done
5. **LOW**: Implement popup timeout (auto-close timer)
6. **LOW**: Implement single mode weighted random spawn selection
7. **LOW**: Add mood-based media filtering (requires pack loader mood tagging)
8. **LOW**: Add corruption danger check dialog (warns when full-perm enables dangerous settings)
9. **LOW**: Add launch count persistence for corruption (via Electron IPC)
10. **LOW**: Cross-platform verification (Windows, Linux)
11. **LOW**: Tray icon assets (.icns, .ico, .png)
12. **MEDIUM**: Based on FEATURE_PARITY_AUDIT.md, ARCHITECTURE.md and general project analysis, overhaul the README.md completely. Make sure the README.md explains a transition from the original project to the cross platform react project, include some reasoning behind it. Make sure to include the previous information and expand


### Important Notes

- All stores use Zustand (lightweight, works well with React + Electron)
- Fengari runs in Electron main process (Node.js), not renderer
- IPC is the bridge between Electron main and renderer
- Media playback uses native HTML5 `<video>` and `<audio>` elements
- `tsc --noEmit`, `eslint`, `vitest`, and `playwright` all pass with zero errors
- React app uses HashRouter for Electron file:// compatibility
- `Math.round()` is critical for popup coordinates — Electron IPC throws on floats
- `HYPN_EXTS` contains only `.gif` — mp4/webm are videos, not hypno overlays
- **`preload.cjs` is the actual file loaded by BrowserWindow** — `preload.ts` is the TS source but is NOT what runs. Keep them in sync or use a build step.
- **Vitest excludes `tests/`** — `vite.config.ts` has `test.exclude: ['tests/**']` to prevent Vitest from picking up Playwright spec files that import `@playwright/test`.
- **Playwright tests use Vite dev server** — `test:e2e` script compiles electron TS, starts Vite on port 5173, then launches Electron in dev mode. Production mode has the CJS/ESM fengari crash.
- **Popup window detection timing** — After `createPopup` IPC resolves, Playwright needs polling time to detect the new BrowserWindow. Use `expect.poll(() => electronApp.windows().length)` instead of synchronous checks.
- **`EDGWARE_NO_DEVTOOLS` env var** — When set, prevents Electron from opening DevTools in dev mode (used by Playwright tests to avoid DevTools window interfering with `firstWindow()`)

---

**End of HANDOVER.md**
