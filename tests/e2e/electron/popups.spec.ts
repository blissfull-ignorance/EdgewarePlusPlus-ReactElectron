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

let state: TempState | null = null;
let running: RunningApp | null = null;

test.beforeAll(async () => {
  ensureElectronBuild();
  state = createTempState();
  seedConfig(state, {
    delay: 500,
    popupMod: 100,
    vidMod: 0,
    popupRenderMode: "electron",
  });
  running = await launchApp(state);
});

test.afterAll(async () => {
  if (running) await quitApp(running);
  cleanupTempState(state);
});

test("Start spawns a real second BrowserWindow and Stop returns the app to one", async () => {
  const { window, app } = running!;

  await expect(window.locator("[data-testid='pack-info']")).toBeVisible();
  expect(app.windows().length).toBe(1);

  await window.locator("[data-testid='start-stop-button']").click();

  await expect
    .poll(() => app.windows().length, { timeout: 30000 })
    .toBeGreaterThanOrEqual(2);

  await expect(
    window.locator("[data-testid='popup-count']"),
    { timeout: 30000 }
  ).toHaveText(/Active:\s*[1-9]/);

  await window.locator("[data-testid='start-stop-button']").click();

  await expect
    .poll(() => app.windows().length, { timeout: 30000 })
    .toBe(1);
});
