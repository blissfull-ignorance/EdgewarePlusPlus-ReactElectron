import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
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


let state: TempState | null = null;
let running: RunningApp | null = null;

function configDelay(): Promise<number> {
  return running!.window.evaluate(
    () => (window as unknown as { __settingsStore: { getState: () => { delay: number } } }).__settingsStore.getState().delay
  );
}

test.describe("Session-scoped pack config + spawn warning", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
    // Level 1 flips delay to 2500ms (at or above the legacy danger floor of
    // 2000, so no danger modal interferes) and popupMod stays as-is.
    writeFileSync(
      path.join(state.seedPath, "corruption.json"),
      JSON.stringify({
        moods: { "1": { add: [], remove: [] } },
        wallpapers: {},
        config: { "1": { delay: 2500 } },
      })
    );
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
      showLoadingFlair: 0,
      corruptionMode: 1,
      corruptionFullPerm: 1,
      corruptionTrigger: "Script",
      delay: 60000,
    });
    running = await launchApp(state, {
      EDGWARE_STUB_BROWSER: "1",
      EDGWARE_PANIC_SKIP_WALLPAPER: "1",
    });
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("pack level config applies during the session and is reverted on Stop", async () => {
    const { window } = running!;
    expect(await configDelay()).toBe(60000);

    await window.locator("[data-testid='start-stop-button']").click();
    // The script-less session still applies level 1 via the start baseline;
    // drive the transition explicitly like a scripted corrupt() would.
    await window.evaluate(() =>
      (window as unknown as { api: { scripting: { advanceLevel: () => Promise<number> } } }).api.scripting.advanceLevel()
    );
    await expect(window.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
    await expect.poll(configDelay, { timeout: 30_000 }).toBe(2500);

    await window.locator("[data-testid='start-stop-button']").click();
    // Stop restores the user's own base delay — the pack cannot keep it.
    await expect.poll(configDelay, { timeout: 15_000 }).toBe(60000);
  });

  test("Start warns when leftover settings would block all popups", async () => {
    const { window } = running!;
    // Corruption off + a leftover 30s spawn delay with a live chance:
    // exactly the owner's case.
    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ corruptionMode: 0, delay: 30000, popupMod: 100 });
    });
    await window.locator("[data-testid='start-stop-button']").click();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toBeVisible();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toContainText("Spawn Delay");
    // The session did NOT start behind the modal.
    await expect(window.locator("[data-testid='start-stop-button']")).toHaveText("Start");

    // "Start anyway" proceeds.
    await window.locator("[data-testid='spawn-warning-start']").click();
    await expect(window.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
    await window.locator("[data-testid='start-stop-button']").click();

    // "Open settings" navigates to the popup tweaks area.
    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ delay: 30000 });
    });
    await window.locator("[data-testid='start-stop-button']").click();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toBeVisible();
    await window.locator("[data-testid='spawn-warning-settings']").click();
    await expect(window.getByRole("tab", { name: "Popup Tweaks" })).toBeVisible();
    // The deep link lands ON the tweaks panel: the slider is visible now,
    // not one more click away.
    await expect(window.locator("[data-testid='config-spawn-delay']")).toBeVisible();

    // The slider is also reachable by hand (not only via the deep link):
    // Config → Annoyance/Runtime → Popup Tweaks.
    await window.locator("[data-testid='main-tab-config']").click();
    await window.getByRole("tab", { name: "Annoyance / Runtime" }).click();
    await window.getByRole("tab", { name: "Popup Tweaks" }).click();
    await expect(window.locator("[data-testid='config-spawn-delay']")).toBeVisible();

    // A healthy setup starts without the modal.
    await window.locator("[data-testid='main-tab-status']").click();
    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ delay: 5000, popupMod: 100 });
    });
    await window.locator("[data-testid='start-stop-button']").click();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toHaveCount(0);
    await window.locator("[data-testid='start-stop-button']").click();
  });

  test("Start warns when every chance is zero on a scriptless pack", async () => {
    const { window, app } = running!;
    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({
        corruptionMode: 0,
        delay: 5000,
        popupMod: 0,
        vidMod: 0,
        audioMod: 0,
        promptMod: 0,
        capPopChance: 0,
        webMod: 0,
        notificationChance: 0,
      });
    });
    await window.locator("[data-testid='start-stop-button']").click();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toBeVisible();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toContainText(
      "Every popup chance is 0%"
    );
    // The session does not start behind the modal — and nothing spawns.
    await expect(window.locator("[data-testid='start-stop-button']")).toHaveText("Start");
    await window.waitForTimeout(2500);
    expect(app.windows().filter((w) => w.url().includes("/popup/")).length).toBe(0);

    // "Start anyway" proceeds.
    await window.locator("[data-testid='spawn-warning-start']").click();
    await expect(window.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
    await window.locator("[data-testid='start-stop-button']").click();
    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ popupMod: 100 });
    });
  });

  test("Start warns only below the 500 ms auto-close floor", async () => {
    const { window } = running!;
    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({
        corruptionMode: 0,
        delay: 5000,
        popupMod: 100,
        timeoutPopups: 1,
        popupTimeout: 499,
      });
    });
    await window.locator("[data-testid='start-stop-button']").click();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toBeVisible();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toContainText("auto-close");
    // The modal offers only "Start anyway" / "Open settings": proceed, then
    // Stop and reconfigure to the boundary value.
    await window.locator("[data-testid='spawn-warning-start']").click();
    const startStop = window.locator("[data-testid='start-stop-button']");
    await expect(startStop).toHaveText("Stop");
    await startStop.click();

    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ popupTimeout: 500 });
    });
    await startStop.click();
    await expect(window.locator("[data-testid='spawn-warning-modal']")).toHaveCount(0);
    await startStop.click();

    await window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ timeoutPopups: 0, popupMod: 100 });
    });
  });
});

