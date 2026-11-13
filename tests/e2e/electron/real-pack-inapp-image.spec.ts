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

/** Scan in-app overlays for an image `<img>` decoded from a real pack file. */
async function loadedInAppImage(running: RunningApp): Promise<boolean> {
  try {
    const count = await running.window.locator('[data-testid="in-app-popup"] [data-testid="image-popup-img"]').count();
    for (let i = 0; i < count; i++) {
      const nat = await running.window
        .locator('[data-testid="in-app-popup"] [data-testid="image-popup-img"]')
        .nth(i)
        .evaluate((img) => (img as HTMLImageElement).naturalWidth);
      if (nat > 0) return true;
    }
  } catch {
    /* mid-render */
  }
  return false;
}

test.describe("A21.2 — in-app popup overlay renders real pack media", () => {
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
      subliminalsChance: 0,
      mitosisMode: 0,
      delay: 500,
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

  test("Start → in-app overlay renders real pack image; Stop removes it, counts reset", async () => {
    const app = running!.app;
    const window = running!.window;

    // Single window (in-app mode never spawns extra BrowserWindows).
    await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);

    await window.locator("[data-testid='start-stop-button']").click();

    // One or more overlays appear and at least one has a decoded real image.
    await expect
      .poll(async () => await running!.window.locator('[data-testid="in-app-popup"]').count(), { timeout: 30000 })
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(async () => await loadedInAppImage(running!), { timeout: 30000 })
      .toBe(true);

    // Window count stayed at one (no extra BrowserWindows).
    expect(app.windows().length).toBe(1);

    // Stop removes all overlays and resets the metadata panel popup count.
    await window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(async () => await running!.window.locator('[data-testid="in-app-popup"]').count(), { timeout: 30000 })
      .toBe(0);
    const text = (await window.locator('[data-testid="popup-count"]').textContent()) ?? "";
    expect(text).toMatch(/Active:\s*0/);

    // No new popups during a 2× delay quiet period.
    await window.waitForTimeout(1000 + 600);
    const overlaysAfterQuiet = await window.locator('[data-testid="in-app-popup"]').count();
    expect(overlaysAfterQuiet).toBe(0);
  });
});
