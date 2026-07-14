# React + Mantine + Vite + Electron — Migration Plan

## Current Status (July 14, 2026)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Scaffold | ✅ Complete | Project structure, deps, configs |
| Phase 1 — Core UI Shell | ✅ Complete | Config panel, splash, routing, panic mode |
| Phase 2 — Media & Popups | ✅ Complete | BrowserWindow popups, movement, scaling, denial filters |
| Phase 3 — OS Integration | ✅ Complete | Config persistence, keyboard, tray, wallpaper, shortcuts |
| Phase 4 — Pack System | ✅ Complete | Pack loading, media categorization, zip extraction |
| Phase 5 — Feature Porting | 🟡 Partial | Prompts, hibernate, hypno overlays done. Notifications, Discord, mitosis, web open NOT started |
| Phase 5.5 — Scripting Engine | 🟡 Partial | Fengari bridge files exist and compile, but NOT wired to React yet |
| Phase 6 — Testing | 🟡 Partial | 54 Vitest tests for movement + hypno. No Playwright/integration tests yet |

**Key accomplishments since last handover:**
- Popup BrowserWindow system with draggable 28px headers
- Persistent directional movement with bounce (50ms tick, Math.round for IPC safety)
- `popupScale` config (0.5x–3x) with slider in Config Panel
- Split `maxImages`/`maxVideos` per-type popup limits
- Hypno overlay restricted to .gif files on static images only (not gifs, not videos)
- Config persistence via Electron IPC to `userData/config.json`
- Pack loader with `categorizeByExt()` and zip extraction
- 54 passing Vitest tests across 5 test files
- Comprehensive code documentation with FUTUREWORK/DISCUSSION/REMOVABLE/FIXME markers

**Known issues:**
- `config.ts` in electron/ipc is missing `maxImages` field (only has `maxVideos`)
- Fengari scripting engine not connected to renderer yet
- No tray icon assets in repo

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Electron Main Process               │
│  (Node.js)                                       │
│  ┌───────────────────────────────────────────┐   │
│  │  Fengari Lua VM (fengari + fengari-interop)│   │
│  │  ┌─────────────────────────────────────┐   │   │
│  │  │  script.lua execution               │   │   │
│  │  │  Lua ↔ JS bridge (Edgeware API)     │   │   │
│  │  │  Callback registry (on_close, etc.)  │   │   │
│  │  └─────────────────────────────────────┘   │   │
│  ├───────────────────────────────────────────┤   │
│  │  OS Integration (Tray, Wallpaper, FS,  │   │   │
│  │   Keyboard, Notifications, IPC Bridge)  │   │   │
│  └───────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│              Electron Renderer                    │
│  (Chromium — React + Mantine + Vite)             │
│                                                   │
│  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  Mantine UI   │  │  Media Layer              │ │
│  │  (config,     │  │  (HTML5 <video>/<img>     │ │
│  │   prompts,    │  │   /<audio> + CSS filters  │ │
│  │   notifications│  │   + canvas for hypno)     │ │
│  │   etc.)       │  │                           │ │
│  └──────────────┘  └───────────────────────────┘ │
├─────────────────────────────────────────────────┤
│         Electron Preload (contextBridge)         │
│  (typed IPC API between main & renderer)         │
└─────────────────────────────────────────────────┘
```

**Build system:** `electron-vite` or `vite` + `electron-builder`
**UI kit:** Mantine v7+
**Language:** TypeScript throughout
**State:** Zustand (lightweight, works well with React + Electron IPC)
**Media embedding:** None needed — `<video>` and `<audio>` elements natively handle every format the original uses.
**Scripting engine:** Fengari (Lua 5.3 VM in JS) + fengari-interop (JS↔Lua bridge)

---

## Phase 0 — Scaffold

### 0.1 Project structure

```
edgeware-electron/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # contextBridge API
│   ├── ipc/                 # IPC handler modules (one per domain)
│   │   ├── wallpaper.ts
│   │   ├── keyboard.ts
│   │   ├── tray.ts
│   │   ├── filesystem.ts
│   │   ├── audio.ts
│   │   └── popup.ts
│   └── scripting/           # Fengari scripting engine
│       ├── engine.ts        # Lua runtime lifecycle
│       ├── api_v1.ts        # edgeware_v1 module bridge
│       ├── api_v0.ts        # edgeware_v0 module bridge
│       ├── api_basic.ts     # basic_v1 module bridge
│       ├── callbacks.ts     # Lua callback registry
│       └── types.ts         # TypeScript types for fengari interop
├── src/
│   ├── App.tsx
│   ├── main.tsx             # React entry (Vite)
│   ├── components/          # Reusable UI components
│   ├── features/            # Per-feature folders
│   ├── stores/              # Zustand stores
│   ├── hooks/               # Custom React hooks
│   ├── theme.ts             # Mantine theme config
│   └── types/               # Shared TypeScript types
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── tsconfig.json
```

### 0.2 Dependencies

```json
{
  "dependencies": {
    "@mantine/core": "^7",
    "@mantine/hooks": "^7",
    "@tabler/icons-react": "^3",
    "zustand": "^5",
    "react": "^19",
    "react-dom": "^19",
    "fengari": "^0.1.5",
    "fengari-interop": "^0.1.3"
  },
  "devDependencies": {
    "electron": "^33",
    "electron-builder": "^25",
    "vite": "^6",
    "electron-vite": "^2",
    "typescript": "^5.7"
  }
}
```

---

## Phase 1 — Core UI Shell

### 1.1 Mantine theme

Build a `theme.ts` that mirrors the original's theme system (fg/bg/font family/size).  Mantine's `MantineProvider` has built-in dark/light mode; the original's corruption mode can dynamically swap CSS variables at runtime.

### 1.2 Routing

Use React Router (or a simple zustand-based "page" state):

| Route / View   | Purpose                                        |
|----------------|------------------------------------------------|
| `/splash`      | Startup splash (fade animation)                |
| `/config`      | Full settings panel (match original tabs)      |
| `/status`      | "Running in background" indicator             |
| `/popup/:id`   | Individual popup overlay (within app bounds)   |
| `/hibernate`   | Hibernate configuration page                   |

### 1.3 Config panel

Map every original config item to a Mantine form control:

| Original config key | Control                | Mantine component       |
|---------------------|------------------------|-------------------------|
| `delay`             | Slider (ms)            | `Slider`                |
| `vidMod` / `popupMod` / etc. | Slider (%)  | `Slider`                |
| `maxVideos`         | NumberInput            | `NumberInput`           |
| `buttonless`        | Switch                 | `Switch`                |
| `panicButton`       | TextInput (key)        | `TextInput`             |
| `themeType`         | Select                 | `Select`                |
| `hibernateType`     | SegmentedControl       | `SegmentedControl`      |
| `clickthroughPopups`| Switch                 | `Switch`                |
| `packPath`          | TextInput + folder pick| `TextInput` + IPC       |

All settings saved to `config.json` via IPC (`electron/ipc/filesystem.ts`).

---

## Phase 2 — Media & Popup System ✅ COMPLETE

### 2.1 Image popup

**Implemented as BrowserWindow** (not in-app overlay). Each popup is a standalone Electron window loading `electron/popup.html`:

```ts
// electron/ipc/popup.ts — createPopupWindow()
const popupWin = new BrowserWindow({
  width, height, x, y,
  frame: false,          // borderless
  transparent: true,
  alwaysOnTop: true,
  resizable: true,
  hasShadow: false,
  webPreferences: { preload: POPUP_PRELOAD },
})
popupWin.loadURL(`popup.html?mediaPath=...&type=image&opacity=...&clicksToClose=...`)
```

- Static images: `<img>` element with `file://` protocol URL
- Animated GIFs: Same `<img>` element (browsers handle GIF natively)
- Hypno overlay: Separate `<img id="hypno-img">` positioned absolute over the media, only for static images (png/jpg/bmp/webp), never for gifs or videos
- Denial filters: CSS `filter: blur()`, `saturate()`, `brightness()` applied via `denialFilter` query param
- Click counter: `<div id="counter">` shown when `clicksToClose > 1`
- Draggable header: 28px `-webkit-app-region: drag` bar at top of popup

