# Edgeware++

A cross-platform desktop app for running immersive media packs: timed image,
video, audio and text popups, hypno overlays, corruption and hibernate modes,
and Lua-driven scripting — built with React, Vite and Electron for
macOS, Windows and Linux.

## From Python to a cross-platform desktop app

Edgeware++ began as a Python/Tkinter application for Windows with community
shims for Linux and macOS. The GUI toolkit, the mpv/ANGLE video pipeline and
the packaging story each needed per-platform surgery, and every new platform
multiplied the maintenance surface.

This repository is the rewrite of that application on a single rendering
stack: an Electron shell around a React renderer. One codebase now covers all
three platforms, including the parts that were hardest to port natively —
transparent always-on-top popup windows, global panic hotkeys, wallpaper
control, system tray and an embedded Lua VM. Media plays through Chromium's
own pipeline, so hypno overlays and video popups behave identically
everywhere. The original Python implementation is kept in
[`legacy-python/`](legacy-python/) as a behavioral reference.

## Features

- **Popups** — images, videos, audio and prompt popups spawn on configurable
  timers, with movement, scaling, overlap avoidance, auto-close, per-type
  limits and pack-defined close labels.
- **Subliminal text pops** — short pack phrases flashed centered on screen
  with configurable chance, duration and opacity.
- **Hypno overlays** — animated GIF spirals composited over image and video
  pops, clipped to the media frame.
- **Corruption mode** — escalating level progression (timed, popup-count,
  launch-count or script driven) with mood cycling, per-level config
  overrides behind explicit permission gates, and a start-up warning listing
  every dangerous setting the pack can flip.
- **Hibernate mode** — scheduled activity loops with several pacing styles.
- **Panic** — a global hotkey (Escape by default) and a tray entry tear
  everything down instantly, set the panic wallpaper and exit; an optional
  timed lockout gates panic behind your safeword.
- **Media blacklist** — Alt+click a popup's close control to move that file
  into the blacklist so it never spawns again.
- **Scripting** — packs can ship `script.lua`, executed in a sandboxed Lua
  VM (Fengari) that drives the app through a versioned API.
- **System integration** — tray icon, wallpaper rotation, desktop
  notifications, Discord rich presence, run-at-startup, optional Booru
  image downloading.

## Installing a release

Download the artifact for your platform from the
[releases page](https://github.com/blissfull-ignorance/EdgewarePlusPlus-ReactElectron/releases):

| Platform | Artifact |
|---|---|
| macOS (Apple Silicon / Intel) | `*-mac-*.dmg` (or `.zip`) |
| Windows | `*-win-*.exe` (NSIS installer) |
| Linux | `*-linux-*.AppImage` (or `.deb`) |

Unsigned builds: macOS shows a Gatekeeper prompt (right-click → Open the
first time) and Windows SmartScreen an "More info → Run anyway" step.

Place content packs (directories or zips) in the `packs/` folder of the app's
user-data directory, or import them from the config window:

- macOS: `~/Library/Application Support/Edgeware++/`
- Windows: `%APPDATA%/Edgeware++/`
- Linux: `~/.config/Edgeware++/`

## Running from source

Requires Node.js 20+.

```bash
npm ci
npm run electron:dev   # run the app in development mode
```

## Development

```bash
npm run check          # TypeScript type checking
npm run lint           # ESLint
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright end-to-end tests (browser + real Electron)
npm run build          # type-check, bundle, and package with electron-builder
```

The end-to-end suite runs in two layers: a browser layer against a mocked
bridge for UI logic, and an Electron layer that launches the real app with
the real main process, preload bridge and filesystem. Anything crossing the
IPC boundary is verified in the Electron layer.

Release artifacts (dmg / zip / nsis / AppImage / deb) are written to
`release/`; `.github/workflows/release.yml` builds all platforms on a `v*`
tag and attaches the artifacts to the GitHub release.

## License

Edgeware++ is licensed under the terms in `COPYING` (GPL-3.0) with the MIT
grant in `COPYING.MIT`. See `legacy-python/` for the original implementation.
