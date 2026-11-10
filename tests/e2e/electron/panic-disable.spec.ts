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
  type RunningApp,
  type TempState,
} from "./launch";

function mainLog(state: TempState): string {
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

let state: TempState | null = null;
let running: RunningApp | null = null;
let configPath = "";

test.describe("Panic disable must not swallow keys, and \"e\" migrates to Escape", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    configPath = seedConfig(state, {
      packPath: state.seedPath,
      panicDisabled: 1,
      globalPanicButton: "e",
      showLoadingFlair: 0,
      popupMod: 0,
      delay: 60000,
    });
    running = await launchApp(state);
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("a disabled panic unregisters the global shortcut instead of holding the key", async () => {
    await expect
      .poll(() => mainLog(state!), { timeout: 15000 })
      .toContain("Global panic shortcut disabled");
  });

  test("the legacy \"e\" panic key migrates to Escape and is persisted", async () => {
    await expect
      .poll(
        () => {
          const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
          return cfg.globalPanicButton;
        },
        { timeout: 15000 }
      )
      .toBe("Key.esc");

    const inStore = await running!.window.evaluate(
      () =>
        (
          (window as unknown as {
            __settingsStore: { getState: () => { globalPanicButton: string } };
          }).__settingsStore.getState().globalPanicButton
        )
    );
    expect(inStore).toBe("Key.esc");
  });
});
