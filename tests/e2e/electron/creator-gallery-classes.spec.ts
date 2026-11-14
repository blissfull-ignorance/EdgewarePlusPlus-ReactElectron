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

// A 1x1 gif stands in for hypno spirals.
const GIF_BYTES = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);
// A 1x1 png for the bulk paging files.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const BULK_FILES = 155;

let state: TempState | null = null;
let running: RunningApp | null = null;

test.describe("Gallery media classes, paging and creator filters", () => {
  test.beforeAll(async () => {
    ensureElectronBuild();
    state = createTempState();
    // A dedicated pack with an exactly-known file set: the copied seed pack
    // differs between machines (a real library pack ships hypno/ and aud/).
    const dir = path.join(state.packsDir, "classes-pack");
    mkdirSync(path.join(dir, "img"), { recursive: true });
    mkdirSync(path.join(dir, "hypno"), { recursive: true });
    writeFileSync(
      path.join(dir, "info.json"),
      JSON.stringify({ name: "Classes Pack", version: "1.0", creator: "e2e" })
    );
    writeFileSync(path.join(dir, "index.json"), JSON.stringify({ default: {}, moods: [] }));
    copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", "g1.png"));
    copyFileSync(path.join(IMG_DIR, "globelw.png"), path.join(dir, "img", "g2.png"));
    writeFileSync(path.join(dir, "hypno", "h1.gif"), GIF_BYTES);
    writeFileSync(path.join(dir, "hypno", "h2.gif"), GIF_BYTES);
    for (let i = 0; i < BULK_FILES; i++) {
      writeFileSync(path.join(dir, "img", `p${String(i).padStart(3, "0")}.png`), PNG_BYTES);
    }
    seedConfig(state, {
      packPath: dir,
      popupRenderMode: "electron",
      popupMod: 0,
      vidMod: 0,
      showLoadingFlair: 0,
      corruptionMode: 0,
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

  test("hypno files are their own gallery class", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-gallery']").click();
    await expect(window.locator("[data-testid='gallery-count']")).toContainText("2 hypno");

    await window.locator("[data-testid='gallery-type-filter']").getByText("Hypno").click();
    await expect(window.locator("[data-testid='gallery-card-h1.gif']")).toBeVisible();
    await expect(window.locator("[data-testid='gallery-card-h2.gif']")).toBeVisible();
    await expect(window.locator("[data-testid='gallery-card-g1.png']")).toHaveCount(0);
    await expect(window.locator("[data-testid='gallery-card-h1.gif']")).toContainText("hypno overlay");

    // Regular image view never shows the spirals.
    await window.locator("[data-testid='gallery-type-filter']").getByText("Images").click();
    await expect(window.locator("[data-testid='gallery-card-g1.png']")).toBeVisible();
    await expect(window.locator("[data-testid='gallery-card-h1.gif']")).toHaveCount(0);
  });

  test("the grid pages instead of hanging on big packs", async () => {
    const { window } = running!;
    await window.locator("[data-testid='main-tab-gallery']").click();
    await window.locator("[data-testid='gallery-type-filter']").getByText("All").click();
    // Only the first page is in the DOM; the rest waits behind Load more.
    await expect(window.locator("[data-testid='gallery-panel']")).toBeVisible();
    const cards = window.locator("[data-testid^='gallery-card-']");
    await expect(cards).toHaveCount(150);
    const total = await window.evaluate(() => {
      const text = document.querySelector("[data-testid='gallery-count']")?.textContent ?? "";
      return parseInt(text.match(/(\d+) files/)?.[1] ?? "0", 10);
    });
    expect(total).toBeGreaterThan(150);
    await expect(window.locator("[data-testid='gallery-load-more']")).toContainText(
      `${total - 150} hidden`
    );
    await window.locator("[data-testid='gallery-load-more']").click();
    await expect(cards).toHaveCount(total);
    await expect(window.locator("[data-testid='gallery-load-more']")).toHaveCount(0);
  });

  test("tagging refuses hypno-only and nonexistent filenames over raw IPC", async () => {
    const { window } = running!;
    const pack = path.join(state!.packsDir, "classes-pack");
    const indexFile = path.join(pack, "index.json");
    const before = await window.evaluate((p) =>
      (window as unknown as { api: { pack: { getEditableIndex: (p: string) => Promise<unknown> } } })
        .api.pack.getEditableIndex(p)
    , pack);
    const beforeBytes = readFileSync(indexFile, "utf-8");

    const refuse = async (file: string) =>
      window.evaluate(
        async ([p, f]) =>
          (
            window as unknown as {
              api: { pack: { setFileTags: (p: string, f: string, t: string[]) => Promise<unknown> } };
            }
          ).api.pack.setFileTags(p as string, f as string, ["phantom"]),
        [pack, file] as [string, string]
      );

    // Hypno files are overlay-only and never taggable; a name with no file
    // anywhere in the pack must not create a phantom media entry either.
    const afterHypno = await refuse("h1.gif");
    const afterGhost = await refuse("ghost.png");

    expect(JSON.stringify(afterHypno)).toBe(JSON.stringify(before));
    expect(JSON.stringify(afterHypno)).not.toContain("h1.gif");
    expect(JSON.stringify(afterGhost)).toBe(JSON.stringify(before));
    expect(JSON.stringify(afterGhost)).not.toContain("ghost.png");
    // The regression was a disk write: the manifest must be byte-identical.
    expect(readFileSync(indexFile, "utf-8")).toBe(beforeBytes);
  });

  test("the creator grid hides hypno and filters by type and favourites", async () => {
    const { window } = running!;
    // Star one file from the gallery first.
    await window.locator("[data-testid='main-tab-gallery']").click();
    await window.locator("[data-testid='gallery-type-filter']").getByText("Images").click();
    await window.locator("[data-testid='gallery-star-g1.png']").click();
    await expect(window.locator("[data-testid='gallery-chip-favourites']")).toContainText("(1)");

    await window.locator("[data-testid='main-tab-tagging']").click();
    await expect(window.locator("[data-testid='creator-tagging']")).toBeVisible();

    // The creator grid pages too (the round-3 hang fix covers both grids):
    // 157 taggable images, first page 150, the rest behind Load more.
    const creatorCards = window.locator("[data-testid^='creator-card-']");
    await expect(creatorCards).toHaveCount(150);
    await expect(window.locator("[data-testid='creator-load-more']")).toContainText("7 hidden");
    await window.locator("[data-testid='creator-load-more']").click();
    await expect(creatorCards).toHaveCount(157);
    await expect(window.locator("[data-testid='creator-load-more']")).toHaveCount(0);

    // Hypno spirals are never taggable.
    await expect(window.locator("[data-testid='creator-card-h1.gif']")).toHaveCount(0);
    await expect(window.locator("[data-testid='creator-card-g1.png']")).toBeVisible();

    // Type filter.
    await window.locator("[data-testid='creator-type-filter']").getByText("Audio").click();
    await expect(window.locator("[data-testid^='creator-card-']")).toHaveCount(0);
    await window.locator("[data-testid='creator-type-filter']").getByText("Images").click();
    await expect(window.locator("[data-testid='creator-card-g1.png']")).toBeVisible();

    // Favourites filter.
    await window.locator("[data-testid='creator-favourites-label']").click();
    await expect(window.locator("[data-testid^='creator-card-']")).toHaveCount(1);
    await expect(window.locator("[data-testid='creator-card-g1.png']")).toBeVisible();
  });
});