### 2.2 Video popup

**Implemented as BrowserWindow** with `<video>` element replacing the `<img>` in popup.html:

```tsx
// In popup.html script block
const vid = document.createElement('video')
vid.src = 'file://' + encodeURI(mediaPath)
vid.autoplay = true
vid.loop = true
vid.muted = false
vid.playsInline = true
```

- No mpv embedding — `<video>` handles everything natively in Chromium
- `VIDEO_EXTS` restricted to `.mp4`, `.webm`, `.mov` (Chromium-supported codecs)
- Error fallback: shows "unsupported format" text if video fails to load

### 2.3 Audio-only popup

Audio popups are tracked in the Zustand store but have no visual BrowserWindow. They're represented as store entries with `type: 'audio'`.

### 2.4 Popup positioning

**Implemented via Electron IPC:**

```ts
// App.tsx — spawn tick
const bounds = screenRef.current  // from electronAPI.getScreenBounds()
const x = randomInt(0, Math.max(0, bounds.width - w))
const y = randomInt(0, Math.max(0, bounds.height - h))
```

- Screen bounds fetched via `electronAPI.getScreenBounds()` IPC on mount
- Random position within screen bounds (accounting for popup dimensions)
- `popupScale` multiplier applied to popup width/height

### 2.5 Popup movement

**Implemented as persistent directional vectors with bounce:**

```ts
// src/features/popup/movement.ts — pure functions
computeMove(popup, speed, screen) → { x, y, dx, dy }
// Bounces at screen edges, reverses direction vector
// Returns Math.round() coordinates for Electron IPC safety

tickPopups(popups, speed, screen) → Map<id, PositionUpdate>
// Iterates all popups, computes new positions, returns only changed ones
```

- Each popup gets `{ dx, dy }` unit vector at spawn time
- `moving` flag set once via `shouldMove(cfg.movingChance)`
- 50ms tick interval (20 ticks/sec) in `App.tsx` movement effect
- `electronAPI.movePopup(id, x, y)` IPC call per moving popup

