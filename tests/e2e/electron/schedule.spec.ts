import { expect, test, afterEach } from "@playwright/test";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

function seed(overrides: Record<string, unknown> = {}): ReturnType<typeof createTempState> {
  const state = createTempState({ kind: "media" });
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
    delay: 1000,
    schedule: 1,
    scheduleTime: 2,
    timeType: "Minutes",
    varianceTime: 0,
    varianceType: "Minutes",
    repeatSchedule: 0,
    repeatTime: 0,
    repeatType: "Minutes",
    ...overrides,
  });
  return state;
}

test.describe("in-app session scheduler", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("scheduling arms a future session without starting now", async () => {
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

    // Console capture must attach before reload so the arming line (logged
    // during initial mount) is not missed.
    const logs: string[] = [];
    running.window.on("console", (msg) => logs.push(msg.text()));
    await running.window.reload();

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });

    // The arming line names the real wait: 2 Minutes must reach the timer as
    // 120s — a wrong-unit bug logs a different number, not this line.
    await expect
      .poll(() => logs.some((l) => /\[schedule\] next scheduled session in 120s/.test(l)), {
        timeout: 15000,
      })
      .toBe(true);
    await expect(running.window.locator("[data-testid='start-stop-button']")).toContainText("Start");

    // Nothing fired early: no session, and no confirmation modal either.
    await running.window.waitForTimeout(2000);
    await expect(running.window.locator("[data-testid='start-stop-button']")).toContainText("Start");
    await expect(running.window.locator("[data-testid='corruption-danger-modal']")).toHaveCount(0);
    await expect(running.window.locator("[data-testid='spawn-warning-modal']")).toHaveCount(0);
  });

  test("disabled scheduling never arms", async () => {
    const state = seed({ schedule: 0 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    // The arming decision happens during mount, before launchApp resolves —
    // attach the listener and reload, or the absence asserted below could
    // never have been a presence for any product behavior.
    const logs: string[] = [];
    running.window.on("console", (msg) => logs.push(msg.text()));
    await running.window.reload();

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await running.window.waitForTimeout(2500);
    expect(logs.some((l) => l.includes("next scheduled session"))).toBe(false);
    await expect(running.window.locator("[data-testid='start-stop-button']")).toContainText("Start");
  });
});
