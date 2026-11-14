import { expect, test } from "@playwright/test";
import { copyFileSync, writeFileSync } from "node:fs";
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

// Generator-shaped script (the designer emits the edgeware_levels registry):
// level 1 chains think.wav into a delayed think3.wav link and
// advances to level 2 only after 30s; level 2 plays think2.wav. A manual
// skip must cancel the pending chain and resume level 2 immediately.
const SCRIPT = [
  'require("edgeware_v0")',
  "",
  "local function level2()",
  "  corrupt()",
  '  audio("think2.wav")',
  "end",
  "",
  "local function level1()",
  "  corrupt()",
  '  audio("think.wav", function()',
  "    after(4000, function()",
  '      audio("think3.wav")',
  "    end)",
  "  end)",
  "  after(30000, level2)",
  "end",
  "",
  "edgeware_levels = { level1, level2 }",
  "after(500, level1)",
  "",
].join("\n");

function audioMediaIds(app: RunningApp["app"]): Promise<string[]> {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .map((w) => w.webContents.getURL())
      .map((u) => /#\/popup\/audio\/([^/]+)\//.exec(u)?.[1] ?? "")
      .filter(Boolean)
  );
}

test("skip ends the current audio chain and resumes the next level", async () => {
  ensureElectronBuild();
  const state: TempState = createTempState({ kind: "media" });
  const dir = state.seedPath;
  const aud = path.join(dir, "aud");
  copyFileSync(path.join(aud, "think.wav"), path.join(aud, "think2.wav"));
  copyFileSync(path.join(aud, "think.wav"), path.join(aud, "think3.wav"));
  writeFileSync(path.join(dir, "script.lua"), SCRIPT);
  seedConfig(state, {
    packPath: dir,
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    corruptionMode: 0,
    corruptionTrigger: "Script",
    delay: 60000,
  });
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    const { window, app } = running;
    const level = () =>
      window.evaluate(() =>
        (
          window as unknown as {
            api: { corruption: { getCurrentLevel: () => Promise<number> } };
          }
        ).api.corruption.getCurrentLevel()
      );

    await window.locator("[data-testid='start-stop-button']").click();

    // Level 1 starts: the first voice pops.
    await expect
      .poll(async () => (await audioMediaIds(app)).filter((m) => m === "think.wav").length, {
        timeout: 20000,
      })
      .toBeGreaterThanOrEqual(1);
    expect(await level()).toBe(1);

    // Skip: the chain must die here, the next level must start now.
    await window.evaluate(() =>
      (
        window as unknown as { api: { scripting: { advanceLevel: () => Promise<number> } } }
      ).api.scripting.advanceLevel()
    );

    await expect.poll(level, { timeout: 5000 }).toBe(2);
    await expect
      .poll(async () => (await audioMediaIds(app)).filter((m) => m === "think2.wav").length, {
        timeout: 5000,
      })
      .toBeGreaterThanOrEqual(1);

    // The cancelled link (due 4s after the first voice) never plays, and
    // the abandoned 30s advance never fires.
    await window.waitForTimeout(6000);
    const ids = await audioMediaIds(app);
    expect(ids.filter((m) => m === "think3.wav")).toHaveLength(0);

    await window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
