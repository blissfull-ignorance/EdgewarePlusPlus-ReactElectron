# Edgeware++ React App Migration — HANDOVER

## Current Status

**Last Session:** Phase 1 (Core UI Shell) — React entry, splash, config panel, popup overlays

**Date:** July 7, 2026 (Session 2)

### Completed Tasks

#### ✅ Project Scaffolding (Phase 0.1)
- Created project directory structure matching REACT-APP.md spec
- Set up `electron/`, `src/` directories with proper subdirectories
- Initialized `package.json` with all required dependencies

#### ✅ Dependencies (Phase 0.2)
- Installed: React 19, Mantine 7, Zustand 5, Fengari, Electron 33, Vite 6
- Dev dependencies: TypeScript, ESLint, Electron Builder
- Note: 10 high severity vulnerabilities detected (npm audit)

#### ✅ Configuration Files
- `tsconfig.json` — TypeScript configuration with path aliases (updated to include `.d.ts`)
- `vite.config.ts` — Vite configuration
- `vite.config.electron.ts` — Electron builder configuration
- `eslint.config.js` — ESLint flat config (migrated from .eslintrc.json for v10 compat)
- `.gitignore` — Excludes node_modules, dist, config files

#### ✅ Store Architecture (Zustand)
All store files created in `src/stores/`:
- `configStore.ts` — Configuration state management
- `popupStore.ts` — Popup state and management
- `corruptionStore.ts` — Corruption level and mood tracking
- `packStore.ts` — Pack loading and media management (fixed `get()` parameter)
- `hibernateStore.ts` — Hibernate mode state
- `promptStore.ts` — Prompt interaction state
- `appStore.ts` — Application-level state (splash, panic)
- `moodStore.ts` — Available/active moods
- `themeStore.ts` — Theme variables and corruption effects (FIXED — was broken circular export)

#### ✅ Type Definitions
- `src/types/pack.ts` — Pack interface definitions
- `src/types/popup.ts` — Popup interface definitions
- `src/types/global.d.ts` — `window.electronAPI` type declarations
- `src/types/fengari.d.ts` — Fengari module type declarations

#### ✅ Electron Main Process (Phase 3)
- `electron/main.ts` — Electron main process with window/tray creation (wired IPC handlers to actual implementations, fixed import issues)

#### ✅ Preload & IPC Bridge
- `electron/preload.ts` — IPC bridge API exposed to renderer with proper type imports
- `electron/types.ts` — TypeScript type definitions for IPC

#### ✅ IPC Handlers (Phase 3.2-3.7) — All fixed to compile cleanly
- `electron/ipc/wallpaper.ts` — Cross-platform wallpaper setting (fixed async return types)
- `electron/ipc/tray.ts` — System tray management (fixed `mainWindow` parameter, `nativeImage` type)
- `electron/ipc/keyboard.ts` — Global shortcuts registration
- `electron/ipc/filesystem.ts` — Drive filling and image replacement (fixed unused var)
- `electron/ipc/popup.ts` — BrowserWindow popup management (added missing `path` import)
- `electron/ipc/shortcut.ts` — Desktop shortcut creation (fixed API usage)

#### ✅ Fengari Lua Scripting Engine (Phase 5.5) — All files fixed to compile
- `electron/scripting/engine.ts` — Lua state lifecycle management
- `electron/scripting/callbacks.ts` — Callback bridge between Lua and JS
- `electron/scripting/api_v0.ts` — Legacy v0 API bridge (fixed import paths, unused imports)
- `electron/scripting/api_v1.ts` — Modern v1 API bridge (fixed import paths, unused vars)
- `electron/scripting/api_basic.ts` — Basic functions (print)

#### ✅ Phase 1 — Core UI Shell (NEW — this session)
- `src/main.tsx` — React entry point with MantineProvider + HashRouter
- `src/App.tsx` — Main app with splash→config flow, routing, panic mode, IPC binding
- `src/theme.ts` — Mantine theme configuration with corruption CSS variables
- `src/components/SplashScreen.tsx` — Startup splash animation (fade out)
- `src/components/PopupContainer.tsx` — In-app overlay renderer (routes to correct popup type)
- `src/features/config/ConfigPanel.tsx` — Full settings UI with tabs (General, Popups, System, Theme, Pack, Hibernate), all controls mapped to Mantine components
- `src/features/popup/ImagePopup.tsx` — Static/GIF image popup with multi-click support
- `src/features/popup/VideoPopup.tsx` — HTML5 video popup with auto-play, loop, multi-click
- `src/features/popup/AudioPopup.tsx` — HTML5 audio popup with auto-play, auto-close on end
- `src/features/popup/SubliminalPopup.tsx` — Low-opacity timed text overlay (clickthrough)
- `src/features/prompt/PromptModal.tsx` — Mantine modal prompt with Levenshtein distance validation
- `src/features/hibernate/HibernatePanel.tsx` — Hibernate activation panel with type selection
- `src/hooks/useElectronAPI.ts` — Typed access to `window.electronAPI`
- `index.html` — Entry HTML with CSP headers for file:// media access

### Incomplete / Remaining Work

#### ⏳ Popup Positioning Algorithm (Phase 2)
- `computePosition()` function placing popups on screen avoiding overlaps (NOT STARTED)
- Popup size randomization from pack config (NOT STARTED)

