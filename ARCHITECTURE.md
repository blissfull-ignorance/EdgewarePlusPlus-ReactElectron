# Architecture Overview

Edgeware++ is designed as a modular, cross-platform application that orchestrates intrusive visual and auditory events. The primary goal is to provide a highly customizable experience through a "Pack" system while maintaining compatibility across Windows, Linux, and macOS.

## Codebase Structure

```text
EdgewarePlusPlus/
├── edgeware/
│   ├── assets/              # Static assets, GLSL shaders, and tutorial content
│   ├── data/                # Default presets and configuration files
│   └── src/
│       ├── config/          # Configuration management, themes, and the Config UI
│       ├── features/        # Implementation of all core intrusive features
│       │   ├── audio.py     # Audio playback and fading
│       │   ├── corruption.py# Corruption state machine and logic
│       │   ├── popup.py     # Base class for all popup types
│       │   ├── image_popup.py # Image-based popups with hypnosis/booru
│       │   ├── video_popup.py # mpv-powered video popups
│       │   └── ...          # Other specific features (prompts, subliminals, etc.)
│       ├── os_utils/        # Platform-specific abstractions (Windows, Linux, Mac)
│       ├── pack/            # Logic for loading, indexing, and managing Packs
│       ├── scripting/       # Custom scripting language interpreter
│       ├── main_edgeware.py # Application entry point and orchestrator
│       ├── main_config.py   # Main configuration window logic
│       ├── state.py         # Global session state tracking
│       └── utils.py         # General helper functions
├── examples/                # Example pack structures for developers
└── pack_tool/               # Separate CLI tool for pack creation
    └── src/                 # PackTool implementation
```

## Structural Decisions

### 1. Modular Feature Design
Each "feature" (e.g., VideoPopup, Audio, Corruption) is encapsulated in its own module within `edgeware/src/features`. This allows for easy addition of new features without modifying the core orchestration logic in `main_edgeware.py`.

### 2. Cross-Platform Abstraction Layer
To handle the significant differences in how Windows, Linux, and macOS handle window transparency, borderless windows, and wallpaper changes, the project uses an `os_utils` package. The main application calls generic functions (e.g., `os_utils.set_wallpaper`), and the appropriate platform-specific implementation is used at runtime.

### 3. State and Settings Separation
- **`Settings`**: Handles persistent configuration (loaded from `.cfg` or `.json` files).
- **`State`**: Handles transient session data (e.g., current corruption level, list of active popups, prompt status).
This separation ensures that session-specific data isn't accidentally persisted and that configuration changes can be reloaded without resetting the current session state.

### 4. Media Playback Strategy
- **Images**: Handled via `PIL` (Pillow) for processing and `tkinter` for display.
- **Audio**: Handled via `pyglet` for streaming playback and volume control.
- **Video**: Handed off to an external `mpv` process. This was chosen to support high-performance playback, hardware acceleration, and custom GLSL shaders, which would be prohibitively complex to implement natively in Python/Tkinter.

## Design Trade-offs

### Tkinter vs. Modern GUI Frameworks
**Decision**: Use `tkinter` for the main UI and popup windows.
- **Pros**: Zero external dependencies (built-in to Python), lightweight, and sufficient for simple borderless windows.
- **Cons**: Limited styling capabilities and poor performance for complex animations.
- **Mitigation**: Complex visuals (videos, shaders) are offloaded to `mpv`.

### Recursive `after()` vs. Game Loop
**Decision**: Use `root.after()` for periodic event spawning.
- **Pros**: Integrates perfectly with `tkinter`'s event loop, avoiding threading issues with GUI updates.
- **Cons**: Not as precise as a dedicated high-frequency game loop.
- **Mitigation**: Sufficient for the needs of this application, as millisecond precision is not required for popup spawning.

### Threading for Heavy I/O
**Decision**: Use daemon threads for filesystem-heavy operations (e.g., image replacement, drive filling).
- **Pros**: Keeps the GUI responsive.
- **Cons**: Potential for race conditions if not carefully managed.
- **Mitigation**: These tasks are generally "fire-and-forget" or use atomic state updates.

## Pack System
The "Pack" system is the heart of the application's extensibility. Packs are essentially zipped archives containing:
1. **Media Assets**: Images, videos, and audio files.
2. **`index.json`**: A manifest mapping assets to "moods" and defining pack-specific settings.
3. **Optional Config**: A `config.json` to automatically apply settings when the pack is loaded.

This architecture allows users to create entirely new experiences without touching the source code.

---

## React/Electron Movement System

The popup movement system spans React (renderer), Zustand stores, pure logic modules, and Electron IPC (main process).

### Data Flow

