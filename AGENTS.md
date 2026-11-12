# Edgeware++

Cross-platform desktop app: a React + Vite + Electron port of the original
Python Edgeware++, with exportable releases for macOS, Windows and Linux.
The legacy Python sources remain on `main` / `macos-python` as reference.

## Tech Stack

- **Renderer:** React 19, Mantine 7, Vite, TypeScript
- **Main process:** Electron, Node.js
- **State:** Zustand
- **Scripting:** Fengari (Lua 5.3 VM in JS)
- **Testing:** Vitest (unit) + Playwright (browser e2e and real-Electron e2e)
- **Releases:** electron-builder (dmg / nsis / AppImage)

## Git

- Conventional commit prefixes: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`.
- Commit messages describe the change by its effect on the product, never by
  session context.
- Never commit `work/` — it is a local-only workspace.

## No-Diff Rule

Shipped code is clean deployment code.

- Comments describe what the code **is** and **does** — never what was
  changed, who requested it, or which task or session touched it.
- No changelog comments, no development-process markers, no references to
  plans, tasks, users, or history inside source files.
- Prefer no comment over a narrating comment. Public APIs and non-obvious
  invariants may be documented; everything else stays silent.
- No stubs, no TODO placeholders, no commented-out blocks in committed code.
  Unfinished work is not committed as done.

## Verification

Run the full gate before committing; all commands must pass with zero errors:

```bash
npm run check       # tsc --noEmit
npm run lint        # ESLint, max-warnings 0
npm run test        # Vitest unit suite
npm run test:e2e    # Playwright: browser layer + real-Electron layer
```

During iteration, run the slice that matches the change instead of the full
suites; the full gate still decides. The e2e groups partition every spec, so
one group per touched area plus the unit suite is fast and sufficient:

```bash
npm run test:e2e:creator     # creator tools, designer, moods (also :corruption :popup :pack :runtime)
npm run test:e2e:browser     # browser layer only  (or :electron)
npm run test:unit:creator    # unit slice (also :corruption :popup :pack)
npx vitest run <filter>      # any unit substring; npx playwright test <file|regex>
```

Never run two Playwright invocations concurrently — they share the dev server
and Electron launches, and the contention produces flakes.

## Development Workflow

- Work proceeds in numbered steps under `work/<NN-slug>/` (local only). Each
  step has a `TASK.md` outcome contract: observed reality, required outcome,
  behavioral requirements, constraints, mechanically verifiable acceptance
  criteria. Evidence lands in the step folder.
- Tests are written from acceptance criteria before implementing, and must
  fail against a no-op implementation of the behavior they claim.
- Any behavior crossing the renderer/main IPC boundary requires at least one
  real-Electron test (real main process, real preload, real filesystem).
  Mocked-bridge browser tests prove UI logic only.
- Test doubles mirror the real code they stand in for, verified by reading
  that code — never written from a plan's prose.
- A step is done only when: criteria met with evidence, full gate green, the
  real app launched and the outcome observed directly, and an independent
  reviewer pass returns APPROVE.

## Key Directories

```
electron/           # Main process: window management, IPC handlers, Lua VM
  ipc/              # IPC handler modules (config, pack, popup, system, ...)
src/                # Renderer app
  stores/           # Zustand stores
  features/         # Feature modules (popup, corruption, hibernate, ...)
  components/       # Shared UI components
  types/            # Shared TypeScript types
tests/              # vitest/ (unit), e2e/ (Playwright, both layers)
legacy-python/      # Original Python app, reference only
```
