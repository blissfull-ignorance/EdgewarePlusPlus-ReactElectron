import { expect, test } from "@playwright/test";
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

/**
 * Hibernate mode replaces the normal roll loop (legacy main_edgeware): while
 * it is on, popups only ever come from scheduled bursts. These tests run the
 * real runtime with a roll delay of a full minute, so any popup inside the
 * first seconds can only come from the hibernate scheduler.
 */

test("hibernate bursts replace the roll loop and Stop tears the cycle down", async () => {
  ensureElectronBuild();
  const state: TempState = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    hibernateMode: 1,
    hibernateType: "Original",
    hibernateMin: 1200,
    hibernateMax: 1800,
    wakeupActivity: 2,
    hibernateLength: 1000,
    delay: 60000,
    popupMod: 100,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    popupRenderMode: "electron",
    timeoutPopups: 0,
  });
  const running: RunningApp = await launchApp(state);
  try {
    const { window, app } = running;
    expect(app.windows().length).toBe(1);
    await expect(window.locator("[data-testid='hibernate-countdown']")).toHaveText(
      "Countdown: —"
    );

    await window.locator("[data-testid='start-stop-button']").click();

    // Idle: the panel counts down to the armed burst instead of showing "—".
    await expect
      .poll(
        async () => {
          const text = await window
            .locator("[data-testid='hibernate-countdown']")
            .textContent();
          return /\d/.test(text ?? "") ? "counting" : (text ?? "");
        },
        { timeout: 10000 }
      )
      .toBe("counting");

    // The roll loop is paused (delay 60s): the first popups must come from
    // the burst armed at 1.2–1.8s.
    await expect
      .poll(() => app.windows().length, { timeout: 30000 })
      .toBeGreaterThanOrEqual(2);

    await window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => app.windows().length, { timeout: 30000 })
      .toBe(1);
    await expect(window.locator("[data-testid='hibernate-countdown']")).toHaveText(
      "Countdown: —"
    );

    // Nothing re-arms after Stop.
    await window.waitForTimeout(3000);
    expect(app.windows().length).toBe(1);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("pump-scare popups force-close ~2.5s after opening without popup timeouts", async () => {
  ensureElectronBuild();
  const state: TempState = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    hibernateMode: 1,
    hibernateType: "Pump-Scare",
    hibernateMin: 600,
    hibernateMax: 900,
    popupMod: 100,
    vidMod: 0,
    audioMod: 100,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    popupRenderMode: "electron",
    timeoutPopups: 0,
    delay: 60000,
  });
  const running: RunningApp = await launchApp(state);
  try {
    const { window, app } = running;
    await window.locator("[data-testid='start-stop-button']").click();

    await expect
      .poll(() => app.windows().length, { timeout: 30000 })
      .toBeGreaterThanOrEqual(2);
    const t0 = Date.now();

    // Stand the scheduler down so no second burst pollutes the close check;
    // the already-open pump-scare windows must still close on their own.
    await window.evaluate(() => {
      const store = (window as unknown as { __settingsStore?: { setState: (p: object) => void } })
        .__settingsStore;
      if (!store) throw new Error("__settingsStore missing: cannot stand the scheduler down");
      store.setState({ hibernateMode: 0 });
    });

    await expect
      .poll(() => app.windows().length, { timeout: 15000 })
      .toBe(1);
    const elapsed = Date.now() - t0;
    // timeoutPopups is off: only the pump-scare forced close (2500ms) can
    // end these windows — not instantly, and not lingering.
    expect(elapsed).toBeGreaterThanOrEqual(1200);
    expect(elapsed).toBeLessThan(6000);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
