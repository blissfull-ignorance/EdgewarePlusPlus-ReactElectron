# TASK.md — Highest Priority Task

## Task: Fix Save Configuration Button (IPC Clone Error)

**Priority:** BUGFIX (Highest)
**Date:** July 16, 2026

### Problem

Clicking "Save Configuration" in the Config Panel throws:
```
ConfigPanel.tsx:68 Uncaught (in promise) Error: An object could not be cloned.
```

### Root Cause

`handleSave` in `ConfigPanel.tsx:67` passes the entire Zustand store state to `electronAPI.saveConfig(config)`. This state includes the `updateConfig` function, which is not serializable by Electron's structured clone algorithm (used by IPC).

### Fix

In `ConfigPanel.tsx`, destructure to extract only the config data (excluding `updateConfig`) before sending it over IPC.

```typescript
const handleSave = useCallback(async () => {
  if (!electronAPI) return
  const { updateConfig: _fn, ...configData } = config
  await electronAPI.saveConfig(configData as Config)
}, [electronAPI, config])
```

### Steps

1. Read `ConfigPanel.tsx` and confirm `handleSave` passes full store state (including `updateConfig`).
2. Edit `handleSave` to destructure out `updateConfig` and pass only the data portion to `electronAPI.saveConfig()`.
3. Verify the `Config` type from `@/types/pack` matches what's being sent (add `maxImages` if missing).
4. Run `npm run check` — zero TypeScript errors.
5. Run `npm run lint` — zero ESLint errors.
6. Run `npm run test` — all tests pass.
7. Run `npm run electron:dev`, open Config Panel, click Save Configuration, and verify no error occurs and `config.json` is written to `userData/`.
8. Improve comments/documentation where appropriate.
9. Commit all changes with a meaningful commit message.
10. Update HANDOVER.md to describe the current project state and recommend the next highest-priority task.
