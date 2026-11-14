import { expect, test } from "@playwright/test";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type RunningApp,
  type TempState,
} from "./launch";

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const IMG_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "img");

// The desktop picture the stub claims is applied before the app ever runs.
let initialWallpaper = "";
let state: TempState | null = null;
let running: RunningApp | null = null;
let packDir = "";

function appliedLog(): string[] {
  const file = path.join(state!.dir, "wallpaper_applied.log");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function wallpaperPack(packsDir: string): string {
  const dir = path.join(packsDir, "WM-Pack");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", "one.png"));
  copyFileSync(path.join(IMG_DIR, "globelw.png"), path.join(dir, "img", "wp.png"));
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "WM-Pack", id: "wmpack", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({ default: { maxClicks: 1, captions: ["c"] }, moods: [] })
  );
  writeFileSync(
    path.join(dir, "corruption.json"),
    JSON.stringify({ moods: { "1": { add: [], remove: [], wallpaper: "img/wp.png" } }, config: {} })
  );
  return dir;
}

function seed(): void {
  seedConfig(state!, {
    packPath: packDir,
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    showLoadingFlair: 0,
    corruptionMode: 1,
    corruptionFullPerm: 0,
    corruptionTrigger: "Script",
    corruptionWallpaperCycle: 0,
    delay: 5000,
  });
}

async function launch(): Promise<RunningApp> {
  return launchApp(state!, { EDGWARE_STUB_BROWSER: "1", EDGWARE_WALLPAPER_STUB: initialWallpaper });
}

async function advanceToLevel1(app: RunningApp): Promise<void> {
  await app.window.locator("[data-testid='start-stop-button']").click();
  await expect(app.window.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
  await app.window.evaluate(() =>
    (window as unknown as { api: { scripting: { advanceLevel: () => Promise<number> } } })
      .api.scripting.advanceLevel()
  );
}

test.describe("Wallpaper memory and panic wallpaper override", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    packDir = wallpaperPack(state.packsDir);
    initialWallpaper = path.join(state.dir, "original-desktop.png");
    copyFileSync(path.join(IMG_DIR, "applelw.png"), initialWallpaper);
    seed();
    running = await launch();
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("Stop restores the user's original wallpaper", async () => {
    const { window } = running!;
    await advanceToLevel1(running!);
    await expect
      .poll(() => appliedLog().some((l) => l.endsWith("img/wp.png")), { timeout: 30_000 })
      .toBe(true);

    await window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => appliedLog().at(-1), { timeout: 15_000 })
      .toBe(initialWallpaper);
  });

  test("quitting without Stop restores on the next startup", async () => {
    await advanceToLevel1(running!);
    await expect
      .poll(() => appliedLog().at(-1), { timeout: 30_000 })
      .toMatch(/wp\.png$/);
    // Quit WITHOUT Stop: the pack wallpaper stays applied until next boot.
    await quitApp(running!);
    running = null;

    // Quitting itself must NOT restore — the documented mechanism is the
    // dirty flag plus the next startup. If someone moves the restore to
    // before-quit, this line fails and the semantics get a look-in.
    expect(appliedLog().at(-1)).toMatch(/wp\.png$/);

    running = await launch();
    await expect
      .poll(() => appliedLog().at(-1), { timeout: 30_000 })
      .toBe(initialWallpaper);
  });

  test("a pack panic_wallpaper.png overrides the bundled panic image", async () => {
    const { window, app } = running!;
    const override = path.join(packDir, "panic_wallpaper.png");
    const payload = Buffer.from("panic-override-bytes");
    writeFileSync(override, payload);

    const closed = new Promise<void>((resolve) => {
      app.once("close", () => resolve());
      setTimeout(() => resolve(), 8000);
    });
    await window.evaluate(() => window.api?.panic.trigger()).catch(() => undefined);
    await closed;

    const staged = path.join(state!.dir, "panic_wallpaper.jpg");
    expect(existsSync(staged)).toBe(true);
    expect(readFileSync(staged).equals(payload)).toBe(true);
    expect(appliedLog().at(-1)).toBe(staged);
    running = null;
  });

  test("a panic hard-exit still restores the wallpaper on the next startup", async () => {
    // The panic above ended in app.exit(0): before-quit never ran, so the
    // dirty flag plus the startup restore is the only thing that can undo
    // the panic wallpaper. Hard-exit leaks are this project's most-recurring
    // incident class — pin the chain across the hard exit itself.
    expect(appliedLog().at(-1)).toContain("panic_wallpaper.jpg");

    running = await launch();
    await expect
      .poll(() => appliedLog().at(-1), { timeout: 30_000 })
      .toBe(initialWallpaper);

    const stateFile = path.join(state!.dir, "wallpaper_state.json");
    await expect
      .poll(() => {
        try {
          return (JSON.parse(readFileSync(stateFile, "utf-8")) as { dirty?: boolean }).dirty;
        } catch {
          return null;
        }
      }, { timeout: 15_000 })
      .toBe(false);
  });

  test("startup drops a legacy pack-poisoned original instead of re-applying it", async () => {
    // The shipped-release flaw: an old build cached a pack's corruption
    // wallpaper as the "original" while it was on screen. The poisoned state
    // survives the upgrade; the startup restore must retire it silently —
    // never re-applying the pack image over the user's desktop.
    await quitApp(running!);
    running = null;

    const packWall = path.join(packDir, "img", "wp.png");
    const stateFile = path.join(state!.dir, "wallpaper_state.json");
    writeFileSync(stateFile, JSON.stringify({ original: packWall, dirty: true }), "utf-8");
    const appliedBefore = appliedLog().length;

    running = await launch();
    await expect
      .poll(() => {
        try {
          return JSON.parse(readFileSync(stateFile, "utf-8")) as {
            original?: string;
            dirty?: boolean;
            applied?: string[];
          };
        } catch {
          return null;
        }
      }, { timeout: 30_000 })
      .toEqual({ original: "", dirty: false, applied: [packWall] });
    expect(appliedLog()).toHaveLength(appliedBefore);
  });

  test("after the retire, the user's own desktop is re-captured as the baseline", async () => {
    // The recovery path for the shipped flaw: with the cache retired, the
    // user sets their picture back (outside the app). The next app change
    // captures it as the original, and Stop restores to it again.
    const { window } = running!;
    const packWall = path.join(packDir, "img", "wp.png");
    const userDesk = path.join(state!.dir, "user-desktop.png");
    copyFileSync(path.join(IMG_DIR, "globelw.png"), userDesk);
    // The stub answers reads from the applied log: appending simulates the
    // user setting this picture through macOS System Settings.
    appendFileSync(path.join(state!.dir, "wallpaper_applied.log"), `${userDesk}\n`, "utf-8");

    await advanceToLevel1(running!);
    await expect
      .poll(() => appliedLog().at(-1), { timeout: 30_000 })
      .toMatch(/wp\.png$/);

    await window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => appliedLog().at(-1), { timeout: 15_000 })
      .toBe(userDesk);

    const stateFile = path.join(state!.dir, "wallpaper_state.json");
    await expect
      .poll(() => {
        try {
          return JSON.parse(readFileSync(stateFile, "utf-8")) as {
            original?: string;
            dirty?: boolean;
          };
        } catch {
          return null;
        }
      }, { timeout: 15_000 })
      .toEqual({ original: userDesk, dirty: false, applied: [packWall] });
  });
});