#### ⏳ Pack System (Phase 4)
- Pack loading implementation (NOT STARTED)
- `index.json` parsing (NOT STARTED)
- Media file loading via IPC (NOT STARTED)
- Corruption config parsing (NOT STARTED)

#### ⏳ Feature Implementation (Phase 5)
- Notifications (NOT STARTED)
- Discord presence (NOT STARTED)
- Mitosis mode logic (NOT STARTED)
- Web open functionality (NOT STARTED)
- Moving popups (NOT STARTED)
- Lowkey mode (NOT STARTED)
- Startup splash custom image/video (NOT STARTED)

#### ⏳ Electron Main Process Enhancements
- `config:load` / `config:save` — Read/write `config.json` (TODO stubs remain)
- `drive:replace` — Source images array needs populating from pack
- Panic shortcut registration from config (globalShortcut not wired yet)
- Tray icon assets (missing from repo)

#### ⏳ Fengari ↔ React Bridge (Phase 5.5)
- Lua callbacks need to invoke React state changes via IPC
- `electron/scripting/` engine needs to be initialized on pack load
- Media file URL handling with `file://` protocol registration

#### ⏳ Testing & QA (Phase 6)
- Vitest setup for store logic (NOT STARTED)
- Playwright integration tests (NOT STARTED)
- Cross-platform verification matrix (NOT STARTED)
- Bundle testing with electron-builder (NOT STARTED)

### Known Issues & Decisions

1. **Popup Strategy**: In-app overlays implemented in `src/components/PopupContainer.tsx` and per-popup-type components. BrowserWindow approach also ready in `electron/ipc/popup.ts` for future use.

2. **Fengari Integration**: Lua bridge compiles cleanly but needs:
   - IPC callbacks to React state (connect engine to renderer)
   - Media file URL handling (file:// protocol registration)
   - Lua state lifecycle tied to pack load/unload

3. **Theme System**: MantineProvider integrated with custom theme in `src/theme.ts`. Corruption CSS variables in `themeStore.ts` ready for dynamic injection.

4. **Missing Assets**: No tray icon assets created yet

5. **Config Persistence**: `config:load`/`config:save` IPC handlers in `electron/main.ts` are stubs that return `{}` — need to implement file I/O

6. **Lint Config**: Migrated from `.eslintrc.json` to `eslint.config.js` (flat config) for ESLint v10 compatibility. The old `.eslintrc.json` is no longer used but kept for reference.

### Next Session Priority Order

1. **CRITICAL**: Implement config persistence (`config:load` / `config:save` in main process)
2. **CRITICAL**: Implement pack loading system with IPC (scan directory, parse `index.json`)
3. **HIGH**: Popup positioning algorithm (grid-based overlap avoidance)
4. **HIGH**: Wire panic shortcut from config (globalShortcut)
5. **MEDIUM**: Hook up Fengari callbacks to React state via IPC
6. **MEDIUM**: Implement remaining features (notifications, moving popups, mitigation)
7. **LOW**: Testing (Vitest for stores, Playwright for integration)

### Quick Reference

**Build Commands:**
```bash
npm run dev              # Vite dev server
npm run electron:dev     # Dev with Electron
npm run build            # Build React app
npm run electron:build   # Build Electron app
npm run lint             # Run ESLint (flat config)
npm run check            # TypeScript check (tsc --noEmit)
```

**Project Structure:**
```
EdgewarePlusPlus/
├── electron/              # Electron main/preload code
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/              # IPC handlers (✓ all compile)
│   └── scripting/        # Fengari Lua engine (✓ all compile)
├── src/                  # React app (✓ Phase 1 complete)
│   ├── stores/           # Zustand stores (✓ all 9 stores)
│   ├── types/            # TypeScript types (✓ pack, popup, global, fengari)
│   ├── components/       # UI components (✓ SplashScreen, PopupContainer)
│   ├── features/         # Feature components (✓ config, popups, prompt, hibernate)
│   ├── hooks/            # Custom hooks (✓ useElectronAPI)
│   ├── App.tsx           # Main component (✓ routing, panic, IPC binding)
│   ├── main.tsx          # React entry (✓ MantineProvider + HashRouter)
│   └── theme.ts          # Mantine theme (✓ corruption CSS vars, denial filters)
├── index.html            # Vite entry (✓ with CSP headers)
├── eslint.config.js      # ESLint flat config (v10 compatible)
├── package.json          # Dependencies
├── tsconfig.json         # TS config
└── vite.config.ts        # Vite config
```

### Important Notes

- All stores use Zustand (lightweight, works well with React + Electron)
- Fengari runs in Electron main process (Node.js), not renderer
- IPC is the bridge between Electron main and renderer
- Media playback uses native HTML5 `<video>` and `<audio>` elements
- Theme corruption affects CSS variables injected into Mantine theme
- `tsc --noEmit` and `eslint` both pass with zero errors
- `electron/ipc/` handlers are wired to `main.ts` but `config:load/save` remain stubs
- React app uses HashRouter for Electron file:// compatibility

### Files to Review Before Next Session

1. `REACT-APP.md` — Complete migration plan (1245 lines)
2. `src/App.tsx` — Main React component entry and flow
3. `src/features/config/ConfigPanel.tsx` — Settings UI implementation
4. `src/components/PopupContainer.tsx` — In-app overlay popup dispatch
5. `electron/ipc/filesystem.ts` — Config read/write basis
6. `electron/main.ts` — IPC handler wiring (config stubs need implementing)

---

**End of HANDOVER.md**
