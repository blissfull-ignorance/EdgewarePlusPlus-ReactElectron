import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

let state: TempState | null = null;
let running: RunningApp | null = null;
let dir = "";

test.beforeAll(async () => {
  ensureElectronBuild();
  state = createTempState();
  dir = path.join(state.packsDir, "Delete Pack");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(path.join(dir, "img", "two.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "Delete Pack", id: "deletepack", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["c"] },
      moods: [{ mood: "cool", captions: [], web: [], webArgs: [], media: ["one.png"] }],
    })
  );
  seedConfig(state, {
    packPath: dir,
    popupRenderMode: "electron",
    corruptionMode: 0,
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

test("the gallery deletes a file from disk and clears its mood tags", async () => {
  const { window } = running!;
  await window.locator("[data-testid='main-tab-gallery']").click();
  await expect(window.locator("[data-testid='gallery-card-one.png']")).toBeVisible();

  await window.locator("[data-testid='gallery-delete-one.png']").click();
  await expect(window.locator("[data-testid='confirm-file-delete-text']")).toContainText("one.png");
  await window.locator("[data-testid='delete-file-cancel']").click();
  // Cancel is honest: nothing happened.
  expect(existsSync(path.join(dir, "img", "one.png"))).toBe(true);

  await window.locator("[data-testid='gallery-delete-one.png']").click();
  await window.locator("[data-testid='delete-file-confirm']").click();
  await expect(window.locator("[data-testid='gallery-card-one.png']")).toHaveCount(0);
  expect(existsSync(path.join(dir, "img", "one.png"))).toBe(false);

  const index = JSON.parse(readFileSync(path.join(dir, "index.json"), "utf-8")) as {
    moods: Array<{ mood: string; media?: string[] }>;
  };
  expect(index.moods[0].media ?? []).not.toContain("one.png");
  // The sibling file is untouched.
  expect(existsSync(path.join(dir, "img", "two.png"))).toBe(true);
});

test("mood tagging deletes a file from the pack", async () => {
  const { window } = running!;
  await window.locator("[data-testid='main-tab-tagging']").click();
  await expect(window.locator("[data-testid='creator-card-two.png']")).toBeVisible();

  await window.locator("[data-testid='creator-delete-two.png']").click();
  await window.locator("[data-testid='delete-file-confirm']").click();
  await expect(window.locator("[data-testid='creator-card-two.png']")).toHaveCount(0);
  expect(existsSync(path.join(dir, "img", "two.png"))).toBe(false);
});

test("deleteFile refuses traversal names, missing files and non-packs over raw IPC", async () => {
  const { window } = running!;
  const results = await window.evaluate(async ({ packDir, parentDir }) => {
    const api = (
      window as unknown as {
        api: {
          pack: {
            deleteFile: (
              p: string,
              k: string,
              f: string
            ) => Promise<{ ok: boolean; error?: string }>;
          };
        };
      }
    ).api;
    return {
      traversal: await api.pack.deleteFile(packDir, "image", "../info.json"),
      missing: await api.pack.deleteFile(packDir, "image", "ghost.png"),
      badKind: await api.pack.deleteFile(packDir, "script", "one.png"),
      notAPack: await api.pack.deleteFile(parentDir, "image", "one.png"),
    };
  }, { packDir: dir, parentDir: path.dirname(dir) });
  expect(results.traversal.ok).toBe(false);
  expect(results.missing.ok).toBe(false);
  expect(results.badKind.ok).toBe(false);
  expect(results.notAPack.ok).toBe(false);
  expect(existsSync(path.join(dir, "info.json"))).toBe(true);
});
