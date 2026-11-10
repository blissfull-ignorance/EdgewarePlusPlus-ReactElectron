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

    // And it stays on-screen while moving.
    const display = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds);
    const b = await popupBounds(app, "#/popup/image");
    expect(b!.x).toBeGreaterThanOrEqual(display.x - 1);
    expect(b!.y).toBeGreaterThanOrEqual(display.y - 1);

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
});
