import { _electron, expect, type ElectronApplication, type Page } from "@playwright/test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import electronExecutable from "electron";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DIST_MAIN = path.join(REPO_ROOT, "dist-electron", "main.js");
const DEV_SERVER_URL = "http://localhost:5173";

export const LOCAL_SEED_PACK = path.join(REPO_ROOT, "packs", "Edgeware++ Test Pack V2");
export const REAL_TEST_PACK_ZIP = path.join(REPO_ROOT, "packs", "Edgeware++ Test Pack V2.zip");
export const FIXTURE_SEED_PACK = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "E2E Seed Pack");

/** Committed trimmed copy of the real V2 test pack's media (img+vid+aud) — fast & reproducible on clean checkouts. */
export const REAL_MEDIA_PACK_FIXTURE = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack");

/** Minimal pack with a corruption.json whose level 2 flips dangerous settings. */
export const CORRUPTION_PACK_FIXTURE = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Corruption Test Pack");

export interface PackListing {
  name: string;
  path: string;
  version?: string;
  creator?: string;
}

export interface TempState {
  dir: string;
  packsDir: string;
  seedName: string;
  seedDisplayName: string;
  seedPath: string;
}

export interface RunningApp {
  app: ElectronApplication;
  window: Page;
  state: TempState;
}

function newestSourceMtime(): number {
  const roots = [path.join(REPO_ROOT, "electron"), path.join(REPO_ROOT, "src"), path.join(REPO_ROOT, "vite.config.ts")];
  let newest = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith(".ts") || full.endsWith(".tsx") || full.endsWith(".css")) {
        const mtime = statSync(full).mtimeMs;
        if (mtime > newest) newest = mtime;
      }
    }
  };
  for (const root of roots) {
    if (!existsSync(root)) continue;
    if (statSync(root).isDirectory()) walk(root);
    else newest = Math.max(newest, statSync(root).mtimeMs);
  }
  return newest;
}

function buildElectron(): void {
  execSync("npx vite build", { cwd: REPO_ROOT, stdio: "inherit" });
}

export function ensureElectronBuild(): void {
  if (!existsSync(DIST_MAIN)) {
    buildElectron();
    return;
  }
  const built = statSync(DIST_MAIN).mtimeMs;
  const newest = newestSourceMtime();
  if (newest > built) buildElectron();
}

/**
 * Resolve the real V2 test pack to a directory if it can be found locally.
 * Prefers an already-extracted folder; otherwise expands the (gitignored) zip
 * into a temp dir so E2E can select genuine real media on this machine. Returns the
 * extracted temp dir (caller owns cleanup of the extracted copy) or null when the
 * real pack is absent (clean CI checkout).
 */
export function resolveRealPackDir(): { source: string; cleanup?: () => void } | null {
  if (existsSync(LOCAL_SEED_PACK) && statSync(LOCAL_SEED_PACK).isDirectory()) {
    return { source: LOCAL_SEED_PACK };
  }
  if (existsSync(REAL_TEST_PACK_ZIP)) {
    const extracted = path.join(createTempDir(), "Real Pack (from zip)");
    execSync(`unzip -o -q "${REAL_TEST_PACK_ZIP}" -d "${extracted}"`, { stdio: "inherit" });
    return { source: extracted, cleanup: () => rmSync(extracted, { recursive: true, force: true }) };
  }
  return null;
}

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "ewpp-e2e-pack-"));
}

export interface CreateTempStateOptions {
  /**
   - "default": prefer the real V2 pack if present, else the minimal seed fixture.
   - "media": install a real-media pack (preferring the genuine V2 pack when it is
     available locally) that has img/vid/aud for runtime media verification.
   - "corruption": install the minimal corruption fixture pack (corruption.json
     whose level 2 flips dangerous settings).
   */
  kind?: "default" | "media" | "corruption";
}

