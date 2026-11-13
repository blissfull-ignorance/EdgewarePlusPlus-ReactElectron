import { expect, test, afterEach } from "@playwright/test";
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
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    mitosisMode: 0,
    notificationChance: 100,
    notificationImageChance: 100,
    delay: 1000,
  });
  return state;
}

function notificationLog(state: ReturnType<typeof createTempState>): string {
  const logDir = path.join(state.dir, "logs");
  if (!existsSync(logDir)) return "";
  return readdirSync(logDir)
    .map((f) => {
      try {
        return readFileSync(path.join(logDir, f), "utf-8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

test.describe("notification popups (legacy send_notification roll target)", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("notification chance fires system notifications with pack text and image", async () => {
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

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });
    await running.window.locator("[data-testid='start-stop-button']").click();

    // The main process logs every shown notification; the image attachment is
    // rolled at 100% here so the "(with image)" branch must appear.
    await expect
      .poll(() => notificationLog(state).includes("Notification shown"), { timeout: 30000 })
      .toBe(true);
    await expect
      .poll(() => notificationLog(state).includes("(with image)"), { timeout: 15000 })
      .toBe(true);

    // The payload, not just the badge: the message must be the pack's own
    // caption text (the fixture's only inactive-mood caption), never a
    // hardcoded fallback.
    const quoted = [...notificationLog(state).matchAll(/Notification shown: "([^"]*)"/g)].map(
      (m) => m[1]
    );
    expect(quoted.length).toBeGreaterThan(0);
    for (const line of quoted) {
      expect(line).toContain("default caption. no mood associated.");
    }

    // Notifications open no popup windows.
    expect(running.app.windows().filter((w) => w !== running.window).length).toBe(0);
  });

  test("notification without image chance still shows, without the image marker", async () => {
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
      notificationChance: 100,
      notificationImageChance: 0,
      delay: 1000,
    });
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
    await running.window.locator("[data-testid='start-stop-button']").click();

    await expect
      .poll(() => notificationLog(state).includes("Notification shown"), { timeout: 30000 })
      .toBe(true);
    // The no-image branch: shown, and never marked "(with image)".
    expect(notificationLog(state)).not.toContain("(with image)");
  });
});
