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

const HARMLESS_ACCEL = "CommandOrControl+Alt+Shift+F23";

function seed(overrides: Record<string, unknown> = {}): TempState {
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
    globalPanicButton: HARMLESS_ACCEL,
    panicDisabled: 0,
    timerMode: 0,
    ...overrides,
  });
  return state;
}

const PANIC_ENV = { EDGWARE_PANIC_SKIP_WALLPAPER: "1" };

test.describe("panic runtime (hotkey path, panicDisabled, lockout + safeword)", () => {
  let cleanup: Array<() => Promise<void> | void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!();
  });

  async function closedWithin(app: { once: (e: string, cb: () => void) => void }, ms: number) {
    let closed = false;
    app.once("close", () => {
      closed = true;
    });
    await new Promise((r) => setTimeout(r, ms));
    return closed;
  }

  test("panic tears down popups and quits the app", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, PANIC_ENV);

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(
        async () =>
          running.app.windows().filter((w) => w !== running.window).length,
        { timeout: 60000 }
      )
      .toBeGreaterThan(0);

    const closing = closedWithin(running.app, 8000);
    const result = await running.window
      .evaluate(() => window.api?.panic.trigger())
      .catch(() => ({ ok: true }));
    expect(result).toEqual({ ok: true });

    expect(await closing).toBe(true);
  });

  test("panicDisabled blocks the hotkey path but not the tray path", async () => {
    const state = seed({ panicDisabled: 1 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, PANIC_ENV);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    const blocked = await running.window.evaluate(() => window.api?.panic.trigger());
    expect(blocked).toEqual({ ok: false, reason: "disabled" });

    const forcedClosing = closedWithin(running.app, 8000);
    const forced = await running.window
      .evaluate(() => window.api?.panic.trigger({ respectDisabled: false }))
      .catch(() => ({ ok: true }));
    expect(forced).toEqual({ ok: true });
    expect(await forcedClosing).toBe(true);
  });

  test("lockout gates panic behind the safeword", async () => {
    const state = seed({ timerMode: 1, timerSetupTime: 5, safeword: "secret123" });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, PANIC_ENV);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.evaluate(() => {
      (window as unknown as { __panicBlocked: boolean }).__panicBlocked = false;
      window.api?.panic.onBlocked(() => {
        (window as unknown as { __panicBlocked: boolean }).__panicBlocked = true;
      });
    });

    const status = await running.window.evaluate(() => window.api?.panic.status());
    expect(status?.lockoutActive).toBe(true);

    const blocked = await running.window.evaluate(() => window.api?.panic.trigger());
    expect(blocked).toEqual({ ok: false, reason: "lockout" });
    await expect
      .poll(() =>
        running.window.evaluate(() => (window as unknown as { __panicBlocked: boolean }).__panicBlocked)
      )
      .toBe(true);

    const wrong = await running.window.evaluate(() => window.api?.panic.unlock("nope"));
    expect(wrong).toEqual({ ok: false });

    const rightClosing = closedWithin(running.app, 8000);
    const right = await running.window
      .evaluate(() => window.api?.panic.unlock("secret123"))
      .catch(() => ({ ok: true }));
    expect(right).toEqual({ ok: true });
    expect(await rightClosing).toBe(true);
  });

  test("status reports the registered accelerator and refresh picks up config", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, PANIC_ENV);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    const status = await running.window.evaluate(() => window.api?.panic.status());
    expect(status?.accelerator).toBe(HARMLESS_ACCEL);

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
      delay: 1000,
      // A second harmless combo, not bare Escape: refreshShortcut registers
      // this system-wide for the test's duration, and the suite's own rule is
      // never to hijack Escape. The "e"→Escape migration is pinned elsewhere.
      globalPanicButton: "CommandOrControl+Alt+Shift+F22",
      panicDisabled: 0,
      timerMode: 0,
    });
    const refreshed = await running.window.evaluate(() => window.api?.panic.refreshShortcut());
    expect(refreshed?.accelerator).toBe("CommandOrControl+Alt+Shift+F22");
  });
});