```
ConfigPanel (slider) ──► configStore (movingChance, movingSpeed)
                                  │
App.tsx spawn tick (configurable interval) ───────┘
  ├─ per-type limit check: imageCount < maxImages, videoCount < maxVideos
  ├─ pickRandom from combined image + video pool (or audio if no media)
  ├─ shouldMove(cfg.movingChance) → boolean (assigned once at spawn time)
  ├─ randomDirection() → { dx, dy } (persistent directional vector)
  ├─ hypno overlay: only applied to static images (png/jpg/bmp/webp), not gifs or videos
  └─ addPopup({ moving, dx, dy, ... }) ──► popupStore
                                                │
App.tsx movement effect (setInterval 50ms) ─────┘
  ├─ tickPopups(popups, speed, screen) → Map<id, PositionUpdate>
  ├─ electronAPI.movePopup(id, x, y) ──IPC──► BrowserWindow.setPosition()
  └─ updatePopup(id, { x, y, dx, dy }) ──► popupStore (next tick reads new position)
```

### Key Files

| File | Role |
|------|------|
| `src/features/popup/movement.ts` | Pure functions: `computeMove`, `tickPopups`, `shouldMove`, `randomDirection` |
| `src/features/popup/debug.ts` | Structured movement event logger (toggle-able, logs to console) |
| `src/stores/popupStore.ts` | Zustand store: `popups[]`, `addPopup`, `updatePopup`, `removePopup` |
| `src/stores/configStore.ts` | Config defaults (e.g. `movingChance: 0`, `movingSpeed: 5`, `maxImages: 10`, `maxVideos: 10`) |
| `src/App.tsx` | Two `useEffect` loops: spawn (configurable interval) + movement (50ms fixed) |
| `electron/ipc/popup.ts` | Main process: `createPopupWindow`, `movePopupWindow` (`BrowserWindow.setPosition`) |
| `electron/ipc/pack.ts` | Pack loader: `categorizeByExt`, `HYPN_EXTS` (.gif only), `IMAGE_EXTS`, `VIDEO_EXTS` |
| `electron/preload.ts` | Exposes `movePopup`, `createPopup`, etc. via `ipcRenderer.invoke` |

### Movement Design

- **Persistent direction**: Each popup gets `{ dx, dy }` (unit vector from random angle) at spawn time. These never change unless the popup bounces off a screen edge.
- **Bounce at edges**: `computeMove` clamps to `[0, screen.width - popup.width]` and `[0, screen.height - popup.height]`, reversing `dx`/`dy` on bounce.
- **Per-popup `moving` flag**: Set once at spawn via `shouldMove(cfg.movingChance)`. A popup that starts stationary never moves; one that starts moving always moves.
- **Tick interval**: 50ms (20 ticks/sec). Each tick reads fresh store state via `getState()`.
- **Integer coordinates**: `computeMove` returns `Math.round()` values to prevent Electron IPC float serialization errors.

### Hypno Overlay System

- **Pack loading** (`electron/ipc/pack.ts`): `HYPN_EXTS` contains only `.gif` files. Mp4/webm files are never counted as hypno, only as videos.
- **Spawn decision** (`App.tsx`): Hypno overlay is only applied to static images (png, jpg, jpeg, bmp, webp). Gifs, videos, and audio never receive hypno overlays.
- **Opacity**: Controlled by `cfg.subliminalsAlpha` (0–100), applied as CSS opacity on the `#hypno-img` element.
- **Eligibility check**: `extOf(path)` extracts file extension; `STATIC_IMG_EXTS.has(ext)` gates the hypno random roll.

### Test Architecture

| Test File | What It Tests |
|-----------|--------------|
| `movement.test.ts` | Unit tests for `computeMove`, `shouldMove`, `randomDirection`, `tickPopups` (23 tests) |
| `movement.runtime.test.ts` | Full store integration: `addPopup` → `tickPopups` → `updatePopup` with real Zustand stores (6 tests) |
| `movement.flow.test.ts` | End-to-end simulation: config → spawn decision → tick loop → store updates, replicating App.tsx logic (8 tests) |
| `hypno.test.ts` | `categorizeByExt` verification: gif → hypno, mp4/webm → not hypno, static images → not hypno (8 tests) |
| `hypno.runtime.test.ts` | Spawn decision logic: `canHaveHypno` extension checks, subliminalsChance/Alpha gating (9 tests) |

### Debug Logging

`src/features/popup/debug.ts` provides `logMovementEvent()` which logs structured JSON events with `[movement:tick]`, `[movement:move]`, `[movement:spawn]` tags. Enabled by default; call `disableMovementDebug()` to silence.

`App.tsx` also has always-on `console.log` diagnostics tagged `[movement]`, `[movement:tick]`, `[movement:move]`, `[spawn]`, and `[spawn:hypno]`.

---

## Config Persistence

Config is stored as JSON on disk via Electron IPC:

