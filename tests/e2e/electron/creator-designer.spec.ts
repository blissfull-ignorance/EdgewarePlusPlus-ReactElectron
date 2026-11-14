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
      vidMod: 0,
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
    await window.locator("[data-testid='main-tab-tagging']").click();
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
    await window.locator("[data-testid='main-tab-tagging']").click();
    await expect(window.locator("[data-testid='creator-tagging']")).toBeVisible();
    // locked.png is tagged "vault": invisible to the pool before the session.
    expect((await picks(40)).has("locked.png")).toBe(false);

    await window.locator("[data-testid='main-tab-designer']").click();
    await window.locator("[data-testid='designer-start-delay']").fill("0");
    await window.locator("[data-testid='designer-add-level']").click();
    await window.locator("[data-testid='designer-add-level']").click();

    // Level 1: advance when voice.wav ends.
    await window.locator("[data-testid='designer-advance-0']").getByText("When audio ends").click();
    // Mantine puts data-testid on the Select's input itself.
    await window.locator("[data-testid='designer-advance-audio-0']").click();
    await window.locator("[role='option']", { hasText: "voice.wav" }).click();

    // Level 1 also sets a wallpaper.
    await window.locator("[data-testid='designer-wallpaper-0']").click();
    // Both level cards mount a wallpaper dropdown; only the open one is visible.
    await window.locator("[role='option']:visible", { hasText: "one.png" }).click();

    // Level 2: activate the "vault" mood, final level.
    await window.locator(`[data-testid='designer-add-1-vault']`).click();

    await window.locator("[data-testid='designer-save']").click();
    await expect(window.locator("[data-testid='designer-status']")).toContainText("Saved");

    const lua = readFileSync(path.join(packDir, "script.lua"), "utf-8");
    expect(lua).toContain("EDGWARE-DESIGNER");
    expect(lua).toContain('audio("voice.wav", function() level2() end)');
    const corruption = JSON.parse(readFileSync(path.join(packDir, "corruption.json"), "utf-8")) as {
      moods: Record<string, { add: string[]; wallpaper?: string }>;
    };
    expect(corruption.moods["2"].add).toEqual(["vault"]);
    // The runtime reads the level wallpaper from the mood entry, pack-relative.
    expect(corruption.moods["1"].wallpaper).toBe("img/one.png");

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

  test("mood renames reach the designed artifacts; removal warns in the editor", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-tagging']").click();
    await expect(window.locator("[data-testid='creator-tagging']")).toBeVisible();
    // Rename vault -> cellar from the tagging view.
    await window.locator("[data-testid='main-tab-tagging']").click();
    await window.locator("[data-testid='creator-mood-rename-vault']").click();
    await window.locator("[data-testid='creator-mood-rename-input-vault']").fill("cellar");
    await window.keyboard.press("Enter");
    await expect(window.locator("[data-testid='creator-mood-cellar']")).toBeVisible();

    // The rename propagated to both designed artifacts on disk.
    await expect
      .poll(() => readFileSync(path.join(packDir, "corruption.json"), "utf-8"))
      .toContain("cellar");
    expect(readFileSync(path.join(packDir, "corruption.json"), "utf-8")).not.toContain("vault");
    expect(readFileSync(path.join(packDir, "script.lua"), "utf-8")).toContain("cellar");

    // The designer's level card now offers the renamed mood.
    await window.locator("[data-testid='main-tab-designer']").click();
    await expect(window.locator("[data-testid='designer-add-1-cellar']")).toBeVisible();

    // Removing a mood the design still references (with unsaved edits)
    // leaves a visible stale reference, not a silent one.
    await window.locator("[data-testid='main-tab-designer']").click();
    await window.locator("[data-testid='designer-add-level']").click();
    await window.locator("[data-testid='main-tab-tagging']").click();
    await window.locator("[data-testid='creator-mood-remove-cellar']").click();
    await expect(window.locator("[data-testid='creator-mood-cellar']")).toHaveCount(0);
    await window.locator("[data-testid='main-tab-designer']").click();
    await expect(window.locator("[data-testid='designer-stale-1-cellar']")).toBeVisible();
    await expect(window.locator("[data-testid='designer-warnings']")).toContainText("cellar");

    // Clicking the ghost chip drops the stale reference.
    await window.locator("[data-testid='designer-stale-1-cellar']").click();
    await expect(window.locator("[data-testid='designer-stale-1-cellar']")).toHaveCount(0);
    await expect(window.locator("[data-testid='designer-warnings']")).toHaveCount(0);
  });

  test("duplicate, per-level intensity and Save & test run", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-designer']").click();
    await expect(window.locator("[data-testid='designer-level-1']")).toBeVisible();
    await window.locator("[data-testid='designer-level-duplicate-0']").click();
    await expect(window.locator("[data-testid='designer-level-2']")).toBeVisible();

    await window.locator("[data-testid='designer-popupmod-0']").fill("50");

    await window.locator("[data-testid='designer-test-run']").click();
    await expect(window.locator("[data-testid='designer-status']")).toContainText("Saved");

    const corruption = JSON.parse(readFileSync(path.join(packDir, "corruption.json"), "utf-8")) as {
      moods: Record<string, { add: string[] }>;
      config: Record<string, { popupMod?: number }>;
    };
    expect(corruption.config["1"].popupMod).toBe(50);
    expect(corruption.moods["3"].add).toEqual([]);

    // The saved script runs immediately: level 1 corrupts within seconds.
    await expect.poll(level, { timeout: 30000 }).toBeGreaterThanOrEqual(1);

    // Stop through the real button: the test run must be user-stoppable and
    // the session must not leak into the next test.
    const startStop = window.locator("[data-testid='start-stop-button']");
    await expect(startStop).toHaveText("Stop");
    await startStop.click();
    await expect(startStop).toHaveText("Start");
  });

  test("the design reopens losslessly in the visual editor", async () => {
    const { window } = running!;
    // Real unmount: leave Creator, then come back and reload from disk.
    await window.locator("[data-testid='main-tab-status']").click();
    await expect(window.locator("[data-testid='creator-tagging']")).toHaveCount(0);
    await window.locator("[data-testid='main-tab-tagging']").click();
    await expect(window.locator("[data-testid='creator-tagging']")).toBeVisible();
    await window.locator("[data-testid='main-tab-designer']").click();
    await expect(window.locator("[data-testid='designer-level-0']")).toBeVisible();
    await expect(window.locator("[data-testid='designer-level-1']")).toBeVisible();
    await expect(window.locator("[data-testid='designer-level-2']")).toBeVisible();
    await expect(window.locator("[data-testid='designer-popupmod-0']")).toHaveValue("50 %");
  });
});

