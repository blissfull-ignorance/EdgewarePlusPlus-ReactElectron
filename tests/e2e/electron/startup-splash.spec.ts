import { expect, test, afterEach } from "@playwright/test";
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

test.describe("startup splash screen", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
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

    const splash = running.window.locator("[data-testid='startup-splash']");
    await expect(splash).toBeAttached({ timeout: 5000 });
    await expect(running.window.locator("[data-testid='splash-image']")).toBeAttached();

    // Fade-in (2s) + hold (2s) + fade-out (2s), then the splash unmounts.
    await expect(splash).toHaveCount(0, { timeout: 15000 });
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

    const image = running.window.locator("[data-testid='splash-image']");
    await expect(image).toBeAttached({ timeout: 5000 });
    await expect
      .poll(async () => (await image.getAttribute("src"))?.startsWith("data:image/png;base64,"), {
        timeout: 5000,
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

    const image = running.window.locator("[data-testid='splash-image']");
    await expect(image).toBeAttached({ timeout: 5000 });
    await expect
      .poll(async () => (await image.getAttribute("src"))?.startsWith("data:image/png;base64,"), {
        timeout: 5000,
      })
      .toBe(true);
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

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await running.window.waitForTimeout(1000);
    await expect(running.window.locator("[data-testid='startup-splash']")).toHaveCount(0);
  });
});
