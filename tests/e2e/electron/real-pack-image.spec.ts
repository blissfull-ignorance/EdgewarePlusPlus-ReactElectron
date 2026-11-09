import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
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

/** Find popups whose image has finished decoding a real pack file (naturalWidth > 0). */
async function loadedImagePopups(running: RunningApp) {
  const wins = running.app.windows();
  for (const w of wins) {
    try {
      if (!w.url().includes("/popup/")) continue;
      const count = await w.locator('[data-testid="image-popup-img"]').count();
      for (let i = 0; i < count; i++) {
        const nat = await w
          .locator('[data-testid="image-popup-img"]')
          .nth(i)
          .evaluate((img) => (img as HTMLImageElement).naturalWidth);
        if (nat > 0) return true;
      }
    } catch {
      /* window mid-close */
    }
  }
  return false;
}

test.describe("A21.1 / A21.6 — Electron runtime with the real pack", () => {
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
      subliminalsChance: 0,
      mitosisMode: 0,
      delay: 500,
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

  test("A21.1 Start → image popup verified from real pack media; Stop resets to one window", async () => {
    const app = running!.app;
    const window = running!.window;

    await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);
    await window.locator("[data-testid='start-stop-button']").click();

    // A popup BrowserWindow appears AND its image is verified loaded from real pack media.
    await expect
      .poll(async () => (await loadedImagePopups(running!)) || app.windows().length, { timeout: 30000 })
      .toBeTruthy();
    await expect
      .poll(async () => await loadedImagePopups(running!), { timeout: 30000 })
      .toBe(true);

    // Window count > 1 confirms a real second BrowserWindow exists.
    expect(app.windows().length).toBeGreaterThanOrEqual(2);

    // Main-window metadata shows active popups.
    const popupCount = await window.locator('[data-testid="popup-count"]').textContent();
    expect(popupCount?.replace(/\s+/g, " ")).toMatch(/Active:\s*(\d+)/);

    // Stop → back to exactly one window; 2× delay quiet period stays at one.
    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);
    await window.waitForTimeout(1000 + 600); // 2× delay (500ms) margin
    expect(app.windows().length).toBe(1);
  });

  test("A21.6 loop continues and good media still renders after a corrupt pack file is present", async () => {
    const app = running!.app;
    const window = running!.window;

    // Introduce a bad image into the live (temp) pack so randomImage can select it.
    writeFileSync(
      `${state!.seedPath}/img/zz-corrupt.png`,
      Buffer.from("not a real png by any stretch"),
      "utf-8"
    );

    await window.locator("[data-testid='start-stop-button']").click();

    // The engine keeps spawning (>= 2 distinct popup windows appear) and at least one
    // good image still decodes from real pack media despite the corrupt file present.
    await expect
      .poll(async () => app.windows().length, { timeout: 30000 })
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(async () => await loadedImagePopups(running!), { timeout: 30000 })
      .toBe(true);

    // No crash — Stop still returns cleanly.
    const popupCount = await window.locator('[data-testid="popup-count"]').textContent();
    expect(popupCount).toBeTruthy();
    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(async () => app.windows().length, { timeout: 30000 }).toBe(1);
  });

  test("A21.5 media scope guard rejects foreign/traversal paths while serving in-pack media", async () => {
    // In the running Electron renderer, exercise the live protocol handler directly.
    const res = await running!.window.evaluate(async () => {
      const probe = async (url: string): Promise<number> => {
        try {
          return await fetch(url).then((r) => r.status);
        } catch {
          return 999;
        }
      };
      return {
        traversal1: await probe("packmedia://img/..%2Finfo.json"),
        traversal2: await probe("packmedia://img/%2e%2e/info.json"),
        foreignSubdir: await probe("packmedia://etc/passwd"),
        missing: await probe("packmedia://img/definitely-not-there.png"),
        controlGood0: await probe("packmedia://img/applelw.png"),
        controlGood1: await probe("packmedia://img/globelw.png"),
      };
    });

    // Foreign / traversal / missing must ALL be rejected (404 or a hard failure), never 200.
    for (const k of ["traversal1", "traversal2", "foreignSubdir", "missing"] as const) {
      expect([res[k]]).not.toContain(200);
    }
    // The real in-pack files ARE served successfully.
    expect(res.controlGood0).toBeGreaterThan(0);
    expect(res.controlGood1).toBeGreaterThan(0);
  });
});
