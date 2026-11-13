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

interface WinBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function popupBounds(app: RunningApp["app"], urlPart: string): Promise<WinBounds | null> {
  return app.evaluate(({ BrowserWindow }, part) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes(part)
    );
    return win ? win.getBounds() : null;
  }, urlPart);
}

async function createPopup(window: RunningApp["window"], type: string, media: string) {
  return window.evaluate(
    ([t, m]) => (window as never as { api: { popup: { create: (a: string, b: string) => Promise<{ id: string }> } } }).api.popup.create(t, m),
    [type, media] as const
  );
}

async function closeAll(window: RunningApp["window"]) {
  await window.evaluate(() => (window as never as { api: { popup: { closeAll: () => Promise<void> } } }).api.popup.closeAll());
  await expect
    .poll(() => running!.app.windows().filter((w) => w.url().includes("/popup/")).length)
    .toBe(0);
}

let state: TempState | null = null;
let running: RunningApp | null = null;

test.describe("Popup window behaviors — sizing, movement, audio chip", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
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
      movingChance: 100,
      movingSpeed: 6,
      delay: 60000,
    });
    running = await launchApp(state);
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("image popups resize to the media: no letterbox border, legacy size band", async () => {
    const { window, app } = running!;
    const popupPromise = app.waitForEvent("window");
    await createPopup(window, "image", "applelw.png");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    const img = popup.locator('[data-testid="image-popup-img"]');
    await expect(img).toBeVisible({ timeout: 30000 });

    const natural = await img.evaluate((el) => {
      const e = el as HTMLImageElement;
      return { w: e.naturalWidth, h: e.naturalHeight };
    });
    expect(natural.w).toBeGreaterThan(0);

    // The window must converge on the media's aspect ratio (contain-fit fills
    // the frame, so any leftover border would show as a ratio mismatch).
    await expect
      .poll(async () => {
        const b = await popupBounds(app, "#/popup/image");
        if (!b) return 0;
        const mediaRatio = natural.w / natural.h;
        const winRatio = b.width / b.height;
        return Math.abs(winRatio - mediaRatio) / mediaRatio;
      }, { timeout: 15000 })
      .toBeLessThan(0.05);

    const bounds = await popupBounds(app, "#/popup/image");
    const display = await app.evaluate(({ screen }) => {
      const { width, height } = screen.getPrimaryDisplay().workAreaSize;
      return { shortSide: Math.min(width, height) };
    });
    const longest = Math.max(bounds!.width, bounds!.height);
    expect(longest).toBeGreaterThanOrEqual(display.shortSide * 0.28);
    expect(longest).toBeLessThanOrEqual(display.shortSide * 0.72);

    await closeAll(window);
  });

  test("moving popups actually move the window across the display", async () => {
    const { window, app } = running!;
    const popupPromise = app.waitForEvent("window");
    await createPopup(window, "image", "globelw.png");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup.locator('[data-testid="image-popup-img"]')).toBeVisible({ timeout: 30000 });

    // Wait for the mover to start (settings load + roll + startMoving IPC).
    await expect
      .poll(
        async () => {
          const a = await popupBounds(app, "#/popup/image");
          await new Promise((r) => setTimeout(r, 350));
          const b = await popupBounds(app, "#/popup/image");
          if (!a || !b) return false;
          return a.x !== b.x || a.y !== b.y;
        },
        { timeout: 20000, intervals: [100] }
      )
      .toBe(true);

    // And every sampled position stays inside the work area the mover
    // bounces in — a single end snapshot could catch a lucky instant.
    const work = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);
    const samples: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let i = 0; i < 12; i++) {
      const b = await popupBounds(app, "#/popup/image");
      if (b) samples.push(b);
      await new Promise((r) => setTimeout(r, 180));
    }
    expect(samples.length).toBeGreaterThanOrEqual(6);
    for (const b of samples) {
      expect(b.x).toBeGreaterThanOrEqual(work.x - 1);
      expect(b.y).toBeGreaterThanOrEqual(work.y - 1);
      expect(b.x + b.width).toBeLessThanOrEqual(work.x + work.width + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(work.y + work.height + 1);
    }
    // The window travelled across the samples, it did not just jitter once.
    const spread =
      Math.max(...samples.map((b) => b.x)) - Math.min(...samples.map((b) => b.x)) +
      (Math.max(...samples.map((b) => b.y)) - Math.min(...samples.map((b) => b.y)));
    expect(spread).toBeGreaterThan(2);

    await closeAll(window);
  });

  test("audio pops are a small symbol chip, not a media window", async () => {
    const { window, app } = running!;
    const popupPromise = app.waitForEvent("window");
    await createPopup(window, "audio", "think.wav");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");

    await expect(popup.locator('[data-testid="audio-popup-chip"]')).toBeVisible({ timeout: 30000 });
    const bounds = await popupBounds(app, "#/popup/audio");
    expect(bounds!.width).toBeLessThanOrEqual(160);
    expect(bounds!.height).toBeLessThanOrEqual(60);

    await closeAll(window);
  });

  test("the audio concurrency cap holds in electron mode and releases between pops", async () => {
    const { window, app } = running!;
    await window.evaluate((v: Record<string, unknown>) => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (x: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw(v);
    }, { audioMod: 100, maxAudio: 1, delay: 400 });
    await expect
      .poll(() =>
        window.evaluate(
          () =>
            (
              window as unknown as { __settingsStore: { getState: () => { dirty: boolean } } }
            ).__settingsStore.getState().dirty
        )
      )
      .toBe(false);

    const audioWins = () =>
      app.windows().filter((w) => w !== window && w.url().includes("/popup/audio"));
    const seen = new Set<string>();
    let maxConcurrent = 0;

    const startStop = window.locator("[data-testid='start-stop-button']");
    try {
      await startStop.click();
      for (let i = 0; i < 25; i++) {
        const wins = audioWins();
        maxConcurrent = Math.max(maxConcurrent, wins.length);
        for (const w of wins) seen.add(w.url());
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      if ((await startStop.textContent()) === "Stop") await startStop.click();
      await window.evaluate((v: Record<string, unknown>) => {
        (
          window as unknown as {
            __settingsStore: { getState: () => { setRaw: (x: Record<string, unknown>) => void } };
          }
        ).__settingsStore.getState().setRaw(v);
      }, { audioMod: 0, delay: 60000 });
      await closeAll(window);
    }

    // Never two audio windows at once (the cap), yet more than one distinct
    // pop across the run — the registry released after each 0.6s file ended.
    expect(maxConcurrent).toBe(1);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  test("clickthrough popups ignore the mouse in the real window", async () => {
    const { window, app } = running!;
    await window.evaluate((v: Record<string, unknown>) => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (x: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw(v);
    }, { clickthroughPopups: 1 });
    await expect
      .poll(() =>
        window.evaluate(
          () =>
            (
              window as unknown as { __settingsStore: { getState: () => { dirty: boolean } } }
            ).__settingsStore.getState().dirty
        )
      )
      .toBe(false);

    try {
      await createPopup(window, "image", "applelw.png");
      const popup = await app.waitForEvent("window", {
        predicate: (w) => w.url().includes("/popup/image"),
        timeout: 15_000,
      });
      await popup.waitForSelector("[data-testid='popup-shell']", { timeout: 15_000 });
      const pointerEvents = await popup
        .locator("[data-testid='popup-shell']")
        .first()
        .evaluate((el) => getComputedStyle(el).pointerEvents);
      expect(pointerEvents).toBe("none");
    } finally {
      await window.evaluate((v: Record<string, unknown>) => {
        (
          window as unknown as {
            __settingsStore: { getState: () => { setRaw: (x: Record<string, unknown>) => void } };
          }
        ).__settingsStore.getState().setRaw(v);
      }, { clickthroughPopups: 0 });
      await closeAll(window);
    }
  });
});
