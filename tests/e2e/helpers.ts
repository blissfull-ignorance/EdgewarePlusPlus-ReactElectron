/**
 * @file E2E test helpers — app launch with Electron IPC mocks and real pack data.
 *
 * These tests run against the Vite dev server in Chromium (see
 * playwright.config.ts). The renderer's built-in `window.api` stub
 * (src/index.tsx) only activates when no bridge exists, so tests can inject
 * a fuller Electron IPC mock via `page.addInitScript` before the app loads.
 *
 * `listRealPacks` mirrors the `system:listPacks` handler in
 * electron/ipc/system.ts so tests operate on the actual packs in `packs/`,
 * falling back to the committed seed pack in `tests/e2e/fixtures/` when
 * the gitignored `packs/` directory is absent (clean checkout / CI).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Shape returned by `system:listPacks` (see src/types/ipc.d.ts). */
export interface PackListing {
  name: string;
  path: string;
  version?: string;
  creator?: string;
}

export const PACKS_DIR = resolve(__dirname, "../../packs");

/** Committed fallback fixtures used when the gitignored `packs/` directory is absent (clean checkout / CI). */
export const FIXTURE_PACKS_DIR = resolve(__dirname, "fixtures");

/** 0.5s black VP8 webm (64x64) — a cheap popup video the browser can actually load. */
export const TEST_VIDEO = "data:video/webm;base64," +
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAMcEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEyTbuMU6uEHFO7a1OsggMG7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjMuMS4xMDFXQYxMYXZmNjMuMS4xMDFEiYhAgEAAAAAAABZUrmvXrgEAAAAAAABO14EBc8WItwta8foE9RCcgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4QCYloA4JCwgUC6gUCagQJVsIRVuYEBVe6BAOwBAAAAAAAAAgAAElTDZ/pzc59jwIBnyJlFo4dFTkNPREVSRIeMTGF2ZjYzLjEuMTAxc3PVY8CLY8WItwta8foE9RBnyKBFo4dFTkNPREVSRIeTTGF2YzYzLjEuMTAxIGxpYnZweGfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDAuNTIwMDAwMDAwAB9DtnVBT+eBAKOqgQAAgPACAJ0BKkAAQAAARwiFhYiFhIgCAgAGcDxCYAqyIPcwAP7/q1CAo5aBACgA0QEAARAQABgAGFgv9AAIjoAAo5aBAFAA0QEAARAQABgAGFgv9AAIjoAAo5aBAHgA0QEAARAQABgAGFgv9AAIjoAAo5aBAKAA0QEAARAQABgAGFgv9AAIjoAAo5aBAMgA0QEAARAQABgAGFgv9AAIjoAAo5aBAPAA0QEAARAQABgAGFgv9AAIjoAAo5aBARgA0QEAARAQFGAAYWC/0AAiOgAAo5aBAUAA0QEAARAQABgAGFgv9AAIjoAAo5aBAWgA0QEAARAQABgAGFgv9AAIjoAAo5aBAZAA0QEAARAQABgAGFgv9AAIjoAAo5aBAbgA0QEAARAQABgAGFgv9AAIjoAAo5aBAeAA0QEAARAQABgAGFgv9AAIjoAAHFO7a5G7j7OBALeK94EB8YIBsfCBAw==";

/** 10x10 red SVG data URI used as cheap popup media in E2E. */
export const TEST_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='red'/></svg>"
  );

/**
 * Options for {@link launchApp}.
 */
export interface LaunchOptions {
  /** Packs returned by `system:listPacks`. Pass `listRealPacks()` for real pack data. */
  packs?: PackListing[];
  /** Settings returned by `system:loadSettings` on first load (no saved file yet). */
  settings?: Record<string, unknown>;
  /** Keep the saved settings in localStorage so `system:loadSettings` returns them after reload. */
  persistSettings?: boolean;
  /** Simulated disk latency (ms) added to `system:saveSettings`. */
  saveDelayMs?: number;
  /** Media returned by `pack:randomImage`; `null` disables image popups. */
  image?: string | null;
  /** Corruption config returned by `pack:loadCorruption`. */
  corruption?: Record<string, unknown>;
  /** Make `corruption:getCurrentLevel` / `getNextLevelTime` reject. */
  corruptionIpcFails?: boolean;
}

