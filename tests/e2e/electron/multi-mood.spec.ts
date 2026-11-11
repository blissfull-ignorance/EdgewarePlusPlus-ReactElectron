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

const IMG_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "tests",
  "e2e",
  "fixtures",
  "Real Test Pack",
  "img"
);

/** Pack with a dual-tagged file, a single-tag file, default content and a dotfile. */
function writeMultiMoodPack(packsDir: string): string {
  const packDir = path.join(packsDir, "Multi Mood Pack");
  mkdirSync(path.join(packDir, "img"), { recursive: true });
  copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(packDir, "img", "dual.png"));
  copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(packDir, "img", "only1.png"));
  copyFileSync(path.join(IMG_DIR, "globelw.png"), path.join(packDir, "img", "free.png"));
  copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(packDir, "img", ".hidden.png"));
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "Multi Mood Pack", id: "multi", creator: "e2e", version: "1.0", description: "multi" })
  );
  writeFileSync(
    path.join(packDir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: [], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" },
      moods: [
        { mood: "m1", captions: [], web: [], webArgs: [], media: ["dual.png", "only1.png"] },
        { mood: "m2", captions: [], web: [], webArgs: [], media: ["dual.png"] },
      ],
    })
  );
  return packDir;
}

let state: TempState | null = null;
let running: RunningApp | null = null;

async function setMoods(moods: string[]): Promise<void> {
  await running!.window.evaluate((m) => {
    (
      window as unknown as { api: { pack: { setActiveMoods: (v: string[]) => Promise<void> } } }
    ).api.pack.setActiveMoods(m);
  }, moods);
}

async function picks(n: number): Promise<string[]> {
  const list = await running!.window.evaluate((count) => {
    const api = (window as unknown as { api: { pack: { randomImage: () => Promise<string | null> } } }).api;
    return Promise.all(Array.from({ length: count }, () => api.pack.randomImage()));
  }, n);
  return list.filter((f): f is string => !!f);
}

test.describe("Multi-tag mood gating", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    const packDir = writeMultiMoodPack(state.packsDir);
    seedConfig(state, {
      packPath: packDir,
      popupRenderMode: "electron",
      popupMod: 0,
      showLoadingFlair: 0,
      delay: 60000,
    });
    running = await launchApp(state);
  });

  test.afterAll(async () => {
    if (running) await quitApp(running);
    cleanupTempState(state);
  });

  test("any one active tag makes a file eligible", async () => {
    await setMoods(["m2"]);
    const seen = new Set(await picks(80));
    expect(seen.has("dual.png")).toBe(true);
    expect(seen.has("only1.png")).toBe(false);
    expect(seen.has("free.png")).toBe(true);
  });

  test("the other tag unlocks the same file plus its siblings", async () => {
    await setMoods(["m1"]);
    const seen = new Set(await picks(80));
    expect(seen.has("dual.png")).toBe(true);
    expect(seen.has("only1.png")).toBe(true);
  });

  test("with no active mood only untagged content plays, and dotfiles never do", async () => {
    await setMoods([]);
    const seen = new Set(await picks(80));
    expect(seen.has("free.png")).toBe(true);
    expect(seen.has("dual.png")).toBe(false);
    expect(seen.has("only1.png")).toBe(false);
    expect(seen.has(".hidden.png")).toBe(false);
  });

  test("the gallery shows every tag and hides dotfiles", async () => {
    const gallery = await running!.window.evaluate(() =>
      (
        window as unknown as {
          api: { pack: { listGallery: () => Promise<{ entries: Array<{ file: string; moods: string[] }> }> } };
        }
      ).api.pack.listGallery()
    );
    const dual = gallery.entries.find((e) => e.file === "dual.png");
    expect(dual?.moods).toEqual(["m1", "m2"]);
    expect(gallery.entries.some((e) => e.file === ".hidden.png")).toBe(false);
  });
});
