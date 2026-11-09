import { expect, test, afterEach } from "@playwright/test";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type RunningApp,
} from "./launch";

function baseSeed(settings: Record<string, unknown>): ReturnType<typeof createTempState> {
  const state = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    popupRenderMode: "electron",
    showLoadingFlair: 0,
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    notificationChance: 0,
    subliminalsChance: 0,
    denialChance: 0,
    mitosisMode: 0,
    delay: 60000,
    ...settings,
  });
  return state;
}

async function setSettings(running: RunningApp, patch: Record<string, unknown>): Promise<void> {
  await running.window.evaluate((p) => {
    (
      window as unknown as {
        __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
      }
    ).__settingsStore.getState().setRaw(p);
  }, patch);
}

test.describe("config option behaviors", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("themeNoConfig pins the app chrome to the Original theme", async () => {
    const state = baseSeed({ themeType: "Dark", themeNoConfig: 1 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await expect
      .poll(
        () =>
          running.window.evaluate(
            () => getComputedStyle(document.body).backgroundColor
          ),
        { timeout: 10000 }
      )
      .toBe("rgb(240, 240, 240)");
  });

  test("lowkey mode pins popups to the configured corner", async () => {
    const state = baseSeed({ lkToggle: 1, lkCorner: 1, popupMod: 100, delay: 1000 });
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
      .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length, {
        timeout: 20000,
      })
      .toBeGreaterThan(0);

    const position = await running.app.evaluate(({ BrowserWindow }) => {
      const popup = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("/popup/")
      );
      return popup ? popup.getPosition() : null;
    });
    expect(position).not.toBeNull();
    // lkCorner 1 = top-left of the primary display (macOS pushes windows
    // below the menu bar, so the top edge sits at the bar's height).
    expect(position![0]).toBeLessThanOrEqual(5);
    expect(position![1]).toBeLessThanOrEqual(60);
  });

  test("runOnSaveQuit exits the app once settings are saved", async () => {
    const state = baseSeed({ runOnSaveQuit: 1 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    let closed = false;
    running.app.once("close", () => {
      closed = true;
    });

    await setSettings(running, { wallpaperVariance: 123 });
    await new Promise((r) => setTimeout(r, 9000));
    expect(closed).toBe(true);
  });

  test("panicButton arms an in-window panic hotkey", async () => {
    const state = baseSeed({ panicButton: "Key.f9" });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, { EDGWARE_PANIC_SKIP_WALLPAPER: "1" });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    let closed = false;
    running.app.once("close", () => {
      closed = true;
    });

    await running.window.locator("[data-testid='app-title']").click();
    await running.window.keyboard.press("F9");
    await new Promise((r) => setTimeout(r, 4000));
    expect(closed).toBe(true);
  });
});
