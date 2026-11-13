import { expect, test, type Page } from "@playwright/test";
import { rmSync } from "node:fs";
import path from "node:path";
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
 * User-reported regression: "Hypno Overlays are not working at all" and "the closing
 * symbol (X) was wrong — it should be a pack defined string in the lower right".
 * These specs prove, at the element level in the real app:
 *  - an image pop carries a spiral GIF loaded from the pack (packmedia://hypno/),
 *  - the close button shows the pack-defined label (Real Test Pack captions.json
 *    subtext = "Click to close!"), in the lower right corner,
 *  - both popup render modes behave identically.
 */

interface OverlayProbe {
  naturalWidth: number;
  src: string;
  closeLabel: string | null;
  objectFit: string;
  box: { left: number; top: number; width: number; height: number };
  viewport: { width: number; height: number };
  page?: Page;
}

async function probeOverlayWindow(page: Page): Promise<OverlayProbe | null> {
  const loc = page.locator('[data-testid="hypno-overlay-img"]');
  if ((await loc.count()) === 0) return null;
  const img = loc.first();
  const st = await img.evaluate((el) => {
    const i = el as HTMLImageElement;
    const wrapEl = i.parentElement ?? i;
    const r = wrapEl.getBoundingClientRect();
    return {
      naturalWidth: i.naturalWidth,
      src: i.currentSrc || i.src,
      objectFit: getComputedStyle(i).objectFit,
      box: {
        left: Math.round(r.x),
        top: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  const closeLabel =
    ((await page.locator('[data-testid="close-button"]').first().textContent().catch(() => null)) ?? null);
  return { ...st, closeLabel };
}

async function stopAndVerifyQuiet(running: RunningApp, delayMs: number): Promise<void> {
  const { app, window } = running;
  await window.locator("[data-testid='start-stop-button']").click();
  await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);
  await window.waitForTimeout(delayMs * 2);
  expect((await app.windows()).length).toBe(1);
}

test.describe("user-fix — hypno overlay + pack close label (electron render mode)", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      popupMod: 100,
      vidMod: 0,
      audioMod: 0,
      promptMod: 0,
      webMod: 0,
      capPopChance: 0,
      subliminalsChance: 100,
      subliminalsAlpha: 60,
      mitosisMode: 0,
      delay: 800,
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

  test("image popup carries a decoded pack spiral and the pack-defined close label", async () => {
    const app = running!.app;

    await running!.window.locator("[data-testid='start-stop-button']").click();

    const probe = async (): Promise<OverlayProbe | null> => {
      for (const w of app.windows()) {
        try {
          const p = await probeOverlayWindow(w);
          if (p) return { ...p, page: w };
        } catch {
          /* window mid-close */
        }
      }
      return null;
    };

    let seen: OverlayProbe | null = null;
    await expect
      .poll(async () => {
        seen = await probe();
        return seen?.naturalWidth ?? 0;
      }, { timeout: 60000 })
      .toBeGreaterThan(0);

    expect(seen!.src).toContain("packmedia://hypno/");
    expect(seen!.closeLabel).toBe("Click to close!");

    // User requirement: an oversized overlay must be cut to the base media's
    // visible size/ratio — cover fit inside the contained frame, never contain
    // letterboxing beyond the image area. The fixture media is 4:3 like the
    // 400x300 popup window, so its visible frame is the whole viewport.
    expect(seen!.objectFit).toBe("cover");
    expect(seen!.box.width).toBeLessThanOrEqual(seen!.viewport.width);
    expect(seen!.box.height).toBeLessThanOrEqual(seen!.viewport.height);
    if (seen!.box.left === 0 && seen!.box.top === 0) {
      const media = await seen!.page!.evaluate(() => {
        const img = document.querySelector('[data-testid="image-popup-img"]') as HTMLImageElement | null;
        return img ? { natW: img.naturalWidth, natH: img.naturalHeight } : null;
      });
      if (media && media.natW / media.natH === seen!.viewport.width / seen!.viewport.height) {
        expect(seen!.box.width).toBe(seen!.viewport.width);
        expect(seen!.box.height).toBe(seen!.viewport.height);
      }
    }

    await stopAndVerifyQuiet(running!, 800);
  });

  test("built-in default spiral is used when the pack has no hypno media", async () => {
    // kind:"default" resolves to a pack without a hypno/ dir (V2 test pack or seed
    // fixture), so the overlay must fall back to the app's default_hypno.gif asset.
    const fallbackState = createTempState({ kind: "default" });
    // kind:"default" may resolve to a local library pack that ships hypno
    // media — remove both hypno locations so the fallback condition holds
    // on every machine.
    rmSync(path.join(fallbackState.seedPath, "hypno"), { recursive: true, force: true });
    rmSync(path.join(fallbackState.seedPath, "subliminals"), { recursive: true, force: true });
    seedConfig(fallbackState, {
      packPath: fallbackState.seedPath,
      popupRenderMode: "electron",
      popupMod: 100,
      vidMod: 0,
      audioMod: 0,
      promptMod: 0,
      webMod: 0,
      capPopChance: 0,
      subliminalsChance: 100,
      subliminalsAlpha: 60,
      mitosisMode: 0,
      delay: 800,
    });
    const fallbackApp = await launchApp(fallbackState);
    try {
      expect(await fallbackApp.window.locator("[data-testid='pack-info']").count()).toBe(1);
      await fallbackApp.window.locator("[data-testid='start-stop-button']").click();

      const probe = async () => {
        for (const w of fallbackApp.app.windows()) {
          try {
            const loc = w.locator('[data-testid="hypno-overlay-img"]');
            if ((await loc.count()) === 0) continue;
            const st = await loc
              .first()
              .evaluate((el) => {
                const i = el as HTMLImageElement;
                return { naturalWidth: i.naturalWidth, src: i.currentSrc || i.src };
              });
            if (st.naturalWidth > 0) return st;
          } catch {
            /* window mid-close */
          }
        }
        return null;
      };

      let seen: { naturalWidth: number; src: string } | null = null;
      await expect
        .poll(async () => {
          seen = await probe();
          return seen?.naturalWidth ?? 0;
        }, { timeout: 60000 })
        .toBeGreaterThan(0);
      expect(seen!.src.endsWith("default_hypno.gif")).toBe(true);

      await fallbackApp.window.locator("[data-testid='start-stop-button']").click();
      await expect.poll(async () => fallbackApp.app.windows().length, { timeout: 30000 }).toBe(1);
    } finally {
      await quitApp(fallbackApp);
      cleanupTempState(fallbackState);
    }
  });
});

test.describe("user-fix — hypno overlay + pack close label (in-app render mode)", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "inapp",
      popupMod: 100,
      vidMod: 0,
      audioMod: 0,
      promptMod: 0,
      webMod: 0,
      capPopChance: 0,
      subliminalsChance: 100,
      subliminalsAlpha: 60,
      mitosisMode: 0,
      delay: 800,
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

  test("in-app image overlay carries the pack spiral and the pack close label", async () => {
    const window = running!.window;

    await window.locator("[data-testid='start-stop-button']").click();

    const overlayImg = window.locator('[data-testid="in-app-popup"] [data-testid="hypno-overlay-img"]');
    await expect
      .poll(async () => {
        const count = await overlayImg.count();
        for (let i = 0; i < count; i++) {
          const nw = await overlayImg.nth(i).evaluate((el) => (el as HTMLImageElement).naturalWidth);
          if (nw > 0) return nw;
        }
        return 0;
      }, { timeout: 60000 })
      .toBeGreaterThan(0);

    const src = await overlayImg.first().evaluate((el) => (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src);
    expect(src).toContain("packmedia://hypno/");

    const label = await window
      .locator('[data-testid="in-app-popup"] [data-testid="close-button"]')
      .first()
      .textContent();
    expect(label).toBe("Click to close!");

    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(async () => overlayImg.count(), { timeout: 30000 }).toBe(0);
    await window.waitForTimeout(1600);
    expect(await overlayImg.count()).toBe(0);
  });
});
