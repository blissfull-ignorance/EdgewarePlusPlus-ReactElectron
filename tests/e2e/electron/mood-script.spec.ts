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
const MEDIA_PACK_IMG = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "img");

/**
 * Builds an Addict-Acceptance-Program-shaped pack: mood-tagged media in
 * index.json, level-keyed corruption.json whose level 1 activates the "locked"
 * mood, a config.json preset, and a script.lua that drives corrupt().
 */
function writeMoodPack(packsDir: string): string {
  const packDir = path.join(packsDir, "Mood Gate Pack");
  mkdirSync(path.join(packDir, "img"), { recursive: true });
  copyFileSync(path.join(MEDIA_PACK_IMG, "applelw.png"), path.join(packDir, "img", "free.png"));
  copyFileSync(path.join(MEDIA_PACK_IMG, "globelw.png"), path.join(packDir, "img", "locked.png"));

  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({
      name: "Mood Gate Pack",
      id: "moodgate",
      creator: "e2e",
      version: "1.0",
      description: "mood gating fixture",
    })
  );
  writeFileSync(
    path.join(packDir, "index.json"),
    JSON.stringify({
      default: {
        maxClicks: 1,
        captions: ["free caption"],
        denial: [],
        subliminals: [],
        notifications: [],
        prompts: ["type it"],
        popupClose: "Close",
      },
      moods: [
        {
          mood: "locked",
          captions: ["locked caption"],
          web: [],
          webArgs: [],
          media: ["locked.png"],
        },
      ],
    })
  );
  writeFileSync(
    path.join(packDir, "corruption.json"),
    JSON.stringify({
      moods: { "1": { add: ["locked"], remove: [] } },
      wallpapers: {},
      config: {},
    })
  );
  writeFileSync(
    path.join(packDir, "config.json"),
    JSON.stringify({ delay: 123, movingChance: 0, version: "9.9", packPath: "/nowhere" })
  );
  writeFileSync(
    path.join(packDir, "script.lua"),
    'require("edgeware_v0")\nprint("MOODGATE-SCRIPT ran")\ncorrupt()\n'
  );
  return packDir;
}

let state: TempState | null = null;
let running: RunningApp | null = null;
let packDir = "";

async function randomImages(count: number): Promise<string[]> {
  return running!.window.evaluate((n) => {
    const api = (window as unknown as {
      api: { pack: { randomImage: () => Promise<string | null> } };
    }).api;
    return Promise.all(Array.from({ length: n }, () => api.pack.randomImage()));
  }, count).then((list) => list.filter((f): f is string => !!f));
}

test.describe("Pack moods, preset and script auto-run (AAP-shaped pack)", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    packDir = writeMoodPack(state.packsDir);
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

  test("mood-tagged media stays locked while its mood is inactive", async () => {
    await running!.window.evaluate(() =>
      (window as unknown as { api: { pack: { setActiveMoods: (m: string[]) => Promise<void> } } }).api.pack.setActiveMoods([])
    );
    const picks = await randomImages(40);
    expect(picks.length).toBe(40);
    expect(picks).not.toContain("locked.png");
    expect(picks).toContain("free.png");
  });

  test("activating the mood unlocks its media pool", async () => {
    await running!.window.evaluate(() =>
      (window as unknown as { api: { pack: { setActiveMoods: (m: string[]) => Promise<void> } } }).api.pack.setActiveMoods(["locked"])
    );
    const picks = await randomImages(40);
    expect(picks).toContain("locked.png");
  });

  test("the pack mood catalogue is visible to the moods panel", async () => {
    const moods = await running!.window.evaluate(() =>
      (window as unknown as { api: { pack: { listMoods: () => Promise<unknown> } } }).api.pack.listMoods()
    );
    expect(moods).toEqual([{ name: "locked", mediaCount: 1, captionCount: 1 }]);
  });

  test("the pack config.json surfaces as a preset without version markers", async () => {
    const preset = await running!.window.evaluate(() =>
      (window as unknown as { api: { pack: { loadPackConfig: () => Promise<Record<string, unknown> | null> } } }).api.pack.loadPackConfig()
    );
    expect(preset).toEqual({ delay: 123, movingChance: 0 });
  });

  test("the Start tab offers the pack preset and applying it updates settings", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await window.getByRole("tab", { name: "Start" }).click();
    const apply = window.locator("[data-testid='apply-pack-preset']");
    await expect(apply).toBeVisible({ timeout: 10000 });
    await apply.click();
    await expect(window.locator("[data-testid='preset-applied']")).toBeVisible();
    const delay = await window.evaluate(
      () =>
        (
          (window as unknown as {
            __settingsStore: { getState: () => { delay: number } };
          }).__settingsStore.getState().delay
        )
    );
    expect(delay).toBe(123);
    await window.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
  });

  test("Start auto-runs script.lua, which advances corruption and unlocks the mood end to end", async () => {
    const { window } = running!;
    await window.evaluate(() =>
      (window as unknown as { api: { pack: { setActiveMoods: (m: string[]) => Promise<void> } } }).api.pack.setActiveMoods([])
    );

    await window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(
        () =>
          window.evaluate(() =>
            (window as unknown as { api: { corruption: { getCurrentLevel: () => Promise<number> } } }).api.corruption.getCurrentLevel()
          ),
        { timeout: 30000 }
      )
      .toBeGreaterThanOrEqual(1);

    // The script's corrupt() → injection → renderer applied level 1, whose
    // active moods are mirrored back into the main process.
    const picks = await randomImages(60);
    expect(picks).toContain("locked.png");

    await window.locator("[data-testid='start-stop-button']").click();
  });
});
