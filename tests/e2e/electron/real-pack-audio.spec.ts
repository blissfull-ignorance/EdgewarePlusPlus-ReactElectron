import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
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

test.describe("A21.4 — real pack audio playback state verified progressing", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      popupMod: 0,
      vidMod: 0,
      audioMod: 100,
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
      const btn = running?.window.locator("[data-testid='start-stop-button']");
      if (btn && (await btn.isVisible())) await btn.click();
    } catch {
      /* noop */
    }
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("settings-driven audio pop reports element-level playback advancing; it closes when the file ends", async () => {
    const app = running!.app;
    const window = running!.window;

    const audioState = async (): Promise<{ playing: number; cur: number; src: string }> => {
      for (const w of app.windows()) {
        try {
          if ((await w.locator('[data-testid="audio-popup-audio"]').count()) === 0) continue;
          const st = (await w
            .locator('[data-testid="audio-popup-audio"]')
            .first()
            .evaluate((el) => ({
              paused: (el as HTMLAudioElement).paused,
              rs: (el as HTMLAudioElement).readyState,
              cur: (el as HTMLAudioElement).currentTime,
              src: (el as HTMLAudioElement).currentSrc,
            }))) as { paused: boolean; rs: number; cur: number; src: string };
          return { playing: !st.paused && st.rs >= 2 ? 1 : 0, cur: st.cur, src: st.src };
        } catch {
          /* window mid-close */
        }
      }
      return { playing: 0, cur: 0, src: "" };
    };

    await window.locator("[data-testid='start-stop-button']").click();

    // Element-level: the audio is unpaused and buffered — real playback, not mocked.
    let state = { playing: 0, cur: 0, src: "" };
    await expect
      .poll(async () => {
        state = await audioState();
        return state.playing;
      }, { timeout: 30000 })
      .toBe(1);
    // Served through the pack-media protocol (real pack file).
    expect(state.src).toContain("packmedia://aud/");
    // Playback advances past t=0.
    await expect
      .poll(async () => (await audioState()).cur, { timeout: 15000 })
      .toBeGreaterThan(0);

    // One-shot playback (legacy on_eos): the audio popup closes itself when
    // the file ends — it must not linger looping until Stop.
    let audioWin: Page | null = null;
    for (const w of app.windows()) {
      try {
        if ((await w.locator('[data-testid="popup-shell"]').count()) > 0 &&
            (await w.locator('[data-testid="audio-popup-audio"]').count()) > 0) {
          audioWin = w;
          break;
        }
      } catch { /* mid-close */ }
    }
    expect(audioWin).not.toBeNull();
    // The chip stays the visible, clickable surface while the file plays.
    await expect(audioWin!.locator('[data-testid="audio-popup-chip"]')).toBeVisible();
    await expect
      .poll(async () => {
        try {
          return (await audioWin!.locator('[data-testid="audio-popup-audio"]').count()) === 0;
        } catch {
          return true; /* window already closed */
        }
      }, { timeout: 15000 })
      .toBe(true);

    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);
  });
});