---

## Phase 3 — OS Integration (Electron Main) ✅ COMPLETE

### 3.1 IPC Bridge

**Implemented in `electron/preload.ts`:**

```ts
contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  loadPack: (path) => ipcRenderer.invoke('pack:load', path),
  getScreenBounds: () => ipcRenderer.invoke('screen:bounds'),
  createPopup: (opts) => ipcRenderer.invoke('popup:create', opts),
  closePopup: (id) => ipcRenderer.invoke('popup:close', id),
  movePopup: (id, x, y) => ipcRenderer.invoke('popup:move', id, x, y),
  setWallpaper: (path) => ipcRenderer.invoke('wallpaper:set', path),
  onPanic: (cb) => ipcRenderer.on('panic', () => cb()),
  onPopupClosed: (cb) => ipcRenderer.on('popup:closed', (_, id) => cb(id)),
  // ... keyboard, tray, hibernate handlers
})
```

### 3.2 Keyboard hooks

**Implemented in `electron/ipc/keyboard.ts`:**

- Global shortcuts registered via `electron.globalShortcut`
- Panic button from config (`panicButton` key, default 'e')
- `onKeyEvent` IPC event for key press/release monitoring

### 3.3 System tray

**Implemented in `electron/ipc/tray.ts`:**

- `Tray` with context menu (Panic, Quit)
- `onTrayAction` IPC event for tray menu interactions
- Tray icon asset still missing from repo (shows default icon)

### 3.4 Wallpaper

**Implemented in `electron/ipc/wallpaper.ts`:**

- Cross-platform: `osascript` (macOS), `user32.dll` (Windows), `gsettings` (Linux)
- `setWallpaper()` via IPC

### 3.5 Config persistence

**Implemented in `electron/ipc/config.ts`:**

- `loadConfig()` reads from `app.getPath('userData')/config.json`
- `saveConfig()` writes JSON to disk
- Default config merged with saved config on load

### 3.6 Desktop shortcuts

**Implemented in `electron/ipc/shortcut.ts`:**

- Cross-platform shortcut creation
- `.lnk` (Windows), `.app` (macOS), `.desktop` (Linux)

### 3.7 Drive fill

**Implemented in `electron/ipc/filesystem.ts`:**

- `fillDrive()` — writes random data to directory
- `replaceImages()` — replaces images in directory with pack copies

---

## Phase 4 — Pack System ✅ COMPLETE

### 4.1 Pack loading

**Implemented in `electron/ipc/pack.ts`:**

```ts
// Scans pack directory, categorizes media by extension
export function loadPackFromDirectory(packPath: string): ScannedPack {
  const allFiles = scanDirRecursive(packPath)
  const media = categorizeByExt(allFiles)
  // Returns { info, index, media, texts, script, scriptVersion }
}
```

- `scanDirRecursive()` — walks directory tree, returns all file paths
- `categorizeByExt()` — sorts files into images/videos/audio/hypno arrays
- `loadInfo()` — reads `info.json` for pack metadata
- `loadIndex()` — reads `index.json` for mood mappings
- `extractPackZip()` — extracts `.zip` packs to temp directory
- `readTextFile()` — reads captions.txt, denials.txt, prompts.txt, etc.

### 4.2 Media categorization

**Implemented extension sets:**

| Set | Extensions | Array |
|-----|-----------|-------|
| `IMAGE_EXTS` | .png, .jpg, .jpeg, .gif, .bmp, .webp | `images[]` |
| `VIDEO_EXTS` | .mp4, .webm, .mov | `videos[]` |
| `AUDIO_EXTS` | .mp3, .wav, .ogg, .flac, .m4a, .aac | `audio[]` |
| `HYPN_EXTS` | .gif ONLY | `hypno[]` (also in `images[]`) |

### 4.3 Script version detection

**Implemented:**

```ts
function detectScriptVersion(script: string): 'v0' | 'v1' | null {
  if (script.includes('require("edgeware_v1")')) return 'v1'
  if (script.includes('require("edgeware_v0")')) return 'v0'
  return null
}
```

---

## Phase 5 — Feature Porting (Hibernate, Prompts, etc.)

### 5.1 Hibernate mode

```ts
// Zustand store
interface HibernateState {
  active: boolean
  timerId: ReturnType<typeof setTimeout> | null
  type: 'Original' | 'Spaced' | 'Glitch' | 'Ramp' | 'PumpScare' | 'Chaos'
}
```

- Timer uses `setTimeout` in renderer (or main process for accuracy)
- On trigger: spawn popups at configured rate (same algorithm as original)
- Hibernate types are timing/rate variations — pure JS, easy to port

### 5.2 Prompts

```tsx
// Mantine components
<Textarea label="Type the following:" value={promptText} readOnly />
<TextInput
  placeholder="Your response"
  onChange={(e) => setUserInput(e.currentTarget.value)}
/>
<Button onClick={handleSubmit}>Submit</Button>
```

Levenshtein distance ported to TypeScript (identical algorithm).
Configurable mistakes limit.

### 5.3 Subliminal popups

