import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
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

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const AUDIO_FIXTURE = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "aud", "think.wav");

/**
 * A pack whose script drives an endless audio chain: every file that ends
 * advances the corruption level and queues the next file (the Addict-style
 * voice chain). Stop must sever the chain in the main process.
 */
function writeChainPack(packsDir: string): string {
  const packDir = path.join(packsDir, "Chain Pack");
  mkdirSync(path.join(packDir, "aud"), { recursive: true });
  copyFileSync(AUDIO_FIXTURE, path.join(packDir, "aud", "voice.wav"));
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "Chain Pack", id: "chain", creator: "e2e", version: "1.0", description: "chain" })
  );
  writeFileSync(
    path.join(packDir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: [], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" },
      moods: [],
    })
  );
  const moods: Record<string, unknown> = {};
  for (let i = 1; i <= 10; i++) moods[String(i)] = { add: [`m${i}`], remove: [] };
  writeFileSync(path.join(packDir, "corruption.json"), JSON.stringify({ moods, wallpapers: {}, config: {} }));
  writeFileSync(
    path.join(packDir, "script.lua"),
    'require("edgeware_v0")\nfunction chain()\n  corrupt()\n  audio(nil, chain)\nend\naudio(nil, chain)\n'
  );
  return packDir;
}

let state: TempState | null = null;
let running: RunningApp | null = null;

test.describe("Stop severs the scripted audio chain", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    const packDir = writeChainPack(state.packsDir);
    seedConfig(state, {
      packPath: packDir,
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
      corruptionMode: 0,
      corruptionTrigger: "Script",
      delay: 60000,
    });
    running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("the chain advances levels while running and freezes at zero after Stop", async () => {
    const { window, app } = running!;
    const audioWindows = () => app.windows().filter((w) => w.url().includes("/popup/audio"));

    await window.locator("[data-testid='start-stop-button']").click();

    // The chain is alive: each finished file advances the level.
    await expect
      .poll(
        () =>
          window.evaluate(() =>
            (
              window as unknown as { api: { corruption: { getCurrentLevel: () => Promise<number> } } }
            ).api.corruption.getCurrentLevel()
          ),
        { timeout: 30000 }
      )
      .toBeGreaterThanOrEqual(2);

    await window.locator("[data-testid='start-stop-button']").click();

    // Stop tears the session down: popups gone, level mirror reset, and no
    // new audio may spawn afterwards.
    await expect.poll(() => audioWindows().length, { timeout: 15000 }).toBe(0);
    await expect
      .poll(
        () =>
          window.evaluate(() =>
            (
              window as unknown as { api: { corruption: { getCurrentLevel: () => Promise<number> } } }
            ).api.corruption.getCurrentLevel()
          ),
        { timeout: 15000 }
      )
      .toBe(0);

    await new Promise((r) => setTimeout(r, 2500));
    expect(audioWindows().length).toBe(0);
    const level = await window.evaluate(() =>
      (
        window as unknown as { api: { corruption: { getCurrentLevel: () => Promise<number> } } }
      ).api.corruption.getCurrentLevel()
    );
    expect(level).toBe(0);
  });
});
