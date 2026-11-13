import { expect, test, afterEach } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  clickStart,
  seedConfig,
} from "./launch";

function seed(state: ReturnType<typeof createTempState>) {
  // Ship a wallpaper file inside the pack and register it in wallpaperDat.
  const wallDir = path.join(state.seedPath, "wallpapers");
  mkdirSync(wallDir, { recursive: true });
  const img = path.join(state.seedPath, "img");
  const first = readdirSync(img)[0];
  copyFileSync(path.join(img, first), path.join(wallDir, "wall-a.png"));
  copyFileSync(path.join(img, first), path.join(wallDir, "wall-b.png"));

  seedConfig(state, {
    packPath: state.seedPath,
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    mitosisMode: 0,
    delay: 60000,
    rotateWallpaper: 1,
    wallpaperTimer: 1200,
    wallpaperVariance: 0,
    wallpaperDat: JSON.stringify({ A: "wallpapers/wall-a.png", B: "wallpapers/wall-b.png" }),
  });
}

function wallpaperLog(state: ReturnType<typeof createTempState>): string {
  const logDir = path.join(state.dir, "logs");
  if (!existsSync(logDir)) return "";
  return readdirSync(logDir)
    .map((f) => {
      try {
        return readFileSync(path.join(logDir, f), "utf-8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

test.describe("wallpaper rotation (rotateWallpaper + wallpaperDat + timer/variance)", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("rotates configured pack wallpapers on the timer", async () => {
    const state = createTempState({ kind: "media" });
    seed(state);
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, {
      // The apply pipeline is exercised through the stub: the real desktop
      // is never touched, and the stub log names the exact files rotation
      // chose. (A test process cannot restore a real wallpaper anyway — its
      // wallpaper-memory state dies with the temp userData directory.)
      EDGWARE_WALLPAPER_STUB: path.join(state.seedPath, "img", readdirSync(path.join(state.seedPath, "img"))[0]),
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await clickStart(running.window);

    // Rotation drives the full pipeline: timer → pick → setWallpaper apply.
    const appliedFile = path.join(state.dir, "wallpaper_applied.log");
    const applied = () => (existsSync(appliedFile) ? readFileSync(appliedFile, "utf-8") : "");
    await expect
      .poll(() => /wallpapers\/wall-[ab]\.png/.test(applied()), { timeout: 45000 })
      .toBe(true);
    const log = wallpaperLog(state);
    expect(log).not.toContain("wallpaperRotation] wallpaper change failed");
    expect(log).not.toContain("rotation is on but no wallpapers are configured");
    expect(applied()).not.toContain("Refused real wallpaper apply");
    expect(existsSync(path.join(state.seedPath, "wallpapers", "wall-a.png"))).toBe(true);

    // Config hygiene: rotation must not mark settings dirty forever or corrupt
    // the stored wallpaperDat round-trip.
    const cfg = JSON.parse(readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")) as {
      wallpaperDat?: string;
    };
    expect(cfg.wallpaperDat).toContain("wall-a.png");
  });
});