In-app overlay with low opacity, timed auto-dismiss:

```tsx
<div style={{
  position: 'fixed',
  opacity: settings.subliminalOpacity / 100,
  pointerEvents: 'none',  // clickthrough
  ...
}}>
  {subliminalText}
</div>
```

### 5.4 Notifications

```ts
// Electron Notification API
new Notification({ title: pack.info.name, body: text, icon: pack.iconPath }).show()
```

Works on all three platforms natively.

### 5.5 Discord presence

Use `discord-rpc` package (pure JS, works in Electron main process).

### 5.6 Mitosis mode

When `state.popupNumber === 0` (observer pattern via Zustand subscription):

```ts
useEffect(() => {
  const unsub = usePopupStore.subscribe(
    (state) => state.popupCount,
    (count) => { if (count === 0) spawnPopup() }
  )
  return unsub
}, [])
```

### 5.7 Web open

```ts
import { shell } from 'electron'
shell.openExternal(url)  // cross-platform
```

---

## Phase 5.5 — Scripting Engine (Fengari Integration)

### 5.5.1 Overview

The original Edgeware++ uses a 931-line pure-Python Lua subset interpreter. Instead of porting that interpreter, we replace it with **fengari** — a complete Lua 5.3 VM written in JavaScript ES6 (~35 KB gzipped). Fengari is production-tested (2k GitHub stars, active since 2017) and provides the C API surface via JavaScript, making it natural to integrate with Node.js.

The bridge layer (`electron/scripting/`) is roughly **400 lines** of TypeScript — far less than the 931 lines of the Python interpreter being replaced.

**Why fengari over porting the interpreter:**

| Concern | Fengari | Porting Python interpreter |
|---------|---------|---------------------------|
| Lines to write | ~400 (bridge only) | ~1500 (full parser+executor) |
| Lua compatibility | Full Lua 5.3 (superset of our subset) | Our custom subset only |
| Edge case handling | Battle-tested, 1,315 commits | Must be written from scratch |
| JS interop | Built-in (fengari-interop) | Must write our own |
| Table support | Native Lua 5.3 tables | Custom implementation |
| Error messages | Full Lua error reporting | Must replicate |
| Bundle size | ~35 KB gzipped | ~50 KB (parser+executor) |

**Where fengari runs:** In the **Electron main process** (Node.js), not the renderer. This isolates the Lua VM from the UI, allows synchronous file access, and avoids any CSP issues.

### 5.5.2 Lua Script Lifecycle

```
Pack loaded ──→ Detect script.lua ──→ Create Lua state ──→ Register Edgeware API modules
                                                               │
                                                    ┌──────────┴──────────┐
                                                    ▼                     ▼
                                             edgeware_v1 API         edgeware_v0 API
                                             (table-based args)      (positional args)
                                                    │                     │
                                                    └──────────┬──────────┘
                                                               ▼
                                                     Execute script.lua
                                                               │
                                                    callbacks registered
                                                    timers scheduled
                                                               │
                                                    Lua state stays alive
                                                    for session duration
                                                               │
                                                    On pack change / quit:
                                                    Close Lua state
```

### 5.5.3 Fengari Lua State Lifecycle

```typescript
// electron/scripting/engine.ts
import { lua, lauxlib, lualib } from 'fengari'
import { interop } from 'fengari-interop'

let L: ReturnType<typeof lauxlib.luaL_newstate> | null = null
let isRunning = false

export function initLuaState(): void {
  if (L) closeLuaState()
  L = lauxlib.luaL_newstate()
  lualib.luaL_openlibs(L)
  isRunning = true
}

export function closeLuaState(): void {
  if (L) {
    lua.lua_close(L)
    L = null
    isRunning = false
  }
}

export function executeScript(script: string): void {
  if (!L) throw new Error('Lua state not initialized')
  const ok = lua.luaL_loadstring(L, script)
  if (ok !== 0) {
    const err = lua.lua_tojsstring(L, -1)
    lua.lua_pop(L, 1)
    throw new LuaError(err)
  }
  const result = lua.lua_pcall(L, 0, 0, 0)
  if (result !== 0) {
    const err = lua.lua_tojsstring(L, -1)
    lua.lua_pop(L, 1)
    throw new LuaError(err)
  }
}
```

### 5.5.4 Edgeware API Bridge

The Lua API modules (`edgeware_v0`, `edgeware_v1`, `basic_v1`) are implemented as **TypeScript functions pushed into the Lua global scope** via `lua_pushjsfunction`.

#### edgeware_v1 module (the modern API, ~150 lines):

