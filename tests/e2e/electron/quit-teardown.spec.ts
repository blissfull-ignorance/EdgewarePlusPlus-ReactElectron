import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  seedConfig,
  writeSilentWav,
  type TempState,
} from "./launch";

function seedMediaState(): TempState {
  const state = createTempState({ kind: "media" });
  writeSilentWav(path.join(state.seedPath, "aud", "longtone.wav"));
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
    showLoadingFlair: 0,
    delay: 60000,
  });
  return state;
}

function waitForExit(app: { process(): NodeJS.Process }, ms = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      app.process().kill("SIGKILL");
      resolve(false);
    }, ms);
    app.process().once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

test.describe("Quitting must stop audio and end the process", () => {
  test.beforeAll(() => {
    ensureElectronBuild();
  });

  test("app.quit with audio playing exits the process (no orphaned sound)", async () => {
    const state = seedMediaState();
    const running = await launchApp(state);
    try {
      await running.window.evaluate(() =>
        (
          window as unknown as { api: { popup: { create: (t: string, m: string) => Promise<unknown> } } }
        ).api.popup.create("audio", "longtone.wav")
      );
      const audioWin = await running.app.waitForEvent("window");
      await audioWin.waitForLoadState("domcontentloaded");
      // Real playback under way — this is the state the owner quit from.
      // (The audio element is box-less by design, so poll its state directly.)
      await expect
        .poll(async () =>
          audioWin
            .locator('[data-testid="audio-popup-audio"]')
            .evaluate((el) => {
              const a = el as HTMLAudioElement;
              return !a.paused && a.readyState >= 2 ? a.currentTime : 0;
            })
            .catch(() => 0)
        )
        .toBeGreaterThan(0);

      await running.app.evaluate(({ app }) => app.quit());
      expect(await waitForExit(running.app)).toBe(true);
    } finally {
      cleanupTempState(state);
    }
  });

  test("closing every window exits the process on macOS too", async () => {
    const state = seedMediaState();
    const running = await launchApp(state);
    try {
      await running.app.evaluate(({ BrowserWindow }) => {
        for (const w of BrowserWindow.getAllWindows()) w.close();
      });
      expect(await waitForExit(running.app)).toBe(true);
    } finally {
      cleanupTempState(state);
    }
  });
});
