import { expect, test, afterEach } from "@playwright/test";
import { readFileSync } from "node:fs";
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
    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("1", {
      timeout: 15000,
    });

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

    await expect(running.window.locator("[data-testid='corruption-level']")).toContainText("2");
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

    await running.window.waitForTimeout(4000);
    const cfg = readConfig(state);
    expect(cfg.panicDisabled ?? 0).not.toBe(1);
  });
});
