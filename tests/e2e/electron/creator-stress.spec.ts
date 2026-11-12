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

test("gallery mood badges re-lock on Stop while the tab stays mounted", async () => {
  const state: TempState = createTempState();
  const dir = path.join(state.packsDir, "CT-Unlock");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "CT-Unlock", id: "ctunlock", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["c"] },
      moods: [{ mood: "open", captions: [], media: ["one.png"] }],
    })
  );
  writeFileSync(
    path.join(dir, "corruption.json"),
    JSON.stringify({ moods: { "1": { add: ["open"], remove: [] } }, config: {} })
  );
  writeFileSync(path.join(dir, "script.lua"), 'require("edgeware_v0")\nafter(300, corrupt)\n');
  seedConfig(state, {
    packPath: dir,
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
    await running.window.locator("[data-testid='start-stop-button']").click();
    await running.window.locator("[data-testid='main-tab-gallery']").click();
    // The mood unlocks while running.
    await expect(running.window.locator("[data-testid='gallery-chip-open']")).toContainText(
      /active/i,
      { timeout: 30_000 }
    );
    // Stop without leaving the tab: badges re-lock immediately.
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect(running.window.locator("[data-testid='gallery-chip-open']")).not.toContainText(
      /active/i,
      { timeout: 10_000 }
    );
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("an unsaved design survives leaving Creator and coming back", async () => {
  const state: TempState = createTempState();
  const pack = markerPack(state.packsDir, "CT-Draft", {
    version: 1,
    startDelaySeconds: 1,
    levels: [],
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
    await running.window.locator("[data-testid='designer-add-level']").click();
    await running.window.locator("[data-testid='designer-popupmod-0']").fill("42");
    await expect(running.window.locator("[data-testid='designer-unsaved']")).toBeVisible();

    // Leave Creator entirely, then return.
    await running.window.locator("[data-testid='main-tab-status']").click();
    await running.window.locator("[data-testid='main-tab-creator']").click();
    await running.window.locator("[data-testid='creator-tab-script']").click();
    await expect(running.window.locator("[data-testid='designer-level-0']")).toBeVisible();
    await expect(running.window.locator("[data-testid='designer-popupmod-0']")).toHaveValue("42");
    await expect(running.window.locator("[data-testid='designer-unsaved']")).toBeVisible();

    // Saving clears the draft marker.
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    await expect(running.window.locator("[data-testid='designer-unsaved']")).toHaveCount(0);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