test.describe("Pack config overrides survive a quit without Stop", () => {
  test("the next startup reverts config.json to the user's values", async () => {
    ensureElectronBuild();
    const state = createTempState({ kind: "media" });
    writeFileSync(
      path.join(state.seedPath, "corruption.json"),
      JSON.stringify({
        moods: { "1": { add: [], remove: [] } },
        wallpapers: {},
        config: { "1": { delay: 2500 } },
      })
    );
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
      showLoadingFlair: 0,
      corruptionMode: 1,
      corruptionFullPerm: 1,
      corruptionTrigger: "Script",
      delay: 60000,
    });
    const env = { EDGWARE_STUB_BROWSER: "1", EDGWARE_PANIC_SKIP_WALLPAPER: "1" };
    const configDelay = () =>
      JSON.parse(readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")).delay as number;

    let app = await launchApp(state, env);
    try {
      await app.window.locator("[data-testid='start-stop-button']").click();
      await expect(app.window.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
      await app.window.evaluate(() =>
        (window as unknown as { api: { scripting: { advanceLevel: () => Promise<number> } } })
          .api.scripting.advanceLevel()
      );
      await expect.poll(configDelay, { timeout: 30_000 }).toBe(2500);
      // Quit WITHOUT Stop: the mutation is on disk and the baseline is pending.
      await quitApp(app);

      app = await launchApp(state, env);
      await expect.poll(configDelay, { timeout: 15_000 }).toBe(60000);
      const storeDelay = await app.window.evaluate(
        () =>
          (
            window as unknown as { __settingsStore: { getState: () => { delay: number } } }
          ).__settingsStore.getState().delay
      );
      expect(storeDelay).toBe(60000);
    } finally {
      await quitApp(app);
      cleanupTempState(state);
    }
  });

  test("a panic hard-exit mid-session still reverts config.json on the next startup", async () => {
    ensureElectronBuild();
    const state = createTempState({ kind: "media" });
    writeFileSync(
      path.join(state.seedPath, "corruption.json"),
      JSON.stringify({
        moods: { "1": { add: [], remove: [] } },
        wallpapers: {},
        config: { "1": { delay: 2500 } },
      })
    );
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
      showLoadingFlair: 0,
      corruptionMode: 1,
      corruptionFullPerm: 1,
      corruptionTrigger: "Script",
      delay: 60000,
    });
    const env = { EDGWARE_STUB_BROWSER: "1", EDGWARE_PANIC_SKIP_WALLPAPER: "1" };
    const configDelay = () =>
      JSON.parse(readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")).delay as number;

    let app = await launchApp(state, env);
    try {
      await app.window.locator("[data-testid='start-stop-button']").click();
      await expect(app.window.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
      await app.window.evaluate(() =>
        (window as unknown as { api: { scripting: { advanceLevel: () => Promise<number> } } })
          .api.scripting.advanceLevel()
      );
      await expect.poll(configDelay, { timeout: 30_000 }).toBe(2500);

      // Panic ends in app.exit(0): before-quit AND the pagehide flush are both
      // skipped — the one exit path neither the graceful-quit nor the
      // crash-equivalent pin exercises. The baseline was persisted to disk on
      // the first override, so only the startup revert can undo the mutation.
      const closed = new Promise<void>((resolve) => {
        app.app.once("close", () => resolve());
        setTimeout(() => resolve(), 8000);
      });
      await app.window.evaluate(() => window.api?.panic.trigger()).catch(() => undefined);
      await closed;

      app = await launchApp(state, env);
      await expect.poll(configDelay, { timeout: 15_000 }).toBe(60000);
      const storeDelay = await app.window.evaluate(
        () =>
          (
            window as unknown as { __settingsStore: { getState: () => { delay: number } } }
          ).__settingsStore.getState().delay
      );
      expect(storeDelay).toBe(60000);
    } finally {
      await quitApp(app);
      cleanupTempState(state);
    }
  });
});

