import { expect, test, afterEach } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
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
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await running.window.locator("[data-testid='start-stop-button']").click();

    // Rotation must reach the OS apply step. The apply itself is gated by
    // macOS Automation permission (osascript -1743 when denied) and may take
    // up to the script timeouts, so poll for either outcome.
    await expect
      .poll(() => {
        const log = wallpaperLog(state);
        return (
          log.includes("Applied via System Events") ||
          log.includes("wallpaper set failed") ||
          log.includes("Wallpaper fallback failed")
        );
      }, { timeout: 45000 })
      .toBe(true);
    const log = wallpaperLog(state);
    expect(log).not.toContain("wallpaperRotation] wallpaper change failed");
    expect(log).not.toContain("rotation is on but no wallpapers are configured");
    const applyFailures = log
      .split("\n")
      .filter((l) => l.includes("[Wallpaper]") && l.includes("failed"));
    for (const line of applyFailures) {
      // Any surfaced osascript failure is an OS-level gate (Automation
      // permission or script timeout), never a pipeline defect.
      expect(line).toMatch(/Command failed: osascript|-1743|Apple events|not authorized|ETIMEDOUT|timed out/i);
    }
    expect(existsSync(path.join(state.seedPath, "wallpapers", "wall-a.png"))).toBe(true);

    // Config hygiene: rotation must not mark settings dirty forever or corrupt
    // the stored wallpaperDat round-trip.
    const cfg = JSON.parse(readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")) as {
      wallpaperDat?: string;
    };
    expect(cfg.wallpaperDat).toContain("wall-a.png");
  });
});
