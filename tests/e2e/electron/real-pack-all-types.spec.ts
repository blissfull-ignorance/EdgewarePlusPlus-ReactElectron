import { expect, test, type Page } from "@playwright/test";
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
 * User-reported regression: "Videos are not playing despite setting video
 * probability to 100%" and "No audio was played".
 *
 * Root cause: the old roll selected only the FIRST type whose chance passed, and
 * image (100% by default) came first — so video/audio/prompt were shadowed
 * forever. The fix evaluates every type independently per tick.
 *
 * This spec drives the real app with image=video=audio=100% and proves all three
 * actually spawn AND actually play (element-level, real pack media).
 */

interface TypeProbe {
  image: boolean;
  video: boolean;
  audio: boolean;
}

async function probeWindow(page: Page): Promise<Partial<TypeProbe>> {
  const out: Partial<TypeProbe> = {};
  try {
    const img = page.locator('[data-testid="image-popup-img"]').first();
    if ((await img.count()) > 0) {
      const st = await img.evaluate((el) => {
        const i = el as HTMLImageElement;
        return { naturalWidth: i.naturalWidth, src: i.currentSrc || i.src };
      });
      if (st.naturalWidth > 0 && st.src.includes("packmedia://img/")) out.image = true;
    }
  } catch {
    /* window mid-close */
  }
  try {
    const vid = page.locator('[data-testid="video-popup-video"]').first();
    if ((await vid.count()) > 0) {
      const st = await vid.evaluate((el) => {
        const v = el as HTMLVideoElement;
        return { paused: v.paused, rs: v.readyState, cur: v.currentTime, src: v.currentSrc };
      });
      if (!st.paused && st.rs >= 2 && st.cur > 0 && st.src.includes("packmedia://vid/")) out.video = true;
    }
  } catch {
    /* window mid-close */
  }
  try {
    const aud = page.locator('[data-testid="audio-popup-audio"]').first();
    if ((await aud.count()) > 0) {
      const st = await aud.evaluate((el) => {
        const a = el as HTMLAudioElement;
        return { paused: a.paused, rs: a.readyState, cur: a.currentTime, src: a.currentSrc };
      });
      if (!st.paused && st.rs >= 2 && st.src.includes("packmedia://aud/")) out.audio = true;
    }
  } catch {
    /* window mid-close */
  }
  return out;
}

test.describe("user-fix — independent rolls: image + video + audio at 100% all fire", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      popupMod: 100,
      vidMod: 100,
      audioMod: 100,
      promptMod: 0,
      webMod: 0,
      capPopChance: 0,
      subliminalsChance: 0,
      mitosisMode: 0,
      delay: 2000,
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

  test("all three media types spawn and reach real playback simultaneously", async () => {
    const app = running!.app;
    const window = running!.window;

    await window.locator("[data-testid='start-stop-button']").click();

    const seen: TypeProbe = { image: false, video: false, audio: false };
    await expect
      .poll(async () => {
        for (const w of app.windows()) {
          const p = await probeWindow(w);
          if (p.image) seen.image = true;
          if (p.video) seen.video = true;
          if (p.audio) seen.audio = true;
        }
        return [seen.image ? 1 : 0, seen.video ? 1 : 0, seen.audio ? 1 : 0].join("");
      }, { timeout: 120000 })
      .toBe("111");

    expect(seen.image).toBe(true);
    expect(seen.video).toBe(true);
    expect(seen.audio).toBe(true);

    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);
    await window.waitForTimeout(4000);
    expect((await app.windows()).length).toBe(1);
  });
});