test.describe("Pack config cannot inject or strand unknown values", () => {
  test("unknown config keys are never applied; array values revert after a hard exit", async () => {
    ensureElectronBuild();
    const state = createTempState({ kind: "media" });
    writeFileSync(
      path.join(state.seedPath, "corruption.json"),
      JSON.stringify({
        moods: { "1": { add: [], remove: [] } },
        wallpapers: {},
        config: { "1": { delay: 2500, zzUnknownKey: 7, packFolders: "evil" } },
      })
    );
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
      showLoadingFlair: 0,
      corruptionMode: 1,
      corruptionFullPerm: 1,
      corruptionTrigger: "Script",
      delay: 60000,
      packFolders: [],
    });
    const env = { EDGWARE_STUB_BROWSER: "1", EDGWARE_PANIC_SKIP_WALLPAPER: "1" };
    const readConfig = () =>
      JSON.parse(readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")) as Record<
        string,
        unknown
      >;
    const storeValue = (app: RunningApp, key: string) =>
      app.window.evaluate(
        (k) =>
          (
            window as unknown as { __settingsStore: { getState: () => Record<string, unknown> } }
          ).__settingsStore.getState()[k],
        key
      );

    let app = await launchApp(state, env);
    try {
      await app.window.locator("[data-testid='start-stop-button']").click();
      await expect(app.window.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
      await app.window.evaluate(() =>
        (window as unknown as { api: { scripting: { advanceLevel: () => Promise<number> } } })
          .api.scripting.advanceLevel()
      );
      await expect.poll(() => storeValue(app, "delay"), { timeout: 30_000 }).toBe(2500);
      // A key outside the settings schema is never applied at all.
      expect(await storeValue(app, "zzUnknownKey")).toBeUndefined();
      expect(readConfig().zzUnknownKey).toBeUndefined();
      // Non-primitive values are session-scoped too: the hard-exit baseline
      // must carry them. Wait for the autosave to put the mutation on disk.
      await expect
        .poll(() => readConfig().packFolders, { timeout: 15_000 })
        .toBe("evil");

      // Quit WITHOUT Stop: startup revert restores the array value as well.
      await quitApp(app);
      app = await launchApp(state, env);
      await expect
        .poll(() => readConfig().delay, { timeout: 15_000 })
        .toBe(60000);
      expect(readConfig().packFolders).toEqual([]);
      expect(await storeValue(app, "packFolders")).toEqual([]);
    } finally {
      await quitApp(app);
      cleanupTempState(state);
    }
  });
});
