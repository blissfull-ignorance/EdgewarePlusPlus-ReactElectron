# Edgeware++

A cross-platform desktop app for running immersive media packs: timed image,
video, audio and text popups, hypno overlays, corruption and hibernate modes,
and Lua-driven scripting — built with React, Vite and Electron.

This is the cross-platform rewrite of the original Python Edgeware++. The
legacy Python sources are kept in [`legacy-python/`](legacy-python/) as a
behavioral reference.

## Features

- **Popups** — images, videos, audio and text spawn on configurable timers,
  with movement, scaling, overlap avoidance, auto-close and per-type limits.
- **Hypno overlays** — animated GIF overlays applied to popup media.
- **Corruption mode** — escalating level progression with mood cycling and
  per-level config overrides.
- **Hibernate mode** — scheduled activity loops with several pacing styles.
- **Panic mode** — global shortcut and tray action tear everything down
  instantly, with optional timed safeword lockout.
- **Scripting** — packs can ship `script.lua`, executed in a sandboxed Lua
  VM (Fengari) that drives the app through a versioned API.
- **System integration** — tray icon, wallpaper rotation, desktop
  notifications, Discord rich presence, autostart.

## Getting started

Requires Node.js 20+.

```bash
npm ci
npm run electron:dev   # run the app in development mode
```

Place content packs (directories or zips) in the `packs/` folder next to the
app, or import them from the config window.

## Development

```bash
npm run check          # TypeScript type checking
npm run lint           # ESLint
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright end-to-end tests (browser + Electron)
npm run build          # type-check, bundle, and package with electron-builder
```

Release artifacts (dmg / nsis / AppImage) are written to `release/`.

## License

Edgeware++ is licensed under the terms in `COPYING` (GPL-3.0) with the MIT
grant in `COPYING.MIT`. See `legacy-python/` for the original implementation.
