import { expect, test, afterEach } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type TempState,
} from "./launch";

function seed(overrides: Record<string, unknown> = {}): TempState {
  const state = createTempState({ kind: "corruption" });
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
    corruptionMode: 1,
    corruptionFullPerm: 1,
    corruptionTrigger: "Timed",
    corruptionTime: 1500,
    delay: 30000,
    ...overrides,
  });
  return state;
}

function readConfig(state: TempState): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")) as Record<string, unknown>;
}

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const IMG_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "img");

/** Three-level moods-only pack with per-level config, for driver tests. */
function driverPack(
  packsDir: string,
  name: string,
  levelConfigs: Record<string, Record<string, unknown>>
): string {
  const dir = path.join(packsDir, name);
  mkdirSync(path.join(dir, "img"), { recursive: true });
  for (const f of ["one.png", "two.png", "three.png"]) {
    copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", f));
  }
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name, id: name, creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["c"] },
      moods: [
        { mood: "m1", captions: [], media: ["one.png"] },
        { mood: "m2", captions: [], media: ["two.png"] },
        { mood: "m3", captions: [], media: ["three.png"] },
      ],
    })
  );
  writeFileSync(
    path.join(dir, "corruption.json"),
    JSON.stringify({
      moods: {
        "1": { add: ["m1"], remove: [] },
        "2": { add: ["m2"], remove: [] },
        "3": { add: ["m3"], remove: [] },
      },
      config: levelConfigs,
    })
  );
  return dir;
}

function driverSeed(
  state: TempState,
  pack: string,
  overrides: Record<string, unknown> = {}
): void {
  seedConfig(state, {
    packPath: pack,
    popupRenderMode: "inapp",
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    mitosisMode: 0,
    showLoadingFlair: 0,
    corruptionMode: 1,
    corruptionFullPerm: 0,
    corruptionTrigger: "Timed",
    corruptionTime: 1500,
    delay: 30000,
    ...overrides,
  });
}

test.describe("corruption runtime (danger gate, timed progression, overrides)", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("full-permission start shows the danger modal; cancel does not start", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect(running.window.locator("[data-testid='corruption-danger-modal']")).toBeVisible({
      timeout: 15000,
    });
    await expect(running.window.getByText("Panic Hotkey is disabled")).toBeVisible();
    await expect(running.window.getByText("MEDIUM")).toBeVisible();
    // The fixture's level-2 config is exactly two dangers: delay 500 (MEDIUM)
    // and panicDisabled (MINOR). The count and both groups must be listed.
    await expect(running.window.locator("[data-testid='danger-group-MINOR']")).toBeVisible();
    await expect(running.window.locator("[data-testid='corruption-danger-modal']")).toContainText(
      /2\s*setting\(s\)/
    );

    await running.window.locator("[data-testid='danger-cancel']").click();
    await expect(running.window.locator("[data-testid='corruption-danger-modal']")).not.toBeVisible();
    await expect(running.window.locator("[data-testid='start-stop-button']")).toContainText("Start");
  });

  test("proceeding starts the runtime and timed levels apply overrides", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect(running.window.locator("[data-testid='corruption-danger-modal']")).toBeVisible({
      timeout: 15000,
    });
    await running.window.locator("[data-testid='danger-proceed']").click();

    await expect(running.window.locator("[data-testid='start-stop-button']")).toContainText("Stop");

    // Timed driver: after corruptionTime the level advances and the level-2
    // overrides (delay 500, panicDisabled 1) land in the persisted config.
    await expect
      .poll(
        () => {
          try {
            const cfg = readConfig(state);
            return cfg.panicDisabled === 1 && cfg.delay === 500;
          } catch {
            return false;
          }
        },
        { timeout: 30000 }
      )
      .toBe(true);

    // Exact level text: a bare "2" also matches the "/ 2" denominator.
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("2 / 2");

    // Stop restores every session-overridden key; the pack can never keep
    // the user's settings after the session ends (round-3 regression class).
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(
        () => {
          try {
            const cfg = readConfig(state);
            return cfg.delay === 30000 && Number(cfg.panicDisabled ?? 0) === 0;
          } catch {
            return false;
          }
        },
        { timeout: 15000 }
      )
      .toBe(true);
  });

  test("without full permission there is no danger gate and no overrides", async () => {
    const state = seed({ corruptionFullPerm: 0 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect(running.window.locator("[data-testid='start-stop-button']")).toContainText("Stop");
    await expect(running.window.locator("[data-testid='corruption-danger-modal']")).not.toBeVisible();

    // The levels must still advance — otherwise the untouched config below
    // would only prove the runtime never ran at all.
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("2 / 2", {
      timeout: 15000,
    });

    const cfg = readConfig(state);
    expect(Number(cfg.panicDisabled ?? 0)).toBe(0);
    expect(cfg.delay ?? 30000).toBe(30000);

    await running.window.locator("[data-testid='start-stop-button']").click();
  });

  test("the Popup trigger advances on the spawn counter, not the clock", async () => {
    const state = createTempState();
    cleanup.push(() => cleanupTempState(state));
    const pack = driverPack(state.packsDir, "Popup Driver Pack", {});
    driverSeed(state, pack, {
      popupMod: 100,
      corruptionTrigger: "Popup",
      corruptionPopups: 2,
      delay: 1500,
    });
    const running = await launchApp(state, {
      EDGWARE_STUB_BROWSER: "1",
      EDGWARE_PANIC_SKIP_WALLPAPER: "1",
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();

    // One spawn is below the threshold of two: still level 1.
    await expect(running.window.locator("[data-testid='popup-count']")).toContainText("Active: 1", {
      timeout: 15000,
    });
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("1 / 3");

    // The second spawn crosses the threshold; two more cross it again.
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("2 / 3", {
      timeout: 15000,
    });
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("3 / 3", {
      timeout: 15000,
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
  });

  test("purity mode starts at the top and eases down", async () => {
    const state = createTempState();
    cleanup.push(() => cleanupTempState(state));
    const pack = driverPack(state.packsDir, "Purity Pack", {});
    driverSeed(state, pack, { corruptionPurityMode: 1, corruptionTime: 1500 });
    const running = await launchApp(state, {
      EDGWARE_STUB_BROWSER: "1",
      EDGWARE_PANIC_SKIP_WALLPAPER: "1",
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("3 / 3", {
      timeout: 15000,
    });
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("2 / 3", {
      timeout: 15000,
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
  });

  test("a level's corruptionTime override changes the real cadence", async () => {
    const state = createTempState();
    cleanup.push(() => cleanupTempState(state));
    // Level 2 rewrites the transition time to legacy 1 (second → 1000 ms)
    // while the session started on an 8 s cadence.
    const pack = driverPack(state.packsDir, "Cadence Pack", { "2": { corruptionTime: 1 } });
    driverSeed(state, pack, { corruptionFullPerm: 1, corruptionTime: 8000 });
    const running = await launchApp(state, {
      EDGWARE_STUB_BROWSER: "1",
      EDGWARE_PANIC_SKIP_WALLPAPER: "1",
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
    // Level 2 lands on the original 8 s cadence.
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("2 / 3", {
      timeout: 20000,
    });
    // Level 3 must follow on the overridden 1 s cadence; a driver that keeps
    // the stale 8 s interval never makes this window.
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("3 / 3", {
      timeout: 4000,
    });

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(
        () => {
          try {
            return readConfig(state).corruptionTime === 8000;
          } catch {
            return false;
          }
        },
        { timeout: 15000 }
      )
      .toBe(true);
  });
});
