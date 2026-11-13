import { expect, test, afterEach, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

// 1x1 red PNG.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
// A different 1x1 PNG for the priority fixture.
const PNG_ALT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const dataUrl = (bytes: Buffer): string => `data:image/png;base64,${bytes.toString("base64")}`;

function baseSeed(settings: Record<string, unknown> = {}): ReturnType<typeof createTempState> {
  const state = createTempState({ kind: "media" });
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
    delay: 60000,
    ...settings,
  });
  return state;
}

/**
 * Record every src the splash image takes across one reload, in-page. The
 * splash self-destructs ~2.7 s after first paint (1800 ms hold + 800 ms
 * fade), so asserting on it after the fact races its destroy timer; an
 * observer installed before the navigation cannot miss the mount, and the
 * recorded list survives the splash itself.
 */
async function armSplashRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __e2eSplashSrcs?: string[] };
    w.__e2eSplashSrcs = [];
    const record = () => {
      const img = document.querySelector("[data-testid='splash-image']");
      if (!img) return;
      const src = img.getAttribute("src");
      const list = w.__e2eSplashSrcs!;
      if (src && list[list.length - 1] !== src) list.push(src);
    };
    new MutationObserver(record).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
    record();
  });
  await page.reload();
}

function splashSrcs(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __e2eSplashSrcs?: string[] }).__e2eSplashSrcs ?? []
  );
}

test.describe("startup splash screen", () => {
  let cleanup: Array<() => Promise<void> | void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!();
  });

  test("shows the splash on start and fades it out", async () => {
    const state = baseSeed({ showLoadingFlair: 1 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await armSplashRecorder(running.window);

    // With no pack loading_splash of its own, the bundled default shows.
    await expect
      .poll(async () => (await splashSrcs(running.window)).some((s) => s.includes("default_loading_splash")), {
        timeout: 15000,
      })
      .toBe(true);

    // Hold (1800 ms) + fade-out (800 ms), then the splash unmounts.
    await expect(running.window.locator("[data-testid='startup-splash']")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(running.window.locator("[data-testid='pack-info']")).toBeVisible();
  });

  test("pack resource/loading_splash.png overrides the default image", async () => {
    const state = baseSeed({ showLoadingFlair: 1 });
    const resource = path.join(state.seedPath, "resource");
    mkdirSync(resource, { recursive: true });
    writeFileSync(path.join(resource, "loading_splash.png"), PNG_1PX);
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await armSplashRecorder(running.window);

    // Exact payload: any data URL would also satisfy a prefix check, and the
    // default asset is itself served as a URL — pin the pack's own bytes.
    await expect
      .poll(async () => (await splashSrcs(running.window)).includes(dataUrl(PNG_1PX)), {
        timeout: 15000,
      })
      .toBe(true);
  });

  test("pack loading_splash.png at the pack root overrides the default image", async () => {
    const state = baseSeed({ showLoadingFlair: 1 });
    writeFileSync(path.join(state.seedPath, "loading_splash.png"), PNG_1PX);
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await armSplashRecorder(running.window);

    await expect
      .poll(async () => (await splashSrcs(running.window)).includes(dataUrl(PNG_1PX)), {
        timeout: 15000,
      })
      .toBe(true);
  });

  test("the pack root splash wins over resource/loading_splash.png", async () => {
    const state = baseSeed({ showLoadingFlair: 1 });
    const resource = path.join(state.seedPath, "resource");
    mkdirSync(resource, { recursive: true });
    writeFileSync(path.join(resource, "loading_splash.png"), PNG_ALT);
    writeFileSync(path.join(state.seedPath, "loading_splash.png"), PNG_1PX);
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await armSplashRecorder(running.window);

    // Legacy port order: root first, then resource/. The root bytes must be
    // the pack splash that lands, never the resource/ one.
    await expect
      .poll(async () => (await splashSrcs(running.window)).includes(dataUrl(PNG_1PX)), {
        timeout: 15000,
      })
      .toBe(true);
    expect(await splashSrcs(running.window)).not.toContain(dataUrl(PNG_ALT));
  });

  test("no splash when the startup splash setting is off", async () => {
    const state = baseSeed({ showLoadingFlair: 0 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    // pack-info proves the settings loaded; at that point a splash that
    // ignored showLoadingFlair would already be on screen. Sleeping first
    // only lets the splash's own timer erase the regression.
    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await expect(running.window.locator("[data-testid='startup-splash']")).toHaveCount(0);
  });
});
