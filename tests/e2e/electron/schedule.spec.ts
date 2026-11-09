import { expect, test, afterEach } from "@playwright/test";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

function seed(): ReturnType<typeof createTempState> {
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

    // The scheduler logs its arming on the renderer console; the runtime must
    // NOT be started yet.
    await expect
      .poll(() => logs.some((l) => l.includes("[schedule] next scheduled session")), {
        timeout: 15000,
      })
      .toBe(true);
    await expect(running.window.locator("[data-testid='start-stop-button']")).toContainText("Start");
  });

  test("disabled scheduling never arms", async () => {
    const state = seed();
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
      schedule: 0,
    });
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
    const logs: string[] = [];
    running.window.on("console", (msg) => logs.push(msg.text()));
    await running.window.waitForTimeout(2500);
    expect(logs.some((l) => l.includes("next scheduled session"))).toBe(false);
  });
});
