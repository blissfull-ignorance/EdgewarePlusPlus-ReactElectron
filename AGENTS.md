# Project Name

EdgewarePlusPlus-cross platform. The goal of this project is to take the existing EdgewarePlusPlus project and port it to be MacOS compatible while retaining the previous Windows and Linux compatibility.

## Tech Stack

- **Renderer:** React 19, Mantine 7, Vite 6, TypeScript 5.7
- **Main Process:** Electron 33, Node.js
- **State:** Zustand 5
- **Scripting:** Fengari (Lua 5.3 VM in JS)
- **Testing:** Vitest

## Git

- Commit frequently. Keep commit messages short and descriptive of the changes.
- Use conventional commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Branch: `macos-cross-platform`

## Verification

Run these before committing:

```bash
npm run check       # TypeScript type checking (tsc --noEmit)
npm run lint        # ESLint
npm run test        # Vitest (54 tests across 5 test files)
```

All three must pass with zero errors.

## Code Style

- No comments unless explicitly requested
- Use FUTUREWORK/DISCUSSION/REMOVABLE/FIXME markers for code annotations
- Follow existing patterns in neighboring files
- Prefer editing existing files over creating new ones
- Zustand stores for state, React hooks for side effects
- Pure functions in `src/features/popup/movement.ts` for testability

## Key Directories

```
electron/           # Electron main process (Node.js)
  ipc/              # IPC handlers (config, pack, popup, keyboard, tray, etc.)
  scripting/        # Fengari Lua VM bridge
src/                # React app (renderer)
  stores/           # Zustand stores (10 stores)
  features/         # Feature modules (config, popup, prompt, hibernate)
  components/       # Shared UI components
  types/            # TypeScript type definitions
  hooks/            # Custom React hooks
```
