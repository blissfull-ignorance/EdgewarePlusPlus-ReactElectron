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
    const dir = state.seedPath;
    mkdirSync(path.join(dir, "hypno"), { recursive: true });
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

  test("tagging refuses hypno-only filenames over raw IPC", async () => {
    const { window } = running!;
    const before = await window.evaluate((p) =>
      (window as unknown as { api: { pack: { getEditableIndex: (p: string) => Promise<unknown> } } })
        .api.pack.getEditableIndex(p)
    , state!.seedPath);
    const after = await window.evaluate(
      async ([p, f]) =>
        (
          window as unknown as {
            api: { pack: { setFileTags: (p: string, f: string, t: string[]) => Promise<unknown> } };
          }
        ).api.pack.setFileTags(p as string, f as string, ["phantom"]),
      [state!.seedPath, "h1.gif"] as [string, string]
    );
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(JSON.stringify(after)).not.toContain("h1.gif");
  });

  test("the creator grid hides hypno and filters by type and favourites", async () => {
    const { window } = running!;
    // Star one file from the gallery first.
    await window.locator("[data-testid='main-tab-gallery']").click();
    await window.locator("[data-testid='gallery-type-filter']").getByText("Images").click();
    await window.locator("[data-testid='gallery-star-g1.png']").click();
    await expect(window.locator("[data-testid='gallery-chip-favourites']")).toContainText("(1)");

    await window.locator("[data-testid='main-tab-creator']").click();
    await expect(window.locator("[data-testid='creator-tagging']")).toBeVisible();
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
