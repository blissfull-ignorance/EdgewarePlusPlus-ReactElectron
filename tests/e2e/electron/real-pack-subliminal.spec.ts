import { expect, test, afterEach } from "@playwright/test";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type TempState,
} from "./launch";

function seed(mode: "electron" | "inapp") {
  const state = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    popupRenderMode: mode,
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    mitosisMode: 0,
    subliminalsChance: 0,
    capPopChance: 100,
    capPopTimer: 20000,
    capPopOpacity: 100,
    delay: 1000,
  });
  return state;
}

test.describe("subliminal text popup (legacy SubliminalPopup, capPop* settings)", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("electron mode: text popup window appears with pack text", async () => {
    const state: TempState = seed("electron");
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
        async () => {
          for (const w of running.app.windows()) {
            try {
              if ((await w.locator("[data-testid='subliminal-overlay']").count()) > 0) return true;
            } catch {
              /* mid-close */
            }
          }
          return false;
        },
        { timeout: 60000 }
      )
      .toBe(true);

    const popup = running.app.windows().find(
      (w) => w !== running.window && w.url().includes("/popup/subliminal/")
    );
    expect(popup).toBeTruthy();
    const text = (await popup!.locator("[data-testid='subliminal-text']").innerText()).trim();
    expect(text.length).toBeGreaterThan(0);
  });

  test("electron mode: popup auto-closes after capPopTimer", async () => {
    const state = seed("electron");
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      popupMod: 0,
      vidMod: 0,
      audioMod: 0,
      promptMod: 0,
      webMod: 0,
      mitosisMode: 0,
      subliminalsChance: 0,
      capPopChance: 100,
      capPopTimer: 1200,
      capPopOpacity: 100,
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

    await running.window.locator("[data-testid='start-stop-button']").click();

    await expect
      .poll(
        async () =>
          running.app.windows().some((w) => w !== running.window && w.url().includes("/popup/subliminal/")),
        { timeout: 60000 }
      )
      .toBe(true);

    // The runtime keeps spawning new text pops, so auto-close is asserted on
    // the first popup window itself: its overlay must vanish (or the window
    // be gone) shortly after capPopTimer, without Stop being pressed.
    const popup = running.app
      .windows()
      .find((w) => w !== running.window && w.url().includes("/popup/subliminal/"))!;

    // Lower bound: at 400 ms into a 1200 ms timer the popup must still be
    // alive — a timer misread as 0 closes it instantly and would otherwise
    // make the disappearance check below pass vacuously.
    await popup.waitForTimeout(400);
    expect(popup.isClosed()).toBe(false);
    expect(await popup.locator("[data-testid='subliminal-overlay']").count()).toBe(1);

    await expect
      .poll(
        async () => {
          if (popup.isClosed()) return true;
          try {
            return (await popup.locator("[data-testid='subliminal-overlay']").count()) === 0;
          } catch {
            return true;
          }
        },
        { timeout: 15000 }
      )
      .toBe(true);
  });

  test("in-app mode: overlay renders pack text on the main window", async () => {
    const state = seed("inapp");
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
      .poll(async () => running.window.locator("[data-testid='subliminal-text']").count(), {
        timeout: 60000,
      })
      .toBeGreaterThan(0);
  });
});
