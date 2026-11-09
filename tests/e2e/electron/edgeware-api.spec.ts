import { expect, test, afterEach } from "@playwright/test";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const API_SCRIPT = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "edgeware-api-test.lua");
const PANIC_SCRIPT = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "edgeware-panic-test.lua");

function mainLog(state: ReturnType<typeof createTempState>): string {
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

function seed(): ReturnType<typeof createTempState> {
  const state = createTempState({ kind: "media" });
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
  return state;
}

test.describe("edgeware_v0 Lua API (Addict Acceptance Program surface)", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("every scripted-corruption API function runs end to end", async () => {
    const state = seed();
    copyFileSync(API_SCRIPT, path.join(state.seedPath, "edgeware-api-test.lua"));
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });

    const ok = await running.window.evaluate(() =>
      window.api.scripting.runLua("edgeware-api-test.lua")
    );
    expect(ok).toBe(true);

    const markers = [
      "API-TEST require",
      "API-TEST roll",
      "API-TEST after\t1",
      "API-TEST after_chain",
      "API-TEST set_popup_close_text",
      "API-TEST image_video",
      "API-TEST audio",
      "API-TEST prompt",
      "API-TEST subliminal",
      "API-TEST web",
      "API-TEST notification",
      "API-TEST corrupt",
      "Browser open stubbed: https://example.com/",
      "API-TEST audio_on_stop",
      "API-TEST prompt_on_close",
      "API-TEST close_popups",
      "API-TEST done",
    ];
    for (const marker of markers) {
      await expect
        .poll(() => mainLog(state).includes(marker), {
          timeout: 20000,
          message: `missing log marker: ${marker}`,
        })
        .toBe(true);
    }

    // No Lua runtime errors surfaced during the whole flow.
    expect(mainLog(state)).not.toContain("Runtime error");
    expect(mainLog(state)).not.toContain("Lua callback error");
  });

  test("panic() from a script terminates the session", async () => {
    const state = seed();
    writeFileSync(
      path.join(state.seedPath, "edgeware-panic-test.lua"),
      readFileSync(PANIC_SCRIPT, "utf-8")
    );
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, { EDGWARE_PANIC_SKIP_WALLPAPER: "1" });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='pack-info']").waitFor({ timeout: 30000 });

    let closed = false;
    running.app.once("close", () => {
      closed = true;
    });

    const ok = await running.window.evaluate(() =>
      window.api.scripting.runLua("edgeware-panic-test.lua")
    );
    expect(ok).toBe(true);
    await expect
      .poll(() => mainLog(state).includes("PANIC-TEST begin"), { timeout: 10000 })
      .toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 4000));
    expect(closed).toBe(true);
  });
});
