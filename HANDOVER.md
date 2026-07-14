# Edgeware++ React App Migration — HANDOVER

## Current Status

**Last Session:** Test improvement — added 38 new tests (hypno decision logic, large popup edge cases, mitosis close flow, stress tests)

**Date:** July 14, 2026

**Branch:** `macos-cross-platform`

### What's Working

- **Popup BrowserWindows** — borderless, transparent, always-on-top, resizable
- **Draggable headers** — 28px `-webkit-app-region: drag` bar on each popup
- **Popup scale** — `popupScale` config (0.5x–3x) with slider in Config Panel
- **Persistent movement** — directional vectors with bounce, 50ms tick, Math.round for IPC safety
- **Per-type limits** — separate `maxImages` and `maxVideos` caps (default 10 each)
- **Hypno overlays** — .gif only, applied to static images (png/jpg/bmp/webp), not gifs or videos
- **Denial filters** — CSS blur/saturate/brightness applied randomly based on `denialChance`
- **Click-to-close** — close button with pack-defined text (popupClose from index.json); buttonless mode allows body-click to close
- **Config persistence** — load/save via IPC to `userData/config.json`
- **Pack loading** — directory scanning, zip extraction, media categorization, popupClose from index.json
- **Keyboard shortcuts** — panic button via `globalShortcut`
- **System tray** — context menu with Panic/Quit
- **Wallpaper** — cross-platform (osascript/gsettings/user32.dll)
- **Splash screen** — fade animation on startup
- **Config Panel** — full settings UI with tabs (General, Popups, System, Theme, Pack, Hibernate)
- **Prompt modal** — Mantine modal with Levenshtein distance validation
- **Hibernate panel** — hibernate activation with type selection
- **103 Vitest tests** — movement (35) + movement.runtime (6) + movement.flow (17) + hypno (11) + hypno.runtime (34), all passing
- **Fengari scripting wired** — Lua VM lifecycle, IPC bridge (script:start/stop/execute), scriptStore dispatches Lua callbacks to popupStore, corruptionStore, moodStore, promptStore, and appStore
- **Notifications** — `electron.Notification` API wired via IPC, preload exposes `showNotification`, Lua `sendNotification` triggers native desktop notification
- **Discord presence** — `discord-rpc` integrated via IPC, preload, Zustand store; updates on popup count/pack changes; respects `showDiscord` config toggle; destroys on panic/quit
- **Mitosis mode** — spawn-on-close logic with `mitosisChance` (0–100%) and `mitosisStrength` (max popups per close); `mitosisSpawned` flag prevents infinite loops; config toggle + slider in Modes tab
- **Web open** — `shell.openExternal()` wired via IPC (`web:openExternal`), preload exposes `openExternal(url)`, opens URLs in default browser

### Known Issues

1. **Tray icon missing** — No icon assets in repo, shows default Electron icon.

### Recent Commits

```
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

- **Cross-platform verification** — Only tested on macOS
- **Tray icon assets** — No .icns/.ico/.png icons in repo

### Build Commands

```bash
npm run check            # TypeScript type checking (tsc --noEmit)
npm run lint             # ESLint
npm run test             # Vitest (103 tests)
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
│   │   ├── popup/
│   │   │   ├── movement.ts          # Pure functions: computeMove, tickPopups, shouldMove, randomDirection
│   │   │   ├── debug.ts             # Movement event logger
│   │   │   ├── ImagePopup.tsx        # Image popup component
│   │   │   ├── VideoPopup.tsx        # Video popup component
│   │   │   ├── AudioPopup.tsx        # Audio popup component
│   │   │   ├── HypnoOverlay.tsx      # Hypno overlay component
│   │   │   ├── SubliminalPopup.tsx   # Subliminal text overlay
│   │   │   └── *.test.ts            # 103 tests across 5 files
│   │   ├── prompt/PromptModal.tsx    # Mantine modal with Levenshtein
│   │   └── hibernate/HibernatePanel.tsx
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

1. **LOW**: Compare the former edgeware python projects features and config options to the current state of the implementation: Are all features ported? Are all tests ported?
2. **LOW**: Cross-platform verification (Windows, Linux)
3. **LOW**: Tray icon assets (.icns, .ico, .png)

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
