import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
  await window.locator("[data-testid='main-tab-designer']").click();
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
    await openDesigner(running.window);
    await expect(running.window.locator("[data-testid='designer-level-199']")).toBeVisible({
      timeout: 15_000,
    });
    // Exactly the capped number of cards: level 200 (index 199) exists, 201 does not.
    await expect(running.window.locator("[data-testid='designer-level-200']")).toHaveCount(0);

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

    // The saved marker must re-parse: one level card carrying exactly the two
    // surviving actions after the reload from disk.
    await running.window.locator("[data-testid='main-tab-status']").click();
    await running.window.locator("[data-testid='main-tab-tagging']").click();
    await running.window.locator("[data-testid='main-tab-designer']").click();
    await expect(running.window.locator("[data-testid='designer-level-0']")).toBeVisible();
    await expect(running.window.locator("[data-testid='designer-level-1']")).toHaveCount(0);
    await expect(running.window.locator("[data-testid='designer-action-0-0']")).toBeVisible();
    await expect(running.window.locator("[data-testid='designer-action-0-1']")).toBeVisible();
    await expect(running.window.locator("[data-testid='designer-action-0-2']")).toHaveCount(0);
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

test("an unsaved design survives leaving the designer and coming back", async () => {
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
    await running.window.locator("[data-testid='main-tab-tagging']").click();
    await running.window.locator("[data-testid='main-tab-designer']").click();
    await expect(running.window.locator("[data-testid='designer-level-0']")).toBeVisible();
    await expect(running.window.locator("[data-testid='designer-popupmod-0']")).toHaveValue("42 %");
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
    await running.window.locator("[data-testid='main-tab-tagging']").click();
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

test("converting stages the design unsaved; saving archives both originals", async () => {
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
  const handwrittenTables = JSON.stringify({ moods: { "1": { add: ["ancient"] } } });
  writeFileSync(path.join(dir, "corruption.json"), handwrittenTables);
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

    // The conversion is staged in the editor: the pack on disk is untouched
    // and NO backup exists yet — a failed or unwanted conversion needs no
    // restoring because nothing was ever written.
    await expect(running.window.locator("[data-testid='designer-convert-pending']")).toBeVisible();
    expect(readFileSync(path.join(dir, "script.lua"), "utf-8")).toBe(handwritten);
    expect(existsSync(path.join(dir, "script.lua.bak"))).toBe(false);
    expect(existsSync(path.join(dir, "corruption.json.bak"))).toBe(false);

    // Saving installs the design and archives BOTH originals.
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    const note = running.window.locator("[data-testid='designer-imported-note']");
    await expect(note).toContainText("script.lua.bak");
    await expect(note).toContainText("corruption.json.bak");
    expect(readFileSync(path.join(dir, "script.lua.bak"), "utf-8")).toBe(handwritten);
    expect(readFileSync(path.join(dir, "corruption.json.bak"), "utf-8")).toBe(handwrittenTables);
    const installed = readFileSync(path.join(dir, "script.lua"), "utf-8");
    expect(installed).toContain("EDGWARE-DESIGNER");
    // The banner is gone and the visual editor owns the design.
    await expect(running.window.locator("[data-testid='designer-handwritten-banner']")).toHaveCount(0);

    // A second hand edit + convert + save archives again without clobbering.
    await running.window.evaluate((lua) => {
      (
        window as unknown as {
          api: { scripting: { writeScript: (p: string, c: string) => Promise<boolean> } };
        }
      ).api.scripting.writeScript(
        lua,
        'require("edgeware_v0")\n-- second hand edit\ncorrupt()\n'
      );
    }, dir);
    await running.window.reload();
    await running.window.locator("[data-testid='main-tab-tagging']").click();
    await running.window.locator("[data-testid='main-tab-designer']").click();
    await expect(running.window.locator("[data-testid='designer-import-script']")).toBeVisible();
    await running.window.locator("[data-testid='designer-import-script']").click();
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    await expect(note).toContainText("script.lua.bak-2");
    expect(readFileSync(path.join(dir, "script.lua.bak"), "utf-8")).toBe(handwritten);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("saving a design over a hand-written script archives the original first", async () => {
  const state: TempState = createTempState();
  const dir = path.join(state.packsDir, "CT-SaveOverwrite");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "CT-SaveOverwrite", id: "ctso", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(path.join(dir, "index.json"), JSON.stringify({ default: {}, moods: [] }));
  const handwritten = 'require("edgeware_v0")\n-- irreplaceable hand-written magic\nafter(1000, corrupt)\n';
  writeFileSync(path.join(dir, "script.lua"), handwritten);
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
    await openDesigner(running.window);
    await expect(running.window.locator("[data-testid='designer-handwritten-banner']")).toBeVisible();
    // Save WITHOUT converting: the design replaces the script, so the
    // hand-written original must be archived, not silently destroyed.
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    expect(existsSync(path.join(dir, "script.lua.bak"))).toBe(true);
    expect(readFileSync(path.join(dir, "script.lua.bak"), "utf-8")).toBe(handwritten);
    expect(readFileSync(path.join(dir, "script.lua"), "utf-8")).toContain("EDGWARE-DESIGNER");
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("Save & test run starts a session the Stop button controls", async () => {
  const state: TempState = createTempState();
  const dir = path.join(state.packsDir, "CT-TestRun");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(path.join(dir, "img", "one.png"), "png");
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "CT-TestRun", id: "cttr", creator: "e2e", version: "1", description: "x" })
  );
  writeFileSync(path.join(dir, "index.json"), JSON.stringify({ default: {}, moods: [] }));
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
    await openDesigner(running.window);
    await running.window.locator("[data-testid='designer-add-level']").click();
    await running.window.locator("[data-testid='designer-test-run']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    // The test run is a real session: the header button flips to Stop and
    // ends it.
    await expect(running.window.locator("[data-testid='start-stop-button']")).toHaveText("Stop", {
      timeout: 15_000,
    });
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect(running.window.locator("[data-testid='start-stop-button']")).toHaveText("Start");
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
    // Staged, not saved: the pack on disk is still the hand-written pair.
    await expect(running.window.locator("[data-testid='designer-convert-pending']")).toBeVisible();
    expect(readFileSync(path.join(dir, "script.lua"), "utf-8")).toBe(handwritten);
    // The report names what could not be represented.
    await expect(running.window.locator("[data-testid='designer-convert-report']")).toContainText(
      "multiple_popups() call(s) dropped"
    );
    // The converted level is editable BEFORE saving: all three actions show.
    await expect(running.window.locator("[data-testid='designer-level-0']")).toBeVisible();
    for (const i of [0, 1, 2]) {
      await expect(running.window.locator(`[data-testid='designer-action-0-${i}']`)).toBeVisible();
    }
    await expect(running.window.getByRole("textbox", { name: "Action 1 file" })).toHaveValue("one.png");
    await expect(running.window.getByRole("textbox", { name: "Action 2 file" })).toHaveValue("a.mp3");
    await expect(running.window.getByRole("textbox", { name: "Action 3 text" })).toHaveValue("done");

    // Saving archives the originals and installs the designed pair.
    await running.window.locator("[data-testid='designer-save']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText("Saved");
    await expect(running.window.locator("[data-testid='designer-imported-note']")).toContainText(
      "script.lua.bak"
    );
    expect(readFileSync(path.join(dir, "script.lua.bak"), "utf-8")).toBe(handwritten);
    expect(readFileSync(path.join(dir, "script.lua"), "utf-8")).toContain("EDGWARE-DESIGNER");
    // The corruption tables survive the conversion (mood add kept).
    const tables = JSON.parse(readFileSync(path.join(dir, "corruption.json"), "utf-8"));
    expect(tables.moods["1"].add).toEqual(["cool"]);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("creator write channels refuse directories that are not packs", async () => {
  const state = createTempState();
  const bare = path.join(state.packsDir, "not-a-pack");
  mkdirSync(bare, { recursive: true });
  writeFileSync(path.join(bare, "victim.txt"), "do not touch");
  seedConfig(state, { packPath: state.seedPath, showLoadingFlair: 0 });
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    const results = await running.window.evaluate(
      async (p: string) => {
        const api = (
          window as unknown as {
            api: {
              scripting: {
                readScript: (p: string) => Promise<unknown>;
                writeScript: (p: string, c: string) => Promise<boolean>;
                convertScript: (p: string) => Promise<unknown>;
                writePackDesign: (
                  p: string,
                  lua: string,
                  json: string
                ) => Promise<{ ok: boolean; backups: string[] }>;
              };
              pack: {
                getEditableIndex: (p: string) => Promise<unknown>;
                setFileTags: (p: string, f: string, t: string[]) => Promise<unknown>;
              };
            };
          }
        ).api;
        return {
          read: await api.scripting.readScript(p),
          write: await api.scripting.writeScript(p, "x"),
          convert: await api.scripting.convertScript(p),
          design: await api.scripting.writePackDesign(p, "print(1)", "{}"),
          index: await api.pack.getEditableIndex(p),
          tags: await api.pack.setFileTags(p, "ghost.png", ["m"]),
        };
      },
      bare
    );
    expect(results).toEqual({
      read: null,
      write: false,
      convert: null,
      design: { ok: false, backups: [] },
      index: null,
      tags: null,
    });
    // Nothing was created in or beside the bare directory.
    expect(readdirSync(bare).sort()).toEqual(["victim.txt"]);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("a script beyond the 200 KB limit shows the banner and cannot be saved over", async () => {
  const state = createTempState();
  const dir = path.join(state.packsDir, "huge-script");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "Huge Script", version: "1", creator: "e2e" })
  );
  writeFileSync(path.join(dir, "index.json"), JSON.stringify({ default: {}, moods: [] }));
  const huge = `-- hand-written bulk\n${"-- filler\n".repeat(25000)}`;
  writeFileSync(path.join(dir, "script.lua"), huge);
  expect(huge.length).toBeGreaterThan(200_000);
  seedConfig(state, { packPath: dir, showLoadingFlair: 0 });
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    await openDesigner(running.window);
    await expect(running.window.locator("[data-testid='designer-toolarge-banner']")).toBeVisible();
    await expect(running.window.locator("[data-testid='designer-save']")).toBeDisabled();
    await expect(running.window.locator("[data-testid='designer-import-script']")).toBeDisabled();
    // The oversized file is untouched — no truncation through the editor.
    expect(readFileSync(path.join(dir, "script.lua"), "utf-8")).toBe(huge);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("converting refuses a malformed corruption.json and preserves every byte", async () => {
  const state = createTempState();
  const dir = path.join(state.packsDir, "broken-tables");
  mkdirSync(path.join(dir, "img"), { recursive: true });
  writeFileSync(
    path.join(dir, "info.json"),
    JSON.stringify({ name: "Broken Tables", version: "1", creator: "e2e" })
  );
  writeFileSync(path.join(dir, "index.json"), JSON.stringify({ default: {}, moods: [] }));
  const lua = 'require("edgeware_v0")\nimage("one.png")\n';
  const broken = "{oops";
  writeFileSync(path.join(dir, "script.lua"), lua);
  writeFileSync(path.join(dir, "corruption.json"), broken);
  seedConfig(state, { packPath: dir, showLoadingFlair: 0 });
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    await openDesigner(running.window);
    await running.window.locator("[data-testid='designer-import-script']").click();
    await expect(running.window.locator("[data-testid='designer-status']")).toContainText(
      "Could not save the design"
    );
    // Refusal means refusal: both files byte-identical, no backup churn.
    expect(readFileSync(path.join(dir, "script.lua"), "utf-8")).toBe(lua);
    expect(readFileSync(path.join(dir, "corruption.json"), "utf-8")).toBe(broken);
    expect(existsSync(path.join(dir, "script.lua.bak"))).toBe(false);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("a converted script runs its level's events sequentially, not all at once", async () => {
  ensureElectronBuild();
  const state: TempState = createTempState({ kind: "media" });
  const dir = state.seedPath;
  // Hand-written script with three image events staggered by after(ms, …):
  // the exact pattern the converter used to flatten into one burst.
  const handwritten = [
    'require("edgeware_v0")',
    'image("applelw.png")',
    'after(1500, function() image("globelw.png") end)',
    'after(3200, function() image("applelw.png") end)',
  ].join("\n");
  writeFileSync(path.join(dir, "script.lua"), handwritten);
  seedConfig(state, {
    packPath: dir,
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    timeoutPopups: 0,
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
    await expect(running.window.locator("[data-testid='designer-convert-pending']")).toBeVisible();

    // Watch every new window from creation: poll ITS route (not a shared
    // slow sweep) so the recorded spawn times keep ~25ms resolution.
    const seen = new Map<string, number>();
    const t0 = Date.now();
    running.app.on("window", (w) => {
      const watch = setInterval(() => {
        try {
          const m = w.url().match(/#\/popup\/image\/[^/]+\/(popup-[^?/]+)/);
          if (m && !seen.has(m[1])) {
            seen.set(m[1], Date.now() - t0);
            clearInterval(watch);
          }
        } catch {
          clearInterval(watch); // window gone
        }
      }, 25);
      setTimeout(() => clearInterval(watch), 30000).unref?.();
    });

    await running.window.locator("[data-testid='designer-test-run']").click();
    await expect.poll(() => seen.size, { timeout: 30000 }).toBe(3);

    const times = [...seen.values()].sort((a, b) => a - b);
    // Sequential, not simultaneous: the 1.5s event must not arrive early
    // and the 3.2s event must trail it (margins absorb window-boot jitter).
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1200);
    expect(times[2] - times[0]).toBeGreaterThanOrEqual(2800);

    await running.window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("a converted voice chain plays its audios one after another", async () => {
  ensureElectronBuild();
  const state: TempState = createTempState({ kind: "media" });
  const dir = state.seedPath;
  // The AddictAcceptanceProgram pattern: each voice names the next as its
  // on_stop callback, so playback is strictly sequential.
  const handwritten = [
    'require("edgeware_v0")',
    'audio("think.wav", v2)',
    "function v2()",
    '  audio("think.wav", v3)',
    "end",
    "function v3()",
    '  audio("think.wav", nil)',
    "end",
  ].join("\n");
  writeFileSync(path.join(dir, "script.lua"), handwritten);
  seedConfig(state, {
    packPath: dir,
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    timeoutPopups: 0,
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
    await expect(running.window.locator("[data-testid='designer-convert-pending']")).toBeVisible();

    const seen = new Map<string, number>();
    const t0 = Date.now();
    running.app.on("window", (w) => {
      const watch = setInterval(() => {
        try {
          const m = w.url().match(/#\/popup\/audio\/[^/]+\/(popup-[^?/]+)/);
          if (m && !seen.has(m[1])) {
            seen.set(m[1], Date.now() - t0);
            clearInterval(watch);
          }
        } catch {
          clearInterval(watch);
        }
      }, 25);
      setTimeout(() => clearInterval(watch), 30000).unref?.();
    });

    await running.window.locator("[data-testid='designer-test-run']").click();
    await expect.poll(() => seen.size, { timeout: 30000 }).toBe(3);

    const times = [...seen.values()].sort((a, b) => a - b);
    // Each think.wav is 0.6s: sequential playback means the third voice can
    // only start after two full playthroughs. All-at-once would be < 500ms.
    expect(times[2] - times[0]).toBeGreaterThanOrEqual(900);

    await running.window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
