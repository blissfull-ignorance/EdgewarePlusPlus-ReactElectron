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
    vidMod: 0,
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

test("quitting mid-session does not carry moods into the next launch", async () => {
  const state: TempState = createTempState();
  const dir = path.join(state.packsDir, "CT-Resurrect");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(path.join(dir, "img", "gated.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "CT-Resurrect", id: "ctres", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["c"] },
      moods: [{ mood: "gated", captions: [], media: ["gated.png"] }],
    })
  );
  writeFileSync(
    path.join(dir, "corruption.json"),
    JSON.stringify({ moods: { "1": { add: ["gated"], remove: [] } }, config: {} })
  );
  writeFileSync(path.join(dir, "script.lua"), 'require("edgeware_v0")\nafter(300, corrupt)\n');
  const seed = {
    packPath: dir,
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    showLoadingFlair: 0,
    corruptionMode: 0,
    corruptionTrigger: "Script",
    delay: 60000,
  };
  seedConfig(state, seed);
  let running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    // Grant the mood, then quit WITHOUT pressing Stop.
    await running.window.locator("[data-testid='start-stop-button']").click();
    await running.window.locator("[data-testid='main-tab-gallery']").click();
    await expect(running.window.locator("[data-testid='gallery-chip-gated']")).toContainText(
      /active/i,
      { timeout: 30_000 }
    );
    await quitApp(running);

    running = await launchApp(state, {
      EDGWARE_STUB_BROWSER: "1",
      EDGWARE_PANIC_SKIP_WALLPAPER: "1",
    });
    await running.window.locator("[data-testid='main-tab-gallery']").click();
    // Nothing is running: the badge is locked and the pool stays gated.
    await expect(running.window.locator("[data-testid='gallery-chip-gated']")).not.toContainText(
      /active/i
    );
    const picks = await running.window.evaluate(() =>
      Promise.all(
        Array.from({ length: 30 }, () =>
          (window as unknown as { api: { pack: { randomImage: () => Promise<string | null> } } }).api.pack.randomImage()
        )
      )
    );
    expect(picks.filter((f) => f === "gated.png")).toEqual([]);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("a colliding mood rename changes nothing and claims nothing", async () => {
  const state: TempState = createTempState();
  const dir = path.join(state.packsDir, "CT-Collide");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "CT-Collide", id: "ctcollide", creator: "e2e", version: "1", description: "x" })
  );
  const index = JSON.stringify({
    default: { maxClicks: 1, captions: ["c"] },
    moods: [
      { mood: "alpha", captions: [], media: ["one.png"] },
      { mood: "beta", captions: [], media: [] },
    ],
  });
  writeFileSync(path.join(dir, "index.json"), index);
  seedConfig(state, {
    packPath: dir,
    popupRenderMode: "electron",
    popupMod: 0,
    showLoadingFlair: 0,
    delay: 60000,
  });
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    await running.window.locator("[data-testid='main-tab-creator']").click();
    await running.window.locator("[data-testid='creator-mood-rename-alpha']").click();
    await running.window.locator("[data-testid='creator-mood-rename-input-alpha']").fill("beta");
    await running.window.keyboard.press("Enter");
    // No false success banner, and the mood list is untouched.
    await expect(running.window.locator("[data-testid='creator-saved']")).toHaveCount(0);
    await expect(running.window.locator("[data-testid='creator-mood-alpha']")).toBeVisible();
    expect(readFileSync(path.join(dir, "index.json"), "utf-8")).toBe(index);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("importing a hand-written script archives it and installs a designed one", async () => {
  const state: TempState = createTempState();
  const dir = path.join(state.packsDir, "CT-Import");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "CT-Import", id: "ctimport", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(path.join(dir, "index.json"), JSON.stringify({ default: {}, moods: [] }));
  const handwritten = 'require("edgeware_v0")\n-- ancient hand-written magic\ncorrupt()\n';
  writeFileSync(path.join(dir, "script.lua"), handwritten);
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
    await openDesigner(running.window);
    await expect(running.window.locator("[data-testid='designer-handwritten-banner']")).toBeVisible();
    await running.window.locator("[data-testid='designer-import-script']").click();
    await expect(running.window.locator("[data-testid='designer-imported-note']")).toContainText(
      "script.lua.bak"
    );
    // The original survives on disk; the live script is now designer-owned.
    expect(readFileSync(path.join(dir, "script.lua.bak"), "utf-8")).toBe(handwritten);
    const installed = readFileSync(path.join(dir, "script.lua"), "utf-8");
    expect(installed).toContain("EDGWARE-DESIGNER");
    // The banner is gone and the visual editor owns the (empty) design.
    await expect(running.window.locator("[data-testid='designer-handwritten-banner']")).toHaveCount(0);
    await running.window.locator("[data-testid='designer-add-level']").click();
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    // A second import archives again without clobbering the first backup.
    await running.window.evaluate((lua) => {
      (
        window as unknown as {
          api: { scripting: { writeScript: (p: string, c: string) => Promise<boolean> } };
        }
      ).api.scripting.writeScript(
        lua,
        'require("edgeware_v0")\n-- second hand edit\n'
      );
    }, dir);
    await running.window.reload();
    await running.window.locator("[data-testid='main-tab-creator']").click();
    await running.window.locator("[data-testid='creator-tab-script']").click();
    await expect(running.window.locator("[data-testid='designer-import-script']")).toBeVisible();
    await running.window.locator("[data-testid='designer-import-script']").click();
    await expect(running.window.locator("[data-testid='designer-imported-note']")).toContainText(
      "script.lua.bak-2"
    );
    expect(existsSync(path.join(dir, "script.lua.bak"))).toBe(true);
    expect(readFileSync(path.join(dir, "script.lua.bak"), "utf-8")).toBe(handwritten);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("converting a hand-written script yields editable levels and an honest report", async () => {
  const state: TempState = createTempState();
  const dir = path.join(state.packsDir, "CT-Convert");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  mkdirSync(path.join(dir, "aud"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(path.join(dir, "aud", "a.mp3"), "mp3");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "CT-Convert", id: "ctconvert", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({ default: {}, moods: [{ mood: "cool", media: { images: ["one.png"] } }] })
  );
  writeFileSync(
    path.join(dir, "corruption.json"),
    JSON.stringify({ moods: { "1": { add: ["cool"], remove: [] } }, config: {} })
  );
  const handwritten = [
    'require("edgeware_v0")',
    "function intro()",
    '  image("one.png")',
    "  corrupt()",
    '  audio("a.mp3", outro)',
    "end",
    "function outro()",
    '  notification("done")',
    "  multiple_popups(90, 2)",
    "end",
    "intro()",
    "",
  ].join("\n");
  writeFileSync(path.join(dir, "script.lua"), handwritten);
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
    await openDesigner(running.window);
    await running.window.locator("[data-testid='designer-import-script']").click();
    await expect(running.window.locator("[data-testid='designer-imported-note']")).toContainText(
      "script.lua.bak"
    );
    // The report names what could not be represented.
    await expect(running.window.locator("[data-testid='designer-convert-report']")).toContainText(
      "multiple_popups() call(s) dropped"
    );
    // Original archived verbatim; the live script is designer-owned.
    expect(readFileSync(path.join(dir, "script.lua.bak"), "utf-8")).toBe(handwritten);
    expect(readFileSync(path.join(dir, "script.lua"), "utf-8")).toContain("EDGWARE-DESIGNER");
    // The corruption tables survive the conversion (mood add kept).
    const tables = JSON.parse(readFileSync(path.join(dir, "corruption.json"), "utf-8"));
    expect(tables.moods["1"].add).toEqual(["cool"]);
    // The converted level is editable: all three actions show on the card.
    await expect(running.window.locator("[data-testid='designer-level-0']")).toBeVisible();
    for (const i of [0, 1, 2]) {
      await expect(running.window.locator(`[data-testid='designer-action-0-${i}']`)).toBeVisible();
    }
    await expect(running.window.getByRole("textbox", { name: "Action 1 file" })).toHaveValue("one.png");
    await expect(running.window.getByRole("textbox", { name: "Action 2 file" })).toHaveValue("a.mp3");
    await expect(running.window.getByRole("textbox", { name: "Action 3 text" })).toHaveValue("done");
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