```typescript
// electron/scripting/api_v1.ts
import { lua, lauxlib } from 'fengari'
import { interop } from 'fengari-interop'
import type { LuaState } from 'fengari'

export function registerEdgewareV1(
  L: LuaState,
  callbacks: {
    openImage: (filename?: string) => number
    openVideo: (filename?: string) => number
    playAudio: (filename?: string) => number
    openPrompt: (text?: string) => number
    after: (ms: number, callbackId: string) => void
    roll: (chance: number) => boolean
    progressCorruption: () => void
    setWallpaper: (filename: string) => void
    panic: () => void
    closePopups: () => void
    setActiveMoods: (moods: string[]) => void
    enableMood: (mood: string) => void
    disableMood: (mood: string) => void
    setPopupCloseText: (text: string) => void
    setPromptCommandText: (text: string) => void
    setPromptSubmitText: (text: string) => void
    setPromptMinLength: (length: number) => void
    setPromptMaxLength: (length: number) => void
    openWeb: (url?: string) => void
    openSubliminal: (text?: string) => void
    sendNotification: (text?: string) => void
    connectOnPopupOpen: (callbackId: string) => void
    connectOnPopupClose: (callbackId: string) => void
  },
  callbackStore: CallbackStore
): void {

  lua.lua_newtable(L)

  // ew.open_image({filename, on_close})
  lua.lua_pushliteral(L, 'open_image')
  lua.lua_pushjsfunction(L, (L: LuaState) => {
    const args = interop.tojs(L, 1) as Record<string, unknown>
    const popupId = callbacks.openImage(args?.filename as string)
    if (args?.on_close) {
      const fnRef = lua.lua_toproxy(L, -1)
      callbackStore.mapPopupToCallback(popupId, fnRef)
    }
    lua.lua_pushinteger(L, popupId)
    return 1
  })
  lua.lua_settable(L, -3)

  // ew.after(ms, callback)
  lua.lua_pushliteral(L, 'after')
  lua.lua_pushjsfunction(L, (L: LuaState) => {
    const ms = lua.lua_tointeger(L, 1)
    const fnRef = lua.lua_toproxy(L, 2)
    const id = callbackStore.store(fnRef)
    callbacks.after(ms, id)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.roll(chance)
  lua.lua_pushliteral(L, 'roll')
  lua.lua_pushjsfunction(L, (L: LuaState) => {
    const chance = lua.lua_tointeger(L, 1)
    const result = callbacks.roll(chance)
    lua.lua_pushboolean(L, result)
    return 1
  })
  lua.lua_settable(L, -3)

  // ew.set_active_moods({mood1, mood2, ...})
  lua.lua_pushliteral(L, 'set_active_moods')
  lua.lua_pushjsfunction(L, (L: LuaState) => {
    const moodsArg = interop.tojs(L, 1) as Record<number, string>
    const moods = Object.values(moodsArg).filter(v => typeof v === 'string')
    callbacks.setActiveMoods(moods)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.progress_corruption()
  lua.lua_pushliteral(L, 'progress_corruption')
  lua.lua_pushjsfunction(L, () => {
    callbacks.progressCorruption()
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_wallpaper(filename)
  lua.lua_pushliteral(L, 'set_wallpaper')
  lua.lua_pushjsfunction(L, (L: LuaState) => {
    const filename = lua.lua_tojsstring(L, 1)
    callbacks.setWallpaper(filename)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.panic()
  lua.lua_pushliteral(L, 'panic')
  lua.lua_pushjsfunction(L, () => {
    callbacks.panic()
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.close_popups()
  lua.lua_pushliteral(L, 'close_popups')
  lua.lua_pushjsfunction(L, () => {
    callbacks.closePopups()
    return 0
  })
  lua.lua_settable(L, -3)

  // Register remaining v1 functions similarly...

  lua.lua_setglobal(L, 'ew')
}
```

#### edgeware_v0 module (legacy API, ~60 lines):

The v0 API uses positional arguments instead of tables. Functions are registered as individual globals:

```typescript
// electron/scripting/api_v0.ts
import { lua } from 'fengari'

export function registerEdgewareV0(
  L: LuaState,
  callbacks: EdgewareCallbacks,
  callbackStore: CallbackStore
): void {
  // image(filename) — positional, no table args
  registerGlobal(L, 'image', (L) => {
    const filename = lua_lua_tojsstring(L, 1)
    callbacks.openImage(filename || undefined)
    return 0
  })

  // video(filename)
  registerGlobal(L, 'video', (L) => {
    const filename = lua.lua_tojsstring(L, 1)
    callbacks.openVideo(filename || undefined)
    return 0
  })

  // audio(filename, on_stop)
  registerGlobal(L, 'audio', (L) => {
    const filename = lua.lua_tojsstring(L, 1)
    const fnRef = lua.lua_toproxy(L, 2)
    const id = fnRef ? callbackStore.store(fnRef) : null
    callbacks.playAudio(filename || undefined, id)
    return 0
  })

  // corrupt()
  registerGlobal(L, 'corrupt', () => {
    callbacks.progressCorruption()
    return 0
  })

  // panic()
  registerGlobal(L, 'panic', () => {
    callbacks.panic()
    return 0
  })

  // close_popups()
  registerGlobal(L, 'close_popups', () => {
    callbacks.closePopups()
    return 0
  })

  // after(ms, callback)
  registerGlobal(L, 'after', (L) => {
    const ms = lua.lua_tointeger(L, 1)
    const fnRef = lua.lua_toproxy(L, 2)
    const id = callbackStore.store(fnRef)
    callbacks.after(ms, id)
    return 0
  })

  // roll(chance)
  registerGlobal(L, 'roll', (L) => {
    const chance = lua.lua_tointeger(L, 1)
    const result = callbacks.roll(chance)
    lua.lua_pushboolean(L, result)
    return 1
  })

  // prompt(text, on_close)
  registerGlobal(L, 'prompt', (L) => {
    const text = lua.lua_tojsstring(L, 1)
    const fnRef = lua.lua_toproxy(L, 2)
    const id = fnRef ? callbackStore.store(fnRef) : null
    callbacks.openPrompt(text || undefined, id)
    return 0
  })

  // web(link)
  registerGlobal(L, 'web', (L) => {
    const link = lua.lua_tojsstring(L, 1)
    callbacks.openWeb(link || undefined)
    return 0
  })

  // subliminal(text)
  registerGlobal(L, 'subliminal', (L) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.openSubliminal(text || undefined)
    return 0
  })

  // notification(text)
  registerGlobal(L, 'notification', (L) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.sendNotification(text || undefined)
    return 0
  })

  // set_popup_close_text(text)
  registerGlobal(L, 'set_popup_close_text', (L) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.setPopupCloseText(text)
    return 0
  })
}

function registerGlobal(L: LuaState, name: string, fn: (L: LuaState) => number): void {
  lua.lua_pushjsfunction(L, fn)
  lua.lua_setglobal(L, name)
}
```