export function createTempState(opts: CreateTempStateOptions = {}): TempState {
  const dir = mkdtempSync(path.join(tmpdir(), "ewpp-e2e-"));
  const packsDir = path.join(dir, "data", "packs");
  mkdirSync(packsDir, { recursive: true });

  const cleanupReal: Array<() => void> = [];
  let source: string;
  if (opts.kind === "corruption") {
    source = CORRUPTION_PACK_FIXTURE;
    if (!existsSync(source)) throw new Error(`Corruption fixture pack missing: ${source}`);
  } else if (opts.kind === "media") {
    // Fast & reproducible: the committed trimmed copy of the real V2 test pack's
    // media (img/vid/aud), kept small for speed.
    source = REAL_MEDIA_PACK_FIXTURE;
    if (!existsSync(source)) throw new Error(`Media fixture pack missing: ${source}`);
  } else {
    const real = resolveRealPackDir();
    if (real) {
      source = real.source;
      if (real.cleanup) cleanupReal.push(real.cleanup);
    } else {
      source = FIXTURE_SEED_PACK;
      if (!existsSync(source)) throw new Error(`No seed pack available: ${FIXTURE_SEED_PACK}`);
    }
  }

  const seedName = path.basename(source);
  const seedPath = path.join(packsDir, seedName);
  cpSync(source, seedPath, { recursive: true });

  let seedDisplayName = seedName;
  try {
    const info = JSON.parse(readFileSync(path.join(seedPath, "info.json"), "utf-8")) as { name?: unknown };
    if (typeof info.name === "string" && info.name) seedDisplayName = info.name;
  } catch {
    // No info.json — directory name is the display name
  }

  for (const fn of cleanupReal) fn();

  return { dir, packsDir, seedName, seedDisplayName, seedPath };
}

export function cleanupTempState(state: TempState | null): void {
  if (!state) return;
  // The app may still be flushing logs when cleanup runs; retry so a
  // transient ENOTEMPTY/EBUSY does not fail an otherwise green test.
  rmSync(state.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}

export function seedConfig(state: TempState, settings: Record<string, unknown>): string {
  const dataDir = path.join(state.dir, "data");
  mkdirSync(dataDir, { recursive: true });
  const configPath = path.join(dataDir, "config.json");
  const { packPath, ...rest } = settings;
  const written = packPath === undefined ? rest : { ...rest, packPath };
  writeFileSync(configPath, JSON.stringify(written, null, 2), "utf-8");
  return configPath;
}

export async function launchApp(state: TempState, extraEnv: Record<string, string> = {}): Promise<RunningApp> {
  const app = await _electron.launch({
    executablePath: electronExecutable,
    args: [DIST_MAIN],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: DEV_SERVER_URL,
      EDGWARE_USER_DATA_DIR: state.dir,
      ...extraEnv,
    },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator("[data-testid='metadata-panel']")).toBeVisible();
  // Settings hydrate asynchronously; acting before that races persisted
  // chances/render mode against defaults.
  await expect
    .poll(
      async () =>
        window.evaluate(
          () =>
            (
              (window as unknown as {
                __settingsStore?: { getState: () => { loaded?: boolean } };
              }).__settingsStore?.getState().loaded ?? false
            ) === true
        ),
      { timeout: 30000 }
    )
    .toBe(true);
  return { app, window, state };
}

export async function quitApp(running: RunningApp): Promise<void> {
  const { app } = running;
  try {
    await app.evaluate(({ app }) => {
      app.quit();
    });
  } catch {
    // App may already be gone
  }
  await new Promise<void>((resolve) => {
    const proc = app.process();
    if (proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 15000);
    proc.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function listPacksViaBridge(window: Page): Promise<PackListing[] | null> {
  return window.evaluate(async () => {
    const api = (window as unknown as { api?: { system?: { listPacks?: () => Promise<unknown[]> } } }).api;
    if (!api?.system?.listPacks) return null;
    return (await api.system.listPacks()) as PackListing[] | null;
  });
}

/**
 * Click Start and accept the spawn-warning modal when the seeded settings
 * would keep popups from appearing. Tests whose subject is not the popup
 * frequency use this instead of a bare button click.
 */
export async function clickStart(window: import("@playwright/test").Page): Promise<void> {
  await window.locator("[data-testid='start-stop-button']").click();
  const proceed = window.locator("[data-testid='spawn-warning-start']");
  const shown = await proceed
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (shown) await proceed.click();
}
