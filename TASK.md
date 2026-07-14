# TASK — Web Open (shell.openExternal)

**Priority:** Next session highest priority
**Status:** Not started

## Goal

Wire `shell.openExternal()` via IPC so the renderer can open URLs in the default browser.

## Steps

1. **Create IPC handler** — Add `web:openExternal` handler in `electron/ipc/web.ts` that calls `shell.openExternal(url)`
2. **Register handler** — Import and register the new IPC handler in `electron/main.ts`
3. **Expose in preload** — Add `openExternal(url: string)` to `electron/preload.ts` via `contextBridge`
4. **Add type declaration** — Extend `window.electronAPI` in `src/types/global.d.ts`
5. **Verify** — Run `npm run check` and `npm run lint`
6. **Commit** — `feat: wire shell.openExternal via IPC for web links`
7. **Update HANDOVER.md** — Move web open from "What's NOT Done" to "What's Working"