/** Read every pack directory under `dir` the same way `system:listPacks` does. */
function readPackDir(dir: string): PackListing[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const packPath = join(dir, entry.name);
      const infoPath = join(packPath, "info.json");
      try {
        if (existsSync(infoPath)) {
          const info = JSON.parse(readFileSync(infoPath, "utf-8"));
          return {
            name: info.name || entry.name,
            path: packPath,
            version: info.version,
            creator: info.creator,
          };
        }
      } catch {
        // Fall through to directory-name listing, same as the IPC handler
      }
      return { name: entry.name, path: packPath };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * List the packs to test against: the real packs in the repository `packs/`
 * directory when present, otherwise the committed seed pack under
 * `tests/e2e/fixtures/` so the suite stays reproducible on clean checkouts.
 * Sorted by directory name so the first auto-selected pack is deterministic.
 */
export function listRealPacks(): PackListing[] {
  const real = readPackDir(PACKS_DIR);
  return real.length > 0 ? real : readPackDir(FIXTURE_PACKS_DIR);
}

/** Find a real pack by its directory name or its `info.json` name. */
export function findPack(packs: PackListing[], nameOrDir: string): PackListing {
  const pack = packs.find((p) => p.name === nameOrDir || p.path.endsWith(`/${nameOrDir}`));
  if (!pack) throw new Error(`Pack "${nameOrDir}" not found in ${PACKS_DIR}`);
  return pack;
}

/** Parse `rgb(r, g, b)` / `rgba(r, g, b, a)` into channel values. */
export function parseRGB(color: string): { r: number; g: number; b: number } {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) throw new Error(`Unrecognized color value: ${color}`);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

/** Read the `popup-count` metadata panel value ("Active: N" → N). */
export async function getPopupCount(page: Page): Promise<number> {
  const text = (await page.locator("[data-testid='popup-count']").textContent()) ?? "Active: 0";
  const match = text.match(/Active:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Install the Electron IPC mock (when options are given) and load the app.
 * Resolves once the main window has rendered (metadata panel visible).
 */
export async function launchApp(page: Page, options: LaunchOptions = {}): Promise<Page> {
  if (Object.keys(options).length > 0) {
    await page.addInitScript((opts: LaunchOptions) => {
      const w = window as unknown as {
        api?: unknown;
        __e2eSaveCalls?: number;
        __e2eLastSaved?: Record<string, unknown> | null;
        __e2eBaselines?: Record<string, unknown>[];
        __e2eRevertCalls?: number;
      };
      w.api = {
        pack: {
          loadInfo: async () => null,
          loadIndex: async () => null,
          listFiles: async () => [],
          randomImage: async () => (opts.image === undefined ? null : opts.image),
          randomAudio: async () => null,
          randomVideo: async () => null,
          closeLabel: async () => null,
          randomPrompt: async () => null,
          randomWeb: async () => null,
          randomHypnoGif: async () => null,
          randomSubliminalText: async () => null,
          randomNotificationText: async () => null,
          splashImage: async () => null,
          iconImage: async () => null,
          setActiveMoods: async () => undefined,
          listMoods: async () => [],
          loadPackConfig: async () => null,
          hasScript: async () => false,
          setRuntimePack: async () => undefined,
          listGallery: async () => ({ entries: [], moods: [], activeMoods: [], favourites: [], rootImages: [] }),
          setFavourite: async () => [],
          refreshAppIcon: async () => undefined,
          getEditableIndex: async () => null,
          setFileTags: async () => null,
          deleteFile: async () => ({ ok: false, error: "stub" }),
          addMood: async () => null,
          removeMood: async () => null,
          renameMood: async () => null,
          blacklist: async () => ({ ok: true }),
          loadCorruption: async () => opts.corruption ?? null,
          discord: async () => null,
        },
        corruption: {
          getCurrentLevel: async () => {
            if (opts.corruptionIpcFails) throw new Error("IPC down");
            return 0;
          },
          getNextLevelTime: async () => {
            if (opts.corruptionIpcFails) throw new Error("IPC down");
            return null;
          },
          applyLevelChanges: async () => undefined,
          setLevel: async () => undefined,
          persistBaseline: async (baseline: Record<string, unknown>) => {
            w.__e2eBaselines = w.__e2eBaselines ?? [];
            w.__e2eBaselines.push(baseline);
            return true;
          },
          revertBaseline: async () => {
            w.__e2eRevertCalls = (w.__e2eRevertCalls ?? 0) + 1;
            return 0;
          },
          onInject: () => () => {},
          onApplyChanges: () => () => {},
        },
        wallpaper: {
          restoreOriginal: async () => false,
        },
  panic: {
          trigger: async () => ({ ok: true }),
          status: async () => ({ lockoutActive: false, accelerator: "Escape" }),
          unlock: async () => ({ ok: true }),
          refreshShortcut: async () => ({ lockoutActive: false, accelerator: "Escape" }),
          onBlocked: () => () => {},
        },
        popup: {
          create: async (_type: string, _mediaId: string) => ({ id: `popup-${Date.now()}` }),
          closePopup: async () => undefined,
          closeAll: async () => undefined,
          sizeToMedia: async () => ({ width: 400, height: 300 }),
          startMoving: async () => true,
          dragBegin: async () => true,
          dragMove: async () => true,
          dragEnd: async () => true,
          onClosed: () => () => {},
        },
        hibernate: {
          start: async () => undefined,
          stop: async () => undefined,
        },
        scripting: {
          runLua: async () => false,
          runSelfTest: async () => ({ ok: false, error: 'mock bridge' }),
          stop: async () => true,
          advanceLevel: async () => 1,
          convertScript: async () => null,
          readScript: async () => null,
          writeScript: async () => false,
          writePackDesign: async () => ({ ok: false, backups: [] }),
          injectCorruptionLevel: async () => false,
        },
        system: {
          setWallpaper: async () => undefined,
          quit: async () => undefined,
          createDesktopIcons: async () => undefined,
          createTray: async () => true,
          toggleRunAtStartup: async () => undefined,
          setDiscordPresence: async () => undefined,
          corruptionLaunches: async () => 0,
          listPacks: async () => opts.packs ?? [],
          importPack: async (filepath: string) => ({
            path: filepath,
            name: filepath.split("/").pop() ?? "Imported Pack",
          }),
          selectZip: async () => ({ cancelled: true, filePaths: [] }),
          selectPackFolder: async () => ({ cancelled: true }),
          validatePackFolder: async () => ({
            ok: false,
            error: "Pack folders can only be added inside the Electron app.",
          }),
          openPackLibrary: async () => undefined,
          openExternal: async () => true,
          onImportProgress: () => () => undefined,
          getPathForFile: () => null,
          loadSettings: async () => {
            if (opts.persistSettings) {
              const raw = localStorage.getItem("__e2e_settings_file__");
              if (raw) return JSON.parse(raw) as Record<string, unknown>;
            }
            // The startup splash is verified in the Electron layer; browser
            // specs start straight on the app UI.
            return { showLoadingFlair: 0, ...(opts.settings ?? {}) };
          },
          saveSettings: async (settings: Record<string, unknown>) => {
            w.__e2eSaveCalls = (w.__e2eSaveCalls ?? 0) + 1;
            w.__e2eLastSaved = settings;
            if (opts.saveDelayMs) await new Promise((r) => setTimeout(r, opts.saveDelayMs));
            if (opts.persistSettings)
              localStorage.setItem("__e2e_settings_file__", JSON.stringify(settings));
          },
          flushSettings: (settings: Record<string, unknown>) => {
            w.__e2eSaveCalls = (w.__e2eSaveCalls ?? 0) + 1;
            w.__e2eLastSaved = settings;
            if (opts.persistSettings)
              localStorage.setItem("__e2e_settings_file__", JSON.stringify(settings));
            return true;
          },
          sendNotification: async () => undefined,
        },
      };
    }, options);
  }

  await page.goto("/");
  await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
  return page;
}
