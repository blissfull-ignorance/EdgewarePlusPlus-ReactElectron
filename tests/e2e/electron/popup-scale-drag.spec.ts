import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
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

// 1x1 transparent PNG: a square media file makes the legacy size band
// (30–70% of the display's short side) identical for width and height.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJTA5ErkJggg==",
  "base64"
);

interface WinBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function popupBounds(app: RunningApp["app"], urlPart: string): Promise<WinBounds | null> {
  return app.evaluate(({ BrowserWindow }, part) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes(part)
    );
    return win ? win.getBounds() : null;
  }, urlPart);
}

function createPopup(window: RunningApp["window"], media: string) {
  return window.evaluate((m) => {
    const api = (
      window as unknown as {
        api: { popup: { create: (t: string, id: string) => Promise<{ id: string }> } };
      }
    ).api;
    return api.popup.create("image", m);
  }, media);
}

async function launch(
  overrides: Record<string, unknown>
): Promise<{ state: TempState; running: RunningApp }> {
  const state = createTempState({ kind: "media" });
  writeFileSync(path.join(state.seedPath, "img", "square.png"), PNG);
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
    movingChance: 0,
    delay: 60000,
    ...overrides,
  });
  const running = await launchApp(state);
  return { state, running };
}

test.beforeAll(() => {
  ensureElectronBuild();
});

test.describe("popup size scale", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    const l = await launch({ popupScale: 25 });
    state = l.state;
    running = l.running;
    await running.window.waitForLoadState("domcontentloaded");
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("a 25% scale keeps the popup far below the default size band", async () => {
    const { window, app } = running!;
    const shortSide = await app.evaluate(({ screen }) => {
      const wa = screen.getPrimaryDisplay().workAreaSize;
      return Math.min(wa.width, wa.height);
    });
    const popupPromise = app.waitForEvent("window");
    await createPopup(window, "square.png");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");

    // Default sizing would land at 30–70% of the short side; 25% scale caps
    // it at 17.5%. Poll until the renderer's sizeToMedia has been applied.
    await expect
      .poll(
        async () => {
          const b = await popupBounds(app, "/popup/image/");
          return b ? b.width / shortSide : 1;
        },
        { timeout: 30000 }
      )
      .toBeLessThan(0.2);
    const b = await popupBounds(app, "/popup/image/");
    expect(b!.height / shortSide).toBeLessThan(0.2);
  });
});

test.describe("popup size scale — up", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    const l = await launch({ popupScale: 300 });
    state = l.state;
    running = l.running;
    await running.window.waitForLoadState("domcontentloaded");
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("a 300% scale grows the popup past the default size band", async () => {
    const { window, app } = running!;
    const work = await app.evaluate(({ screen }) => {
      const wa = screen.getPrimaryDisplay().workAreaSize;
      return { width: wa.width, height: wa.height };
    });
    const popupPromise = app.waitForEvent("window");
    await createPopup(window, "square.png");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");

    // Square media at 300%: the long side spans 90–210% of the short side,
    // clamped to the work area. The default band tops out at 70%.
    await expect
      .poll(
        async () => {
          const b = await popupBounds(app, "/popup/image/");
          return b ? b.height / work.height : 0;
        },
        { timeout: 30000 }
      )
      .toBeGreaterThanOrEqual(0.85);
  });
});

test.describe("draggable popups", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    const l = await launch({ popupDraggable: 1 });
    state = l.state;
    running = l.running;
    await running.window.waitForLoadState("domcontentloaded");
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("holding the upper edge moves the popup window", async () => {
    const { window, app } = running!;
    const popupPromise = app.waitForEvent("window");
    await createPopup(window, "square.png");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");

    const strip = popup.locator("[data-testid='popup-drag-strip']");
    await expect(strip).toBeVisible({ timeout: 30000 });

    const before = await popupBounds(app, "/popup/image/");
    expect(before).not.toBeNull();

    const box = await strip.boundingBox();
    expect(box).not.toBeNull();
    await popup.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await popup.mouse.down();
    await popup.mouse.move(box!.x + box!.width / 2 + 160, box!.y + box!.height / 2 + 90, {
      steps: 8,
    });
    await popup.mouse.up();

    await expect
      .poll(async () => {
        const b = await popupBounds(app, "/popup/image/");
        if (!b) return false;
        return Math.abs(b.x - before!.x - 160) <= 20 && Math.abs(b.y - before!.y - 90) <= 20;
      }, { timeout: 15000 })
      .toBe(true);
  });
});

test.describe("draggable popups — off by default", () => {
  let state: TempState | null = null;
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    const l = await launch({});
    state = l.state;
    running = l.running;
    await running.window.waitForLoadState("domcontentloaded");
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("no drag strip without the setting", async () => {
    const { window, app } = running!;
    const popupPromise = app.waitForEvent("window");
    await createPopup(window, "square.png");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup.locator('[data-testid="image-popup-img"]')).toBeVisible({ timeout: 30000 });
    await expect(popup.locator("[data-testid='popup-drag-strip']")).toHaveCount(0);
  });
});
