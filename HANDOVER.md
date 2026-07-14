# Edgeware++ React App Migration — HANDOVER

## Current Status

**Last Session:** Discord presence via discord-rpc

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
- **Click-to-close** — multi-click counter when `buttonless` is off
- **Config persistence** — load/save via IPC to `userData/config.json`
- **Pack loading** — directory scanning, zip extraction, media categorization
- **Keyboard shortcuts** — panic button via `globalShortcut`
- **System tray** — context menu with Panic/Quit
- **Wallpaper** — cross-platform (osascript/gsettings/user32.dll)
- **Splash screen** — fade animation on startup
- **Config Panel** — full settings UI with tabs (General, Popups, System, Theme, Pack, Hibernate)
- **Prompt modal** — Mantine modal with Levenshtein distance validation
- **Hibernate panel** — hibernate activation with type selection
- **54 Vitest tests** — movement (37) + hypno (17), all passing
- **Fengari scripting wired** — Lua VM lifecycle, IPC bridge (script:start/stop/execute), scriptStore dispatches Lua callbacks to popupStore, corruptionStore, moodStore, promptStore, and appStore
- **Notifications** — `electron.Notification` API wired via IPC, preload exposes `showNotification`, Lua `sendNotification` triggers native desktop notification
- **Discord presence** — `discord-rpc` integrated via IPC, preload, Zustand store; updates on popup count/pack changes; respects `showDiscord` config toggle; destroys on panic/quit

### Known Issues

1. **Tray icon missing** — No icon assets in repo, shows default Electron icon.

3. **No Playwright tests** — Only Vitest unit/integration tests. No browser-level integration tests.

### Recent Commits

```
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

- **Mitosis mode** — config exists but no spawn-on-close logic
- **Web open** — `shell.openExternal()` not wired
- **Playwright tests** — No browser integration tests
- **Cross-platform verification** — Only tested on macOS
- **Tray icon assets** — No .icns/.ico/.png icons in repo

### Build Commands

```bash
npm run check            # TypeScript type checking (tsc --noEmit)
npm run lint             # ESLint
npm run test             # Vitest (54 tests)
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
│   ├── preload.ts         # contextBridge API
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
│   │   └── discord.ts     # Discord RPC IPC (init/update/destroy)
│   └── scripting/         # Fengari Lua VM (wired to renderer via IPC)
│       ├── engine.ts      # Lua state lifecycle
│       ├── api_v1.ts      # edgeware_v1 module
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
│   │   │   └── *.test.ts            # 54 tests across 5 files
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
├── ARCHITECTURE.md         # System architecture (up to date)
├── REACT-APP.md            # Migration plan (up to date)
├── AGENTS.md               # Agent instructions (up to date)
└── HANDOVER.md             # This file
```

### Next Session Priority Order

1. **MEDIUM**: Mitosis mode logic (spawn popup when count hits 0)
3. **LOW**: Playwright integration tests
4. **LOW**: Cross-platform verification (Windows, Linux)
5. **LOW**: Tray icon assets (.icns, .ico, .png)

### Important Notes

- All stores use Zustand (lightweight, works well with React + Electron)
- Fengari runs in Electron main process (Node.js), not renderer
- IPC is the bridge between Electron main and renderer
- Media playback uses native HTML5 `<video>` and `<audio>` elements
- `tsc --noEmit`, `eslint`, and `vitest` all pass with zero errors
- React app uses HashRouter for Electron file:// compatibility
- `Math.round()` is critical for popup coordinates — Electron IPC throws on floats
- `HYPN_EXTS` contains only `.gif` — mp4/webm are videos, not hypno overlays

---

**End of HANDOVER.md**
