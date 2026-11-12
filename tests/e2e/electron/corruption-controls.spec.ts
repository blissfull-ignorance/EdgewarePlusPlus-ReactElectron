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
const IMG_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "img");

let state: TempState | null = null;
let running: RunningApp | null = null;

function controlsPack(packsDir: string): string {
  const dir = path.join(packsDir, "Controls Pack");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  for (const f of ["one.png", "two.png", "three.png"]) {
    // Real media so pool gating behaves like production.
    copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", f));
  }
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "Controls Pack", id: "controls", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["c"] },
      moods: [
        { mood: "m1", captions: [], media: ["one.png"] },
        { mood: "m2", captions: [], media: ["two.png"] },
        { mood: "m3", captions: [], media: ["three.png"] },
      ],
    })
  );
  // Legacy shape: wallpapers as a separate top-level map.
  writeFileSync(
    path.join(dir, "corruption.json"),
    JSON.stringify({
      moods: {
        "1": { add: ["m1"], remove: [] },
        "2": { add: ["m2"], remove: [] },
        "3": { add: ["m3"], remove: [] },
      },
      wallpapers: { "2": "img/two.png" },
      config: {},
    })
  );
  return dir;
}

async function levelText(): Promise<string> {
  return running!.window.locator("[data-testid='corruption-level']").innerText();
}

test.describe("Corruption controls: max level, start level, skip", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    const packDir = controlsPack(state.packsDir);
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
      corruptionMode: 1,
      corruptionFullPerm: 1,
      corruptionTrigger: "Timed",
      // Long enough that no automatic transition interferes with the test.
      corruptionTime: 600000,
      delay: 60000,
    });
    running = await launchApp(state, {
      EDGWARE_STUB_BROWSER: "1",
      EDGWARE_PANIC_SKIP_WALLPAPER: "1",
    });
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("start-at-level jumps the session there with cumulative moods", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-config']").click();
    await window.getByRole("tab", { name: "Corruption" }).click();
    await window.locator("[data-testid='corruption-start-level']").fill("2");
    await window.locator("[data-testid='main-tab-status']").click();

    await window.locator("[data-testid='start-stop-button']").click();
    // Levels 1 and 2 applied in order: both moods active, level shows the max.
    await expect(window.locator("[data-testid='corruption-level']")).toContainText("2 / 3", {
      timeout: 30_000,
    });
    const moods = window.locator("[data-testid='active-mood']");
    await expect(moods).toHaveCount(2);
    await expect(moods.nth(0)).toContainText("m1");
    await expect(moods.nth(1)).toContainText("m2");
  });

  test("skip advances one level and the card shows the maximum", async () => {
    const { window } = running!;
    await expect(window.locator("[data-testid='corruption-skip']")).toBeVisible();
    await window.locator("[data-testid='corruption-skip']").click();
    await expect.poll(levelText, { timeout: 30_000 }).toContain("3 / 3");
    await expect(window.locator("[data-testid='active-mood']")).toHaveCount(3);
    // At the maximum there is nothing left to skip to.
    await expect(window.locator("[data-testid='corruption-skip']")).toHaveCount(0);
  });

  test("stopping and restarting with the override resumes at level 2", async () => {
    const { window } = running!;
    await window.locator("[data-testid='start-stop-button']").click();
    await expect(window.locator("[data-testid='corruption-level']")).toContainText("0");
    await window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(levelText, { timeout: 30_000 }).toContain("2 / 3");
    await window.locator("[data-testid='start-stop-button']").click();
  });
});