- **Load:** `App.tsx` calls `electronAPI.loadConfig()` on mount → `electron/ipc/config.ts:loadConfig()` reads from `app.getPath('userData')/config.json`
- **Save:** ConfigPanel calls `electronAPI.saveConfig(cfg)` → `electron/ipc/config.ts:saveConfig()` writes JSON to disk
- **Merge:** On load, saved config is spread over defaults (`{ ...defaults, ...saved }`) so new config fields are automatically supported

### Key Files

| File | Role |
|------|------|
| `electron/ipc/config.ts` | `loadConfig()`, `saveConfig()`, `getDefaultConfig()` — file I/O to `userData/config.json` |
| `electron/main.ts` | Registers `config:load` and `config:save` IPC handlers |
| `src/stores/configStore.ts` | Zustand store with all config defaults and `updateConfig()` |
| `src/App.tsx` | Calls `loadConfig()` on mount, merges into configStore |

---

## Pack System (Electron Implementation)

Packs are loaded from the filesystem by the main process. The renderer receives the scanned pack via IPC.

### Loading Flow

```
User selects packPath in ConfigPanel
  → electronAPI.loadPack(packPath)  ──IPC──►  electron/ipc/pack.ts
  │
  ├─ If .zip: extractPackZip() → scan extracted directory
  ├─ scanDirRecursive(packPath) → list all files
  ├─ categorizeByExt(files) → { images, videos, audio, hypno }
  ├─ readTextFile() for captions.txt, denials.txt, prompts.txt, etc.
  ├─ loadInfo(info.json) → PackInfo
  ├─ loadIndex(index.json) → PackIndex
  └─ return ScannedPack to renderer
       │
       └─ packStore.loadPack(scannedPack) ──► Zustand store
```

### Media Categorization Rules

| Extension Set | Files | Arrays |
|---------------|-------|--------|
| `IMAGE_EXTS` | .png, .jpg, .jpeg, .gif, .bmp, .webp | `images[]` |
| `VIDEO_EXTS` | .mp4, .webm, .mov | `videos[]` |
| `AUDIO_EXTS` | .mp3, .wav, .ogg, .flac, .m4a, .aac | `audio[]` |
| `HYPN_EXTS` | .gif ONLY | `hypno[]` (also in `images[]`) |

A `.gif` file appears in both `images` and `hypno` arrays. The spawn tick uses `images` for display selection and `hypno` for overlay selection independently.

### Key Files

| File | Role |
|------|------|
| `electron/ipc/pack.ts` | Pack scanner: `scanDirRecursive`, `categorizeByExt`, `loadPackFromDirectory`, `extractPackZip` |
| `electron/ipc/popup.ts` | Creates popup BrowserWindows, moves them via `setPosition()` |
| `src/stores/packStore.ts` | Zustand store: `pack`, `loadPack()`, `unloadPack()`, `getMedia()` |

---

## Popup Window System

Each popup is a standalone Electron BrowserWindow (not an in-app overlay).

### Window Properties

- `frame: false` — borderless
- `transparent: true` — allows transparent backgrounds
- `alwaysOnTop: true` — popups stay above other windows
- `resizable: true` — user can resize
- `hasShadow: false` — no window shadow
- 28px draggable header bar via `-webkit-app-region: drag` in `electron/popup.html`

### Popup Lifecycle

1. **Spawn:** `App.tsx` tick → `electronAPI.createPopup(opts)` → `electron/ipc/popup.ts:createPopupWindow()` → new BrowserWindow with `popup.html?params`
2. **Move:** `App.tsx` movement effect → `electronAPI.movePopup(id, x, y)` → `BrowserWindow.setPosition(x, y)`
3. **Close:** User clicks popup → `window.close()` → `onPopupClosed` IPC event → `popupStore.removePopup(id)`

### Key Files

| File | Role |
|------|------|
| `electron/popup.html` | Popup window HTML/CSS/JS — header bar, media display, hypno overlay, click counter |
| `electron/ipc/popup.ts` | Main process: `createPopupWindow()`, `movePopupWindow()`, IPC handlers |
| `electron/preload.ts` | Exposes `createPopup`, `movePopup`, `closePopup` via `ipcRenderer.invoke` |

---

## Test Architecture

54 tests across 5 test files, all passing:

| Test File | Tests | What It Tests |
|-----------|-------|--------------|
| `movement.test.ts` | 23 | Unit: `computeMove`, `shouldMove`, `randomDirection`, `tickPopups` |
| `movement.runtime.test.ts` | 6 | Integration: real Zustand stores, addPopup → tickPopups → updatePopup |
| `movement.flow.test.ts` | 8 | E2E: config → spawn → tick loop → store updates (mirrors App.tsx) |
| `hypno.test.ts` | 8 | Pack categorization: gif→hypno, mp4/webm→not hypno |
| `hypno.runtime.test.ts` | 9 | Spawn decision: canHaveHypno, subliminalsChance/Alpha gating |

Run with: `npm run test` (Vitest)
