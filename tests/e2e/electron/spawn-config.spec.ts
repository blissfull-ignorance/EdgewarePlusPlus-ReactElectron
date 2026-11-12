import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
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

  test("the delay slider is reachable in Popup Tweaks", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-config']").click();
    await window.getByRole("tab", { name: "Annoyance / Runtime" }).click();
    await window.getByRole("tab", { name: "Popup Tweaks" }).click();
    await expect(window.locator("[data-testid='config-spawn-delay']")).toBeVisible();
    await window.locator("[data-testid='main-tab-status']").click();
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
});
