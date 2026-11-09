import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  type RunningApp,
  type TempState,
} from "./launch";

let state: TempState | null = null;
let running: RunningApp | null = null;

function configPath(state: TempState): string {
  return path.join(state.dir, "data", "config.json");
}

function readConfig(state: TempState): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(configPath(state), "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

test.beforeAll(async () => {
  ensureElectronBuild();
  state = createTempState();
  running = await launchApp(state);
});

test.afterAll(async () => {
  if (running) await quitApp(running);
  cleanupTempState(state);
});

test("fresh temp profile auto-selects the seeded pack and writes the real config.json", async () => {
  await expect(
    async () => {
      const cfg = readConfig(state!);
      expect(cfg, "config.json must exist in the temp profile").not.toBeNull();
      expect(cfg!.packPath).toBe(state!.seedPath);
    },
    { timeout: 30000 }
  ).toPass();
});

test("a setting changed in the UI persists across a real quit and relaunch", async () => {
  const { window } = running!;

  await window.locator("[data-testid='main-tab-config']").click();
  await expect(window.locator("[data-testid='theme-select']")).toHaveValue("Original");

  await window.locator("[data-testid='theme-select']").click();
  await window.getByRole("option", { name: "Dark", exact: true }).click();

  await expect(
    async () => {
      expect(readConfig(state!)?.themeType).toBe("Dark");
    },
    { timeout: 30000 }
  ).toPass();

  await quitApp(running!);
  running = await launchApp(state!);

  const { window: relaunchWindow } = running;
  await relaunchWindow.locator("[data-testid='main-tab-config']").click();
  await expect(relaunchWindow.locator("[data-testid='theme-select']")).toHaveValue("Dark");
  expect(readConfig(state!)?.themeType).toBe("Dark");
});