#### basic_v1 module (~20 lines):

```typescript
// electron/scripting/api_basic.ts
export function registerBasicV1(L: LuaState): void {
  lua.lua_pushjsfunction(L, (L: LuaState) => {
    const n = lua.lua_gettop(L)
    const parts: string[] = []
    for (let i = 1; i <= n; i++) {
      parts.push(lua.lua_tojsstring(L, i))
    }
    console.log('[Lua]', ...parts)
    return 0
  })
  lua.lua_setglobal(L, 'print')
}
```

### 5.5.5 Callback Handling

The **callback bridge** is the most critical piece. When a Lua script passes a function as `on_close`, `on_stop`, or `connect_on_popup_open`, we need to:

1. **Capture** the Lua function reference using `lua_toproxy`
2. **Store** it in a `Map` on the Node.js side with a numeric ID
3. **Invoke** it later when the corresponding event fires

```typescript
// electron/scripting/callbacks.ts
import { lua } from 'fengari'
import { interop } from 'fengari-interop'

type LuaFunctionProxy = ReturnType<typeof lua.lua_toproxy>

export class CallbackStore {
  private callbacks = new Map<number, LuaFunctionProxy>()
  private popupCallbacks = new Map<number, number>()  // popupId → callbackId
  private nextId = 1

  store(fn: LuaFunctionProxy): number {
    const id = this.nextId++
    this.callbacks.set(id, fn)
    return id
  }

  mapPopupToCallback(popupId: number, fn: LuaFunctionProxy): number {
    const cbId = this.store(fn)
    this.popupCallbacks.set(popupId, cbId)
    return cbId
  }

  invoke(L: LuaState, id: number, ...args: unknown[]): void {
    const fn = this.callbacks.get(id)
    if (!fn) return
    fn(L)
    for (const arg of args) {
      interop.push(L, arg)
    }
    lua.lua_pcall(L, args.length, 0, 0)
  }

  invokeForPopup(L: LuaState, popupId: number): void {
    const cbId = this.popupCallbacks.get(popupId)
    if (!cbId) return
    this.invoke(L, cbId)
    this.popupCallbacks.delete(popupId)
    this.callbacks.delete(cbId)
  }

  release(id: number): void {
    this.callbacks.delete(id)
  }

  clear(): void {
    this.callbacks.clear()
    this.popupCallbacks.clear()
  }
}
```

### 5.5.6 require() Implementation

Fengari provides the `package.preload` mechanism for custom modules. We register our modules there:

```typescript
// Inside initLuaState() after luaL_openlibs:
function registerLuaModule(
  L: LuaState,
  name: string,
  loader: (L: LuaState) => number
): void {
  lua.lua_getglobal(L, 'package')
  lua.lua_getfield(L, -1, 'preload')
  lua.lua_pushliteral(L, name)
  lua.lua_pushcfunction(L, loader)
  lua.lua_settable(L, -3)
  lua.lua_pop(L, 2)
}

// Register the three modules:
registerLuaModule(L, 'edgeware_v1', (L) => {
  registerEdgewareV1(L, apiCallbacks, callbackStore)
  return 1
})
registerLuaModule(L, 'edgeware_v0', (L) => {
  registerEdgewareV0(L, apiCallbacks, callbackStore)
  return 1
})
registerLuaModule(L, 'basic_v1', (L) => {
  registerBasicV1(L)
  return 1
})
```

When a script calls `ew = require("edgeware_v1")`, fengari's `require()` invokes our preload function, which registers all globals and returns the module table.

### 5.5.7 Sandboxing

We strip dangerous Lua globals to prevent script packs from accessing the filesystem or network:

```typescript
function createSandboxedLuaState(): LuaState {
  const L = lauxlib.luaL_newstate()
  lualib.luaL_openlibs(L)

  const removeGlobals = [
    'os', 'io', 'dofile', 'loadfile',
    'rawget', 'rawset', 'rawequal',
    'setmetatable', 'getmetatable', 'debug'
  ]
  for (const name of removeGlobals) {
    lua.lua_pushnil(L)
    lua.lua_setglobal(L, name)
  }

  // Keep require/package for our modules only
  registerEdgewareModules(L, apiCallbacks, callbackStore)
  return L
}
```

This is **more secure** than the original Python interpreter which had no sandboxing.

### 5.5.8 Bridging Lua Features to Electron

| Lua API function | Bridge mechanism |
|---|---|
| `ew.open_image({filename, on_close})` | Returns popup ID → IPC to renderer → `<img>` overlay. Close sends popup ID back → `CallbackStore.invokeForPopup()` |
| `ew.open_video({filename, on_close})` | Same pattern as image popup |
| `ew.play_audio({filename, on_stop})` | Main process plays audio. `on_stop` callback stored via `CallbackStore`, invoked on `ended` event |
| `ew.open_prompt({text, on_close})` | IPC to renderer → Mantine modal → result sent back → Lua callback invoked |
| `ew.after(ms, callback)` | `setTimeout` in main process → `CallbackStore.invoke()` |
| `ew.connect_on_popup_open(cb)` | Store callback → subscribe to Zustand `popupCount` changes via IPC bridge |
| `ew.set_wallpaper(filename)` | `wallpaper.set()` from `electron/ipc/wallpaper.ts` |
| `ew.panic()` | `triggerPanic()` — closes popups, stops audio, resets wallpaper |
| `ew.roll(chance)` | `Math.random() * 100 <= chance` |
| `ew.close_popups()` | IPC to renderer → clear all popups from Zustand store |
| `ew.progress_corruption()` | Zustand `corruptionStore.advanceLevel()` |
| `ew.set_active_moods(moods)` | Zustand `moodStore.setActive()` — Lua table converted via `interop.tojs()` |
| `ew.set_wallpaper(filename)` | Resolve pack-relative path → IPC `wallpaper:set` |

### 5.5.9 Bridge Architecture Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                       │
│                                                                 │
│  ┌─────────────────────┐      ┌────────────────────────────┐  │
│  │  Fengari Lua State   │      │  IPC Handlers              │  │
│  │                      │      │                            │  │
│  │  registerEdgewareV1()│─────→│  apiCallbacks object       │  │
│  │  registerEdgewareV0()│      │  (calls IPC handlers or    │  │
│  │                      │      │   Zustand stores directly) │  │
│  │  executeScript()     │      │                            │  │
│  │                      │      │  wallpaper.ts, tray.ts,     │  │
│  │  callbackStore.invoke│←─────│  keyboard.ts, etc.         │  │
│  │                      │      │                            │  │
│  └─────────────────────┘      └──────────┬─────────────────┘  │
│                                          │ IPC                 │
├──────────────────────────────────────────┼─────────────────────┤
│                     Electron Renderer     │                     │
│                                          ▼                     │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  React App (Zustand stores ↔ Mantine UI ↔ Media)      │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 5.5.10 Script Execution Timing

Scripts execute **once at pack load time**, not continuously:

```
1. Pack loaded from filesystem via IPC
2. If pack.script is not null:
   a. initLuaState() — create fresh fengari state
   b. Register edgeware_v0, edgeware_v1, basic_v1 modules in package.preload
   c. executeScript(script) — runs the entire script
   d. Script runs top-to-bottom, registering event listeners,
      scheduling timers via ew.after(), connecting callbacks
   e. Lua state persists in main process
3. On pack switch:
   a. closeLuaState() — destroys old state
   b. initLuaState() — creates new state with new API modules
   c. executeScript(newPack.script)
```

There is **no continuous Lua execution loop**. The script sets up everything during its initial run, then callbacks and timers drive the interaction. This matches the original Python behavior exactly.

### 5.5.11 File Overview

```
electron/scripting/
├── engine.ts       # initLuaState, closeLuaState, executeScript, sandbox
├── api_v1.ts       # registerEdgewareV1 — pushes ew.* globals
├── api_v0.ts       # registerEdgewareV0 — pushes legacy globals (image, video, etc.)
├── api_basic.ts    # registerBasicV1 — pushes print()
├── callbacks.ts    # CallbackStore — Lua function reference management
└── types.ts        # EdgewareCallbacks interface, LuaError, etc.
```

**Total: ~400 lines** of TypeScript bridge code.

---

## Phase 6 — Testing & QA

### 6.1 Automated testing

- Vitest for store logic, pack parsing, Levenshtein, positioning algorithm
- Vitest for fengari bridge — unit-test each API function via `luaL_loadstring`
- Playwright with Electron for integration tests (launch app, change settings, verify popups appear)

Scripting-specific tests:

