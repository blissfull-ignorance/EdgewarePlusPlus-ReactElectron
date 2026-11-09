import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

function seed(): ReturnType<typeof createTempState> {
  const state = createTempState({ kind: "media" });
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
    delay: 1000,
  });
  return state;
}

function packDisplayName(state: ReturnType<typeof createTempState>): string {
  try {
    const info = JSON.parse(readFileSync(path.join(state.seedPath, "info.json"), "utf-8")) as {
      name?: unknown;
    };
    if (typeof info.name === "string" && info.name) return info.name;
  } catch {
    /* fall through */
  }
  return state.seedName;
}

test.describe("media blacklist (alt+click close moves the file out of the pack)", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  test.afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("alt+clicking close blacklists the shown image and it never spawns again", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();

    await expect
      .poll(
        async () =>
          running.app
            .windows()
            .filter((w) => w !== running.window && w.url().includes("/popup/image/")).length,
        { timeout: 60000 }
      )
      .toBeGreaterThan(0);

    const popup = running.app
      .windows()
      .find((w) => w !== running.window && w.url().includes("/popup/image/"))!;
    const mediaId = decodeURIComponent(popup.url().split("/popup/image/")[1].split("/")[0]);
    const srcFile = path.join(state.seedPath, "img", mediaId);
    expect(existsSync(srcFile)).toBe(true);

    await popup.keyboard.down("Alt");
    await popup.locator("[data-testid='close-button']").click();
    // The click closes the popup window, so releasing Alt on it may already
    // target a destroyed page; the modifier state is irrelevant afterwards.
    await popup.keyboard.up("Alt").catch(() => undefined);

    const blacklistDir = path.join(
      state.dir,
      "data",
      "blacklist",
      packDisplayName(state).split(/\s+/).join("")
    );

    await expect
      .poll(() => existsSync(path.join(blacklistDir, mediaId)), { timeout: 10000 })
      .toBe(true);
    expect(existsSync(srcFile)).toBe(false);

    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const next = (await running.window.evaluate(() => window.api?.pack.randomImage())) ?? "";
      if (next) seen.add(next);
    }
    expect(seen.size).toBeGreaterThan(0);
    expect(seen.has(mediaId)).toBe(false);

    const remaining = readdirSync(path.join(state.seedPath, "img"));
    expect(remaining).not.toContain(mediaId);
  });

  test("plain click closes without blacklisting", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();

    await expect
      .poll(
        async () =>
          running.app
            .windows()
            .filter((w) => w !== running.window && w.url().includes("/popup/image/")).length,
        { timeout: 60000 }
      )
      .toBeGreaterThan(0);

    const popup = running.app
      .windows()
      .find((w) => w !== running.window && w.url().includes("/popup/image/"))!;
    const mediaId = decodeURIComponent(popup.url().split("/popup/image/")[1].split("/")[0]);

    await popup.locator("[data-testid='close-button']").click();

    await expect
      .poll(() => existsSync(path.join(state.seedPath, "img", mediaId)), { timeout: 10000 })
      .toBe(true);
    expect(existsSync(path.join(state.dir, "data", "blacklist"))).toBe(false);
  });
});
