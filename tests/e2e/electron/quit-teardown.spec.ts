import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  seedConfig,
  type TempState,
} from "./launch";

/** Mono 16-bit PCM silence — long enough to still be playing when quit fires. */
function writeSilentWav(file: string, seconds = 6, rate = 8000): void {
  const data = Buffer.alloc(seconds * rate * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

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