```typescript
describe('fengari scripting bridge', () => {
  beforeEach(() => {
    initLuaState()
    registerEdgewareModules(mockApi, mockCallbacks)
  })
  afterEach(() => closeLuaState())

  it('ew.roll returns boolean', () => {
    executeScript('result = ew.roll(100)')
    lua.lua_getglobal(L, 'result')
    expect(lua.lua_toboolean(L, -1)).toBe(true)
    lua.lua_pop(L, 1)
  })

  it('ew.open_image with on_close callback', async () => {
    executeScript(`
      ew.open_image({
        filename = "test.jpg",
        on_close = function() result = "closed" end
      })
    `)
    const popupId = mockApi.lastPopupId
    callbackStore.invokeForPopup(L, popupId)
    lua.lua_getglobal(L, 'result')
    expect(lua.lua_tojsstring(L, -1)).toBe('closed')
    lua.lua_pop(L, 1)
  })

  it('supports edgeware_v0 legacy API', () => {
    executeScript('image("test.jpg")')
    expect(mockApi.openImage).toHaveBeenCalledWith('test.jpg')
  })

  it('handles Lua tables (mood list)', () => {
    executeScript('ew.set_active_moods({"furry", "goon"})')
    expect(mockApi.setActiveMoods).toHaveBeenCalledWith(['furry', 'goon'])
  })
})
```

### 6.2 Cross-platform verification

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Tray icon | ✓ (native) | ✓ (Electron Tray) | ✓ (libappindicator) |
| Global hotkeys | ✓ (globalShortcut) | ✓ (globalShortcut) | ✓ (globalShortcut) |
| Wallpaper | ✓ (user32.dll) | ✓ (osascript) | ✓ (gsettings) |
| Desktop icons | ✓ (.lnk) | ✓ (.app bundle) | ✓ (.desktop file) |
| Drive fill | ✓ (Node fs) | ✓ (Node fs) | ✓ (Node fs) |
| Notifications | ✓ (Electron) | ✓ (Electron) | ✓ (Electron) |
| Video/audio | ✓ (Chromium) | ✓ (Chromium) | ✓ (Chromium) |
| File dialogs | ✓ (Electron) | ✓ (Electron) | ✓ (Electron) |
| Lua scripting | ✓ (fengari) | ✓ (fengari) | ✓ (fengari) |

### 6.3 Bundle

`electron-builder` produces platform-specific installers:

```yaml
# electron-builder.yml
win:
  target: nsis
mac:
  target: dmg
  entitlements: build/entitlements.mac.plist  # needed for globalShortcut
linux:
  target: AppImage
```

On macOS, Electron is already a proper `.app` bundle — no pystray/rumps issues.

---

## Migration Strategy — Current Status

### Completed

```
Phase 0 (scaffold)          ✅
  → Phase 1 (config UI)     ✅
  → Phase 4 (pack loading)  ✅
  → Phase 2 (popups)        ✅ — BrowserWindow approach with movement
  → Phase 3 (OS integration)✅ — Config persistence, keyboard, tray, wallpaper
```

### Remaining

```
Phase 5 (remaining features) — Notifications, Discord, mitosis, web open
Phase 5.5 (fengari scripting) — Engine files exist, need React wiring
Phase 6 (testing) — Need Playwright integration tests, cross-platform verification
```

### What is lost / fundamentally different

| Feature | Original | React+Electron |
|---------|----------|----------------|
| Window embedding (mpv --wid) | Not needed | `<video>` tag, no embedding |
| pynput keyboard listener | Native C module | `node-global-key-listener` or Electron `globalShortcut` |
| pystray | SIGTRAP on macOS | Electron Tray (works) |
| pyglet audio | Background thread | `<audio>` tag |
| afplay subprocess | macOS workaround | Not needed |
| tkinter Toplevel per popup | OS window | BrowserWindow with popup.html |
| mpv subprocess | Broken on macOS | Not needed |
| `winfo_id()` for embedding | macOS-only pointer | Not needed |
| Python multiprocessing | Keyboard listener fork | Node.js worker thread |
| Lua interpreter | 931 lines custom Python | Fengari (full Lua 5.3 VM) + 400-line TS bridge |

### What is better

- **No Python dependency** — single installable package per platform
- **No mpv dependency** — Chromium's built-in media stack
- **No pyglet threading issues** — `<audio>`/`<video>` are sandboxed by Chromium
- **No pystray macOS crash** — Electron Tray API works correctly
- **No subprocess embedding hack** — `<video>` just works
- **GIF looping works** — just set the `loop` attribute
- **Hardware video decoding** — free with Chromium
- **CSS filters** for denial effects instead of mpv shaders
- **Mantine theming** — far more flexible than tkinter Label+pack
- **TypeScript** — catch config/state shape errors at compile time
- **React DevTools** — debug popup state, component tree
- **Auto-updates** — `electron-updater` for seamless version updates
- **Installers** — `.dmg` / `.exe` / `.AppImage` with one config file
- **Full Lua 5.3 scripting** — fengari supports tables, closures, metatables natively
- **Sandboxed scripting** — we strip dangerous globals from the fengari state
- **Persistent directional movement** — popups bounce off screen edges
- **Per-type popup limits** — separate `maxImages` and `maxVideos` caps
- **Hypno overlay system** — gif-only overlays on static images, configurable opacity
