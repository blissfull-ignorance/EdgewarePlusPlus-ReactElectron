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

test.describe("A21.3 — real pack video reaches playback in an Electron popup", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      popupMod: 0,
      vidMod: 100,
      audioMod: 0,
      promptMod: 0,
      webMod: 0,
      capPopChance: 0,
      subliminalsChance: 0,
      mitosisMode: 0,
      delay: 250,
    });
    running = await launchApp(state);
    expect(await running!.window.locator("[data-testid='pack-info']").count()).toBe(1);
  });

  test.afterAll(async () => {
    try {
      // Stop only when a session is actually running: an unconditional
      // click would START one seconds before quitting.
      const btn = running?.window.locator("[data-testid='start-stop-button']");
      if (btn && (await btn.isVisible()) && (await btn.textContent()) === "Stop") await btn.click();
    } catch {
      /* noop */
    }
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("settings-driven video pop reaches element-level playback; Stop closes it", async () => {
    const app = running!.app;
    const window = running!.window;

    // Scan (synchronously via proper async loop) every popup window for the real <video>.
    const playState = async (): Promise<{ playing: number; cur: number; src: string }> => {
      for (const w of app.windows()) {
        try {
          if ((await w.locator('[data-testid="video-popup-video"]').count()) === 0) continue;
          const st = (await w
            .locator('[data-testid="video-popup-video"]')
            .first()
            .evaluate((el) => ({
              paused: (el as HTMLVideoElement).paused,
              rs: (el as HTMLVideoElement).readyState,
              cur: (el as HTMLVideoElement).currentTime,
              src: (el as HTMLVideoElement).currentSrc,
            }))) as { paused: boolean; rs: number; cur: number; src: string };
          return { playing: !st.paused && st.rs >= 2 ? 1 : 0, cur: st.cur, src: st.src };
        } catch {
          /* window mid-close */
        }
      }
      return { playing: 0, cur: 0, src: "" };
    };

    await window.locator("[data-testid='start-stop-button']").click();

    // Element-level: the video is actually playing (unpaused + buffered) from real pack media.
    let state = { playing: 0, cur: 0, src: "" };
    await expect
      .poll(async () => {
        state = await playState();
        return state.playing;
      }, { timeout: 30000 })
      .toBe(1);
    // Served through the pack-media protocol (real pack file), never a data-URI/mock.
    expect(state.src).toContain("packmedia://vid/");
    // Playback has advanced past t=0.
    await expect
      .poll(async () => (await playState()).cur, { timeout: 15000 })
      .toBeGreaterThan(0);

    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);
  });
});
