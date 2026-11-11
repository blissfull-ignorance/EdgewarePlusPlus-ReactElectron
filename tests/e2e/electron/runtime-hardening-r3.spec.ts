import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
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

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const IMG_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "img");

function baseSeed(state: TempState, packPath: string, extra: Record<string, unknown> = {}): void {
  seedConfig(state, {
    packPath,
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
    delay: 60000,
    ...extra,
  });
}

test.beforeAll(() => {
  ensureElectronBuild();
});

test("packmedia refuses symlinked escapes out of the pack", async () => {
  const state = createTempState({ kind: "media" });
  const secret = path.join(state.dir, "secret-hosts.txt");
  writeFileSync(secret, "TOP-SECRET-HOSTS");
  try {
    symlinkSync(secret, path.join(state.seedPath, "img", "zz-sym.png"));
  } catch {
    return; /* symlinks unavailable on this volume */
  }
  baseSeed(state, state.seedPath);
  const running = await launchApp(state);
  try {
    const status = await running.window.evaluate(() =>
      fetch("packmedia://img/zz-sym.png").then((r) => r.status)
    );
    expect(status).toBe(404);
    // Legit media still serves.
    const ok = await running.window.evaluate(() =>
      fetch("packmedia://img/applelw.png").then((r) => r.status)
    );
    expect(ok).toBe(200);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("popup:create rejects malformed type and mediaId", async () => {
  const state = createTempState({ kind: "media" });
  baseSeed(state, state.seedPath);
  const running = await launchApp(state);
  try {
    const results = await running.window.evaluate(async () => {
      const api = (
        window as unknown as {
          api: { popup: { create: (t: unknown, m: unknown) => Promise<unknown> } };
        }
      ).api;
      const out: boolean[] = [];
      for (const [t, m] of [
        [null, null],
        ["bogus", "x.png"],
        ["image", 12345],
        ["image", ""],
      ] as Array<[unknown, unknown]>) {
        out.push(
          await api.popup
            .create(t, m)
            .then(() => false)
            .catch(() => true)
        );
      }
      return out;
    });
    expect(results).toEqual([true, true, true, true]);
    // The app stays alive and usable.
    expect(await running.window.evaluate(() => 1 + 1)).toBe(2);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("hibernate clamps hostile burst durations", async () => {
  const state = createTempState({ kind: "media" });
  baseSeed(state, state.seedPath);
  const running = await launchApp(state);
  try {
    const t0 = Date.now();
    await running.window.evaluate(() =>
      (window as unknown as { api: { hibernate: { start: (t: string, d: number) => Promise<void> } } }).api.hibernate.start(
        "Glitch",
        1e9
      )
    );
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(await running.window.evaluate(() => 1 + 1)).toBe(2);
    await running.window.evaluate(() =>
      (window as unknown as { api: { hibernate: { stop: () => Promise<void> } } }).api.hibernate.stop()
    );
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("the running session keeps its pack; switching applies on next start", async () => {
  const state = createTempState();
  const packA = path.join(state.packsDir, "Alpha Pack");
  const packB = path.join(state.packsDir, "Bravo Pack");
  for (const [dir, file] of [
    [packA, "alpha.png"],
    [packB, "bravo.png"],
  ] as const) {
    mkdirSync(path.join(dir, "img"), { recursive: true });
    copyFileSync(path.join(IMG_DIR, "applelw.png"), path.join(dir, "img", file));
    writeFileSync(
      path.join(dir, "info.json"),
      JSON.stringify({ name: dir, id: dir, creator: "e2e", version: "1", description: "x" })
    );
  }
  baseSeed(state, packA);
  const running = await launchApp(state);
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();

    // Mid-run pack switch: the session still draws from the pinned pack.
    await running.window.evaluate((b) => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ packPath: b });
    }, packB);
    const midRun = await running.window.evaluate(() =>
      Promise.all(
        Array.from({ length: 10 }, () =>
          (window as unknown as { api: { pack: { randomImage: () => Promise<string | null> } } }).api.pack.randomImage()
        )
      )
    );
    expect(midRun.filter((f) => f === "alpha.png").length).toBe(10);

    await running.window.locator("[data-testid='start-stop-button']").click();

    // Next start uses the new pack.
    await running.window.locator("[data-testid='start-stop-button']").click();
    const afterRestart = await running.window.evaluate(() =>
      Promise.all(
        Array.from({ length: 10 }, () =>
          (window as unknown as { api: { pack: { randomImage: () => Promise<string | null> } } }).api.pack.randomImage()
        )
      )
    );
    expect(afterRestart.filter((f) => f === "bravo.png").length).toBe(10);
    await running.window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("Lua video() honors maxVideos", async () => {
  const state = createTempState();
  const packDir = path.join(state.packsDir, "Video Spam Pack");
  mkdirSync(path.join(packDir, "vid"), { recursive: true });
  copyFileSync(
    path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "vid", "tempest.mp4"),
    path.join(packDir, "vid", "clip.mp4")
  );
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "Video Spam Pack", id: "vspam", creator: "e2e", version: "1.0", description: "v" })
  );
  writeFileSync(
    path.join(packDir, "script.lua"),
    'require("edgeware_v0")\nfor i = 1, 12 do\n  video("clip.mp4")\nend\n'
  );
  baseSeed(state, packDir, { maxVideos: 1 });
  const running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
  try {
    await running.window.evaluate(() =>
      (window as unknown as { api: { scripting: { runLua: (n: string) => Promise<boolean> } } }).api.scripting.runLua("script.lua")
    );
    await new Promise((r) => setTimeout(r, 1500));
    const windows = running.app.windows().filter((w) => w.url().includes("/popup/video")).length;
    expect(windows).toBeLessThanOrEqual(1);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("timeout settings are milliseconds end to end", async () => {
  const state = createTempState({ kind: "media" });
  baseSeed(state, state.seedPath, {
    popupMod: 100,
    timeoutPopups: 1,
    popupTimeout: 1500,
    delay: 500,
  });
  const running = await launchApp(state);
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length)
      .toBeGreaterThanOrEqual(1);
    // With a 1500ms timeout and 500ms cadence the open population stays
    // small; a seconds-misread (1500s) would let it grow unbounded.
    await new Promise((r) => setTimeout(r, 4000));
    const open = running.app.windows().filter((w) => w.url().includes("/popup/")).length;
    expect(open).toBeLessThanOrEqual(6);
    await running.window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
