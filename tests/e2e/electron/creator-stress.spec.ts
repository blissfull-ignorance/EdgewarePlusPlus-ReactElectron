import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type TempState,
} from "./launch";

function markerPack(packsDir: string, name: string, markerJson: unknown): string {
  const dir = path.join(packsDir, name);
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name, id: name, creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({ default: { maxClicks: 1, captions: ["c"] }, moods: [] })
  );
  writeFileSync(
    path.join(dir, "script.lua"),
    `-- [EDGWARE-DESIGNER]${JSON.stringify(markerJson)}\nrequire("edgeware_v0")\n`
  );
  return dir;
}

async function openDesigner(window: import("@playwright/test").Page): Promise<void> {
  await window.locator("[data-testid='main-tab-creator']").click();
  await window.locator("[data-testid='creator-tab-script']").click();
  await expect(window.locator("[data-testid='creator-designer']")).toBeVisible();
}

test.beforeAll(() => {
  ensureElectronBuild();
});

test("a 10k-level hostile marker is capped: the designer paints in seconds", async () => {
  const state: TempState = createTempState();
  const pack = markerPack(state.packsDir, "CT-Huge", {
    version: 1,
    startDelaySeconds: 2,
    // Minimal entries keep the marker under the read cap, so the load
    // path (not the too-large refusal) is what gets exercised.
    levels: Array.from({ length: 10_000 }, () => ({})),
  });
  seedConfig(state, {
    packPath: pack,
    popupRenderMode: "electron",
    popupMod: 0,
    showLoadingFlair: 0,
    corruptionMode: 0,
    corruptionTrigger: "Script",
    delay: 60000,
  });
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    const t0 = Date.now();
    await openDesigner(running.window);
    await expect(running.window.locator("[data-testid='designer-level-199']")).toBeVisible({
      timeout: 15_000,
    });
    expect(Date.now() - t0).toBeLessThan(15_000);
    // Exactly the capped number of cards: level 200 (index 199) exists, 201 does not.
    expect(await running.window.locator("[data-testid='designer-level-200']")).toHaveCount(0);
    expect(await running.window.evaluate(() => 1 + 1)).toBe(2);

    // Saving the capped design produces valid, reopenable artifacts.
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    const lua = readFileSync(path.join(pack, "script.lua"), "utf-8");
    expect((lua.match(/local function level/g) ?? []).length).toBe(200);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("non-string action fields in a marker are dropped, and the design saves", async () => {
  const state: TempState = createTempState();
  const pack = markerPack(state.packsDir, "CT-BadFields", {
    version: 1,
    startDelaySeconds: 1,
    levels: [
      {
        addMoods: [],
        removeMoods: [],
        actions: [
          { kind: "image", file: 12345 },
          { kind: "notification", text: { a: 1 } },
        ],
        advance: { mode: "end" },
      },
    ],
  });
  seedConfig(state, {
    packPath: pack,
    popupRenderMode: "electron",
    popupMod: 0,
    showLoadingFlair: 0,
    corruptionMode: 0,
    corruptionTrigger: "Script",
    delay: 60000,
  });
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    await openDesigner(running.window);
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    const lua = readFileSync(path.join(pack, "script.lua"), "utf-8");
    expect(lua).toContain("image(nil)");
    expect(lua).toContain("notification()");
    expect(lua).not.toContain("replace");
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
