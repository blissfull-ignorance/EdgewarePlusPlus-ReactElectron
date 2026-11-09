import { expect, test } from "@playwright/test";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  listPacksViaBridge,
  quitApp,
  type RunningApp,
  type TempState,
} from "./launch";

let state: TempState | null = null;
let running: RunningApp | null = null;

test.beforeAll(async () => {
  ensureElectronBuild();
  state = createTempState();
  running = await launchApp(state);
});

test.afterAll(async () => {
  if (running) await quitApp(running);
  cleanupTempState(state);
});

test("launches and renders the styled app shell in a single real window", async () => {
  const { window, app } = running!;

  await expect(window.locator("[data-testid='app-title']")).toHaveText("Edgeware++");
  await expect(window.locator("[data-testid='metadata-panel']")).toBeVisible();
  await expect(window.locator("[data-testid='main-tabs']")).toBeVisible();

  const probe = await window.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const mantineVar = rootStyle.getPropertyValue("--mantine-color-blue-6").trim();
    const header = document.querySelector("header");
    const headerBg = header ? getComputedStyle(header).backgroundColor : "";
    return { mantineVar, headerBg };
  });

  expect(probe.mantineVar, "Mantine stylesheet must be loaded").not.toBe("");
  expect(probe.headerBg, "branded header must be styled, not plain HTML").not.toBe("rgba(0, 0, 0, 0)");
  expect(app.windows().length).toBe(1);
});

test("discovers the seeded pack from the isolated temp library via the real bridge", async () => {
  const { window } = running!;
  const packs = await listPacksViaBridge(window);

  expect(packs, "window.api must be the real preload bridge (not the renderer stub)").not.toBeNull();
  expect(packs!.length).toBeGreaterThanOrEqual(1);

  const seeded = packs!.find((p) => p.path === state!.seedPath);
  expect(seeded, "seeded pack must be discovered").toBeTruthy();
  expect(seeded!.path.startsWith(state!.dir)).toBe(true);
  expect(seeded!.name).toBe(state!.seedDisplayName);

  const bridgePath = packs!.find((p) => p.path.startsWith(state!.dir))?.path ?? "";
  expect(bridgePath).not.toBe("");

  await expect(window.locator("[data-testid='pack-info']")).toBeVisible();
  expect((await window.locator("[data-testid='pack-info']").textContent()) ?? "").toContain(state!.seedDisplayName);
  const packPathText = (await window.locator("[data-testid='pack-path']").textContent()) ?? "";
  expect(packPathText.startsWith(state!.dir)).toBe(true);
});