test.describe("Designer editing aids: undo, mood progression, pack-root wallpapers", () => {
  let st: TempState | null = null;
  let run: RunningApp | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    st = createTempState();
    const dir = path.join(st.packsDir, "Aids Pack");
    mkdirSync(path.join(dir, "img"), { recursive: true });
    copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", "one.png"));
    // A wallpaper at the pack ROOT — the legacy convention that used to
    // warn as "not in the pack" despite resolving fine at runtime.
    copyFileSync(path.join(IMG_DIR, "globelw.png"), path.join(dir, "wallpapergood.png"));
    writeFileSync(
      path.join(dir, "info.json"),
      JSON.stringify({ name: "Aids Pack", id: "aids", creator: "e2e", version: "1", description: "d" })
    );
    writeFileSync(
      path.join(dir, "index.json"),
      JSON.stringify({
        default: { maxClicks: 1, captions: ["c"], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" },
        moods: [
          { mood: "alpha", captions: [], web: [], webArgs: [], media: [] },
          { mood: "beta", captions: [], web: [], webArgs: [], media: [] },
        ],
      })
    );
    seedConfig(st, {
      packPath: dir,
      popupRenderMode: "electron",
      popupMod: 0,
      showLoadingFlair: 0,
      corruptionMode: 0,
      corruptionTrigger: "Script",
      delay: 60000,
    });
    run = await launchApp(st, { EDGWARE_STUB_BROWSER: "1", EDGWARE_PANIC_SKIP_WALLPAPER: "1" });
    const { window } = run;
    await window.locator("[data-testid='main-tab-tagging']").click();
    await window.locator("[data-testid='main-tab-designer']").click();
    await expect(window.locator("[data-testid='creator-designer']")).toBeVisible();
  });

  test.afterAll(async () => {
    if (run) await quitApp(run);
    cleanupTempState(st);
  });

  test("undo steps back through level edits", async () => {
    const { window } = run!;
    await expect(window.locator("[data-testid='designer-undo']")).toBeDisabled();
    await window.locator("[data-testid='designer-add-level']").click();
    await expect(window.locator("[data-testid='designer-level-0']")).toBeVisible();
    await window.locator("[data-testid='designer-undo']").click();
    await expect(window.locator("[data-testid='designer-level-0']")).toHaveCount(0);
    await expect(window.locator("[data-testid='designer-undo']")).toBeDisabled();
  });

  test("each level shows the cumulative moods active after it", async () => {
    const { window } = run!;
    await window.locator("[data-testid='designer-add-level']").click();
    await window.locator("[data-testid='designer-add-level']").click();
    await window.locator("[data-testid='designer-add-0-alpha']").click();
    await window.locator("[data-testid='designer-add-1-beta']").click();
    await window.locator("[data-testid='designer-remove-1-alpha']").click();

    const l0 = window.locator("[data-testid='designer-active-moods-0']");
    await expect(l0).toContainText("alpha");
    await expect(l0).not.toContainText("beta");
    const l1 = window.locator("[data-testid='designer-active-moods-1']");
    await expect(l1).toContainText("beta");
    await expect(l1).not.toContainText("alpha");

    // Undo the last chip toggle: beta alone remains active at level 2.
    await window.locator("[data-testid='designer-undo']").click();
    await expect(l1).toContainText("alpha");
    await expect(l1).toContainText("beta");
  });

  test("a pack-root wallpaper is accepted without a false warning", async () => {
    const { window } = run!;
    await window.locator("[data-testid='designer-wallpaper-0']").click();
    // Both level cards mount a wallpaper dropdown; only the open one shows.
    await window
      .locator("[role='option']:visible", { hasText: "wallpapergood.png (pack root)" })
      .click();
    await expect(window.locator("[data-testid='designer-warnings']")).toHaveCount(0);
    // The stored reference keeps the legacy "./" root convention.
    await window.locator("[data-testid='designer-save']").click();
    await expect(window.locator("[data-testid='designer-status']")).toContainText("Saved");
    const corruption = JSON.parse(readFileSync(path.join(st!.packsDir, "Aids Pack", "corruption.json"), "utf-8")) as {
      moods: Record<string, { wallpaper?: string }>;
    };
    expect(corruption.moods["1"].wallpaper).toBe("./wallpapergood.png");
  });
});
