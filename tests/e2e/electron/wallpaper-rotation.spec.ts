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
  type TempState,
} from "./launch";

function seed(state: ReturnType<typeof createTempState>, overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  });
}

function wallpaperLog(state: TempState): string {
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

/** The stub log lines produced by rotation itself (pack wallpapers, absolute). */
function rotationLines(state: TempState): string[] {
  const file = path.join(state.dir, "wallpaper_applied.log");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /wallpapers\/wall-[ab]\.png$/.test(l));
}

function stubEnv(state: TempState): Record<string, string> {
  // The apply pipeline is exercised through the stub: the real desktop
  // is never touched, and the stub log names the exact files rotation
  // chose. (A test process cannot restore a real wallpaper anyway — its
  // wallpaper-memory state dies with the temp userData directory.)
  return {
    EDGWARE_WALLPAPER_STUB: path.join(
      state.seedPath,
      "img",
      readdirSync(path.join(state.seedPath, "img"))[0]
    ),
  };
}

test.describe("wallpaper rotation (rotateWallpaper + wallpaperDat + timer/variance)", () => {
  let cleanup: Array<() => Promise<void> | void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!();
  });

  test("rotates configured pack wallpapers on the timer", async () => {
    const state = createTempState({ kind: "media" });
    seed(state);
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, stubEnv(state));
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
    // nextWallpaperPick alternates between the two candidates, so both must
    // appear — a pick function stuck on one file would never fill the set.
    await expect
      .poll(() => new Set(rotationLines(state)).size, { timeout: 45000 })
      .toBe(2);

    const lines = rotationLines(state);
    // Every applied path is absolute under the pack root: a lost pack-path
    // prefix would silently apply nothing (or the wrong file) for real.
    for (const line of lines) {
      expect(line.startsWith(`${state.seedPath}/wallpapers/`)).toBe(true);
    }
    // And no two consecutive applies pick the same wallpaper.
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).not.toBe(lines[i - 1]);
    }

    const log = wallpaperLog(state);
    expect(log).not.toContain("wallpaperRotation] wallpaper change failed");
    expect(log).not.toContain("rotation is on but no wallpapers are configured");
    // The temp-dir refusal goes to the app log, never to the stub log —
    // reading it from the wrong file made this check structurally dead.
    expect(log).not.toContain("Refused real wallpaper apply");
    expect(existsSync(path.join(state.seedPath, "wallpapers", "wall-a.png"))).toBe(true);

    // Config hygiene: rotation must not mark settings dirty forever or corrupt
    // the stored wallpaperDat round-trip.
    const cfg = JSON.parse(readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")) as {
      wallpaperDat?: string;
    };
    expect(cfg.wallpaperDat).toContain("wall-a.png");
  });

  test("Stop stops the rotation timer", async () => {
    const state = createTempState({ kind: "media" });
    seed(state);
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, stubEnv(state));
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await clickStart(running.window);

    await expect
      .poll(() => rotationLines(state).length, { timeout: 45000 })
      .toBeGreaterThan(0);

    const startStop = running.window.locator("[data-testid='start-stop-button']");
    await startStop.click();
    await expect(startStop).toHaveText("Start");

    // A leaked timer keeps changing the desktop after Stop — the exact
    // "state not reverted after Stop" class. Wait past three timer periods.
    const afterStop = rotationLines(state).length;
    await running.window.waitForTimeout(4000);
    expect(rotationLines(state).length).toBe(afterStop);
  });

  test("fixWallpaper only rotates while the session is actually throwing", async () => {
    const state = createTempState({ kind: "media" });
    seed(state, { fixWallpaper: 1 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, stubEnv(state));
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await clickStart(running.window);

    // Idle session (no popups, no hibernate): rotation stays gated for more
    // than two full timer periods.
    await running.window.waitForTimeout(4000);
    expect(rotationLines(state)).toHaveLength(0);

    // With popups live, the very next tick applies a wallpaper again.
    await running.window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ popupMod: 100, delay: 800 });
    });
    await expect
      .poll(() => rotationLines(state).length, { timeout: 30000 })
      .toBeGreaterThan(0);

    const startStop = running.window.locator("[data-testid='start-stop-button']");
    if ((await startStop.textContent()) === "Stop") await startStop.click();
  });
});
