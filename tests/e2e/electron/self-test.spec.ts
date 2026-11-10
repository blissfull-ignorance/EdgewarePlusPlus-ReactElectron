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

test.describe("Bundled Lua API self-test (user-runnable)", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState({ kind: "media" });
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
      delay: 60000,
    });
    running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("runSelfTest executes the bundled edgeware_v0 script to completion", async () => {
    const result = await running!.window.evaluate(() =>
      (
        window as unknown as {
          api: { scripting: { runSelfTest: () => Promise<{ ok: boolean; error?: string }> } };
        }
      ).api.scripting.runSelfTest()
    );
    expect(result).toEqual({ ok: true });

    // The script's synchronous markers and its delayed close_popups chain.
    await expect
      .poll(() => mainLog(state!), { timeout: 30000 })
      .toContain("API-TEST done");
    await expect
      .poll(() => mainLog(state!))
      .toContain("API-TEST corrupt");
  });

  test("the self-test button is present in Troubleshooting", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await window.getByRole("tab", { name: "Troubleshooting" }).click();
    await expect(window.locator("[data-testid='run-lua-self-test']")).toBeVisible({ timeout: 10000 });
  });
});
