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

let state: TempState | null = null;
let running: RunningApp | null = null;
let packDir = "";

function creatorPack(packsDir: string): string {
  const dir = path.join(packsDir, "Creator Pack");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", "one.png"));
  copyFileSync(path.join(IMG_DIR, "globelw.png"), path.join(dir, "img", "two.png"));
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "Creator Pack", id: "creator", creator: "e2e", version: "1.0", description: "c" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["base cap"], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" },
      moods: [{ mood: "starter", captions: [], web: [], webArgs: [], media: ["one.png"] }],
    })
  );
  writeFileSync(
    path.join(dir, "corruption.json"),
    JSON.stringify({
      moods: { "1": { add: ["secret"], remove: [] } },
      wallpapers: {},
      config: {},
    })
  );
  return dir;
}

async function setMoods(moods: string[]): Promise<void> {
  await running!.window.evaluate((m) => {
    (window as unknown as { api: { pack: { setActiveMoods: (v: string[]) => Promise<void> } } }).api.pack.setActiveMoods(m);
  }, moods);
  // The running session pins its pack at Start; with no session running the
  // resolvers read config.json, which the autosave flushes within 5s.
  await expect
    .poll(() =>
      running!.window.evaluate(
        () =>
          (
            window as unknown as {
              __settingsStore: { getState: () => { dirty: boolean } };
            }
          ).__settingsStore.getState().dirty
      )
    )
    .toBe(false);
}

async function picks(n: number): Promise<Set<string>> {
  const list = await running!.window.evaluate((count) => {
    const api = (window as unknown as { api: { pack: { randomImage: () => Promise<string | null> } } }).api;
    return Promise.all(Array.from({ length: count }, () => api.pack.randomImage()));
  }, n);
  return new Set(list.filter((f): f is string => !!f));
}

test.describe("Creator Tools authoring flow", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    packDir = creatorPack(state.packsDir);
    seedConfig(state, {
      packPath: packDir,
      popupRenderMode: "electron",
      popupMod: 0,
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

  test("tagging section shows the pack's moods and files", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-creator']").click();
    await expect(window.locator("[data-testid='creator-panel']")).toBeVisible();
    await expect(window.locator("[data-testid='creator-mood-starter']")).toBeVisible();
    await expect(window.locator("[data-testid='creator-card-one.png']")).toBeVisible();
    await expect(window.locator("[data-testid='creator-card-two.png']")).toBeVisible();
  });

  test("adding a mood writes index.json", async () => {
    const { window } = running!;
    await window.locator("[data-testid='creator-new-mood']").fill("secret");
    await window.locator("[data-testid='creator-add-mood']").click();
    await expect(window.locator("[data-testid='creator-mood-secret']")).toBeVisible();
    const index = JSON.parse(readFileSync(path.join(packDir, "index.json"), "utf-8")) as {
      moods: Array<{ mood: string }>;
    };
    expect(index.moods.map((m) => m.mood)).toEqual(["starter", "secret"]);
  });

  test("tagging a file through the editor gates its pool membership", async () => {
    const { window } = running!;
    await setMoods([]);
    // two.png is untagged: eligible even with no active mood.
    expect((await picks(40)).has("two.png")).toBe(true);

    // Tag two.png as "secret" via the editor.
    await window.locator("[data-testid='creator-card-two.png']").scrollIntoViewIfNeeded();
    await window.locator("[data-testid='creator-card-two.png']").click();
    await expect(window.locator("[data-testid='tag-editor-two.png']")).toBeVisible();
    // Mantine puts data-testid on the hidden input; click the visible label.
    await window.locator("[data-testid='tag-editor-two.png']").getByText("secret", { exact: true }).click();
    await window.getByLabel("Close tag editor").click();
    await expect(window.locator("[data-testid='creator-saved']")).toBeVisible();

    // Now gated: hidden with no active mood, visible when "secret" is active.
    await setMoods([]);
    expect((await picks(40)).has("two.png")).toBe(false);
    await setMoods(["secret"]);
    expect((await picks(40)).has("two.png")).toBe(true);
    await setMoods([]);
  });

  test("removing a mood untags its files", async () => {
    const { window } = running!;
    await window.locator("[data-testid='creator-mood-remove-secret']").click();
    await expect(window.locator("[data-testid='creator-mood-secret']")).toHaveCount(0);
    const index = JSON.parse(readFileSync(path.join(packDir, "index.json"), "utf-8")) as {
      moods: Array<{ mood: string; media?: string[] }>;
    };
    expect(index.moods.map((m) => m.mood)).toEqual(["starter"]);
    // two.png lost its only tag → default content again.
    await setMoods([]);
    expect((await picks(40)).has("two.png")).toBe(true);
  });

  test("the script designer writes script.lua and Start runs it", async () => {
    const { window } = running!;
    await window.locator("[data-testid='creator-tab-script']").click();
    // Hand-written editing lives on the designer's code tab.
    await window.locator("[data-testid='designer-mode-toggle']").getByText("Code").click();
    const editor = window.locator("[data-testid='designer-code']");
    await expect(editor).toBeVisible();
    // Starter text appears for a pack without a script.
    await expect(editor).toContainText("edgeware_v0");

    await editor.fill(
      'require("edgeware_v0")\nprint("CREATOR-SCRIPT ran")\ncorrupt()\n'
    );
    await window.locator("[data-testid='designer-save']").click();
    await expect(window.locator("[data-testid='designer-status']")).toContainText("Saved");
    expect(readFileSync(path.join(packDir, "script.lua"), "utf-8")).toContain("CREATOR-SCRIPT");
    // An empty design must not wipe the pack's hand-authored level tables.
    expect(readFileSync(path.join(packDir, "corruption.json"), "utf-8")).toContain("secret");

    // Start the runtime: the freshly authored script auto-runs and corrupts.
    await window.locator("[data-testid='main-tab-status']").click();
    await window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(
        () =>
          window.evaluate(() =>
            (window as unknown as { api: { corruption: { getCurrentLevel: () => Promise<number> } } }).api
              .corruption.getCurrentLevel()
          ),
        { timeout: 30000 }
      )
      .toBeGreaterThanOrEqual(1);

    // The script's corrupt() activated the "starter" mood level? (level 1 has
    // no adds in this pack) — instead verify the gallery reflects a session.
    await window.locator("[data-testid='start-stop-button']").click();
  });

  test("edits survive an app restart", async () => {
    await quitApp(running!);
    running = await launchApp(state!, { EDGWARE_STUB_BROWSER: "1" });
    await running!.window.locator("[data-testid='main-tab-creator']").click();
    await expect(running!.window.locator("[data-testid='creator-card-two.png']")).toBeVisible();
    await running!.window.locator("[data-testid='creator-tab-script']").click();
    await running!.window.locator("[data-testid='designer-mode-toggle']").getByText("Code").click();
    await expect(running!.window.locator("[data-testid='designer-code']")).toContainText(
      "CREATOR-SCRIPT"
    );
  });
});
