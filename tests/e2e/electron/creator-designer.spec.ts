import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const IMG_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "img");
const AUD_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "aud");

let state: TempState | null = null;
let running: RunningApp | null = null;
let packDir = "";

function designerPack(packsDir: string): string {
  const dir = path.join(packsDir, "Designer Pack");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  mkdirSync(path.join(dir, "aud"), { recursive: true });
  copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", "one.png"));
  copyFileSync(path.join(IMG_DIR, "globelw.png"), path.join(dir, "img", "locked.png"));
  copyFileSync(path.join(AUD_DIR, "think.wav"), path.join(dir, "aud", "voice.wav"));
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "Designer Pack", id: "designer", creator: "e2e", version: "1.0", description: "d" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["base cap"], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" },
      moods: [{ mood: "hidden", captions: [], web: [], webArgs: [], media: ["locked.png"] }],
    })
  );
  return dir;
}

async function picks(n: number): Promise<Set<string>> {
  const list = await running!.window.evaluate((count) => {
    const api = (window as unknown as { api: { pack: { randomImage: () => Promise<string | null> } } }).api;
    return Promise.all(Array.from({ length: count }, () => api.pack.randomImage()));
  }, n);
  return new Set(list.filter((f): f is string => !!f));
}

async function level(): Promise<number> {
  return running!.window.evaluate(() =>
    (window as unknown as { api: { corruption: { getCurrentLevel: () => Promise<number> } } }).api.corruption.getCurrentLevel()
  );
}

test.describe("No-code corruption designer", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    packDir = designerPack(state.packsDir);
    seedConfig(state, {
      packPath: packDir,
      popupRenderMode: "electron",
      popupMod: 0,
      showLoadingFlair: 0,
      corruptionMode: 0,
      corruptionTrigger: "Script",
      delay: 60000,
    });
    running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1", EDGWARE_PANIC_SKIP_WALLPAPER: "1" });
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("coverage shows uncategorised files and the filter narrows the grid", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-creator']").click();
    await expect(window.locator("[data-testid='creator-uncategorized-label']")).toContainText("2 of 3");
    await window.locator("[data-testid='creator-uncategorized-label']").click();
    await expect(window.locator("[data-testid='creator-card-one.png']")).toBeVisible();
    await expect(window.locator("[data-testid='creator-card-voice.wav']")).toBeVisible();
    await expect(window.locator("[data-testid='creator-card-locked.png']")).toHaveCount(0);
    await window.locator("[data-testid='creator-uncategorized-label']").click();
    await expect(window.locator("[data-testid='creator-card-locked.png']")).toBeVisible();
  });

  test("renaming a mood rewrites index.json", async () => {
    const { window } = running!;
    await window.locator("[data-testid='creator-mood-rename-hidden']").click();
    await window.locator("[data-testid='creator-mood-rename-input-hidden']").fill("vault");
    await window.keyboard.press("Enter");
    await expect(window.locator("[data-testid='creator-mood-vault']")).toBeVisible();
    const index = JSON.parse(readFileSync(path.join(packDir, "index.json"), "utf-8")) as {
      moods: Array<{ mood: string; media: string[] }>;
    };
    expect(index.moods[0].mood).toBe("vault");
    expect(index.moods[0].media).toEqual(["locked.png"]);
  });

  test("a designed two-level script runs end to end: audio ends, mood unlocks", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-creator']").click();
    await expect(window.locator("[data-testid='creator-panel']")).toBeVisible();
    // locked.png is tagged "vault": invisible to the pool before the session.
    expect((await picks(40)).has("locked.png")).toBe(false);

    await window.locator("[data-testid='creator-tab-script']").click();
    await window.locator("[data-testid='designer-start-delay']").fill("0");
    await window.locator("[data-testid='designer-add-level']").click();
    await window.locator("[data-testid='designer-add-level']").click();

    // Level 1: advance when voice.wav ends.
    await window.locator("[data-testid='designer-advance-0']").getByText("When audio ends").click();
    // Mantine puts data-testid on the Select's input itself.
    await window.locator("[data-testid='designer-advance-audio-0']").click();
    await window.locator("[role='option']", { hasText: "voice.wav" }).click();

    // Level 2: activate the "vault" mood, final level.
    await window.locator(`[data-testid='designer-add-1-vault']`).click();

    await window.locator("[data-testid='designer-save']").click();
    await expect(window.locator("[data-testid='designer-status']")).toContainText("Saved");

    const lua = readFileSync(path.join(packDir, "script.lua"), "utf-8");
    expect(lua).toContain("EDGWARE-DESIGNER");
    expect(lua).toContain('audio("voice.wav", function() level2() end)');
    const corruption = JSON.parse(readFileSync(path.join(packDir, "corruption.json"), "utf-8")) as {
      moods: Record<string, { add: string[] }>;
    };
    expect(corruption.moods["2"].add).toEqual(["vault"]);

    // Start: level 1 runs, audio plays once, ends → level 2 → mood unlocks.
    await window.locator("[data-testid='main-tab-status']").click();
    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(level, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
    await expect
      .poll(async () => (await picks(40)).has("locked.png"), { timeout: 15000 })
      .toBe(true);

    await window.locator("[data-testid='start-stop-button']").click();
    // Stopped: the mood releases and the pool re-locks.
    await expect
      .poll(async () => (await picks(40)).has("locked.png"), { timeout: 15000 })
      .toBe(false);
  });

  test("the design reopens losslessly in the visual editor", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-creator']").click();
    await expect(window.locator("[data-testid='creator-panel']")).toBeVisible();
    await window.locator("[data-testid='creator-tab-script']").click();
    await expect(window.locator("[data-testid='designer-level-0']")).toBeVisible();
    await expect(window.locator("[data-testid='designer-level-1']")).toBeVisible();
    await expect(window.locator("[data-testid='designer-add-1-vault']")).toBeVisible();
  });
});
