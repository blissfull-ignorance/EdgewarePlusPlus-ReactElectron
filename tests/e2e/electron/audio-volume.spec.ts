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
 * Legacy audio volume model: audioVolume (percent) is the playback target,
 * fadeInDuration ramps from silence to that target. The element-level volume
 * is read straight off the popup window's <audio> tag.
 */

async function audioVolumesProbe(app: RunningApp["app"]): Promise<number[]> {
  const volumes: number[] = [];
  for (const w of app.windows()) {
    try {
      if ((await w.locator('[data-testid="audio-popup-audio"]').count()) === 0) continue;
      const v = await w
        .locator('[data-testid="audio-popup-audio"]')
        .first()
        .evaluate((el) => (el as HTMLAudioElement).volume);
      volumes.push(v);
    } catch {
      /* window mid-close */
    }
  }
  return volumes;
}

test("audio popups ramp from silence to the audioVolume target over fadeInDuration", async () => {
  ensureElectronBuild();
  const state: TempState = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    audioMod: 100,
    popupMod: 0,
    vidMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    delay: 400,
    audioVolume: 40,
    fadeInDuration: 300,
    fadeOutDuration: 0,
    popupRenderMode: "electron",
  });
  const running: RunningApp = await launchApp(state);
  try {
    const { window, app } = running;
    await window.locator("[data-testid='start-stop-button']").click();

    // The clip is 0.6s and pops arrive every 400ms, so a sampling loop sees
    // many ramp generations: the minimum observed volume proves the fade
    // starts near silence, a settled sample proves the legacy target
    // (audioVolume/100) is reached and held.
    let minSeen = 1;
    let settledSeen = false;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && !(minSeen < 0.3 && settledSeen)) {
      const vs = await audioVolumesProbe(app);
      if (vs.length) {
        minSeen = Math.min(minSeen, ...vs);
        if (vs.some((v) => v >= 0.35 && v <= 0.45)) settledSeen = true;
      }
      await window.waitForTimeout(50);
    }
    expect(minSeen, "fade-in should start near silence").toBeLessThan(0.3);
    expect(settledSeen, "volume should settle at audioVolume/100 = 0.4").toBe(true);

    await window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("default settings play audio at full volume with no fade", async () => {
  ensureElectronBuild();
  const state: TempState = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    audioMod: 100,
    popupMod: 0,
    vidMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    delay: 400,
    audioVolume: 100,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    popupRenderMode: "electron",
  });
  const running: RunningApp = await launchApp(state);
  try {
    const { window, app } = running;
    await window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(async () => {
        const vs = await audioVolumesProbe(app);
        return vs.length > 0 && vs.every((v) => v === 1);
      }, { timeout: 30000 })
      .toBe(true);
    await window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
