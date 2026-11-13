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
  writeSilentWav,
  type TempState,
} from "./launch";

const REPO_ROOT = path.join(__dirname, "..", "..", "..");

function baseSeed(state: TempState, packPath: string, extra: Record<string, unknown> = {}): string {
  return seedConfig(state, {
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

function audioSpamPack(packsDir: string): string {
  const packDir = path.join(packsDir, "Audio Spam Pack");
  mkdirSync(path.join(packDir, "aud"), { recursive: true });
  // A 6s tone, not the 0.6s fixture clip: the short one self-closes on end,
  // so the popup count would read zero whether the cap held, was removed, or
  // audio() was broken entirely. A long tone keeps the capped popup open for
  // the count, turning `=== 1` into a real positive control.
  writeSilentWav(path.join(packDir, "aud", "voice.wav"), 6);
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "Audio Spam Pack", id: "spam", creator: "e2e", version: "1.0", description: "spam" })
  );
  writeFileSync(
    path.join(packDir, "script.lua"),
    'require("edgeware_v0")\nfor i = 1, 12 do\n  audio("voice.wav")\nend\n'
  );
  return packDir;
}

test.beforeAll(() => {
  ensureElectronBuild();
});

test("quitting while running boots idle, not resurrected (no phantom session)", async () => {
  const state = createTempState({ kind: "media" });
  baseSeed(state, state.seedPath, { popupMod: 100, delay: 1000 });
  const first = await launchApp(state);
  try {
    await first.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => first.app.windows().filter((w) => w.url().includes("/popup/")).length)
      .toBeGreaterThanOrEqual(1);
    // Quit WITHOUT Stop.
    await quitApp(first);
  } finally {
    // relaunch below; cleanup deferred
  }

  const second = await launchApp(state);
  try {
    await expect(second.window.locator("[data-testid='start-stop-button']")).toHaveText("Start");
    const before = second.app.windows().filter((w) => w.url().includes("/popup/")).length;
    await new Promise((r) => setTimeout(r, 2500));
    expect(second.app.windows().filter((w) => w.url().includes("/popup/")).length).toBe(before);
  } finally {
    await quitApp(second);
    cleanupTempState(state);
  }
});

test("concurrent settings saves never corrupt config.json", async () => {
  const state = createTempState();
  const configPath = baseSeed(state, state.seedPath);
  const running = await launchApp(state);
  try {
    await running.window.evaluate(() => {
      const api = (window as unknown as {
        api: { system: { saveSettings: (v: Record<string, unknown>) => Promise<void> } };
      }).api;
      return Promise.all(
        Array.from({ length: 10 }, (_, i) => api.system.saveSettings({ writer: i, pad: "x".repeat(20000) }))
      );
    });
    const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as { writer?: number };
    expect(typeof parsed.writer).toBe("number");
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("dirty settings are flushed when the app quits inside the autosave window", async () => {
  const state = createTempState();
  const configPath = baseSeed(state, state.seedPath, { popupMod: 100 });
  const running = await launchApp(state);
  try {
    await running.window.evaluate(() => {
      (
        window as unknown as { __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } } }
      ).__settingsStore.getState().setRaw({ popupMod: 42, safeword: "flush-me" });
    });
    await new Promise((r) => setTimeout(r, 500)); // well inside the 5s autosave
    await quitApp(running);
  } finally {
    /* app gone */
  }
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    expect(cfg.popupMod).toBe(42);
    expect(cfg.safeword).toBe("flush-me");
  } finally {
    cleanupTempState(state);
  }
});

test("a config key named 'save' cannot disable persistence, and missing keys default", async () => {
  const state = createTempState();
  const configPath = baseSeed(state, state.seedPath);
  writeFileSync(configPath, JSON.stringify({ save: 1, load: 2, setRaw: 3, popupMod: 11 }), "utf-8");
  const running = await launchApp(state);
  try {
    const ok = await running.window.evaluate(async () => {
      const store = (
        window as unknown as {
          __settingsStore: { getState: () => Record<string, unknown> };
        }
      ).__settingsStore.getState();
      if (typeof store.save !== "function" || typeof store.setRaw !== "function") return "shadowed";
      (store.setRaw as (v: Record<string, unknown>) => void)({ popupMod: 55 });
      await (store.save as () => Promise<void>)();
      return "ok";
    });
    expect(ok).toBe("ok");
    const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    expect(cfg.popupMod).toBe(55);
    // Method-shadowing keys are dropped, never written back.
    expect(cfg.save).toBeUndefined();
    expect(cfg.setRaw).toBeUndefined();
    // Keys absent from disk fall back to defaults, not stale storage.
    const theme = await running.window.evaluate(
      () =>
        (
          window as unknown as {
            __settingsStore: { getState: () => { themeType: string } };
          }
        ).__settingsStore.getState().themeType
    );
    expect(theme).toBe("Original");
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("Lua audio() honors maxAudio", async () => {
  const state = createTempState();
  const packDir = audioSpamPack(state.packsDir);
  baseSeed(state, packDir, { maxAudio: 1 });
  const running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
  try {
    await running.window.evaluate(() =>
      (window as unknown as { api: { scripting: { runLua: (n: string) => Promise<boolean> } } }).api.scripting.runLua("script.lua")
    );
    await new Promise((r) => setTimeout(r, 1500));
    const chips = running.app.windows().filter((w) => w.url().includes("/popup/audio")).length;
    // Exactly one: the cap holds the other 11 out, and the long tone proves
    // the one that opened is real (0 would mean audio() never spawned).
    expect(chips).toBe(1);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("script-popup closes do not erode the declared popup count", async () => {
  const state = createTempState();
  const packDir = path.join(state.packsDir, "Count Pack");
  mkdirSync(path.join(packDir, "img"), { recursive: true });
  copyFileSync(
    path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "img", "applelw.png"),
    path.join(packDir, "img", "a.png")
  );
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "Count Pack", id: "count", creator: "e2e", version: "1.0", description: "count" })
  );
  writeFileSync(
    path.join(packDir, "script.lua"),
    'require("edgeware_v0")\nfor i = 1, 3 do\n  image("a.png")\nend\nafter(400, function() close_popups() end)\n'
  );
  baseSeed(state, packDir);
  const running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length)
      .toBeGreaterThanOrEqual(1);
    // After the script closes its own popups, the declared count must stay 0.
    await expect
      .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length, {
        timeout: 15000,
      })
      .toBe(0);
    await new Promise((r) => setTimeout(r, 500));
    const declared = await running.window.locator("[data-testid='popup-count']").textContent();
    expect(declared).toMatch(/Active:\s*0/);
    await running.window.locator("[data-testid='start-stop-button']").click();
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("the corruption launch count records one launch per process, not per Start", async () => {
  const state = createTempState({ kind: "corruption" });
  baseSeed(state, state.seedPath, {
    corruptionMode: 1,
    corruptionTrigger: "Launch",
    corruptionLaunches: 1,
  });
  const running = await launchApp(state);
  try {
    // The Launch trigger applies its level on Start — the fixture pack's
    // level 2 flips panicDisabled, which would block the Stop click.
    // corruptionFullPerm gates whether the level config lands at all.
    await running.window.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ corruptionFullPerm: 0, panicDisabled: 0 });
    });
    const button = running.window.locator("[data-testid='start-stop-button']");
    await button.click();
    await expect(button).toHaveText("Stop");
    await button.click();
    await expect(button).toHaveText("Start");
    await button.click();
    await expect(button).toHaveText("Stop");
    await button.click();

    const countFile = path.join(state.dir, "data", "corruption_launches");
    const count = parseInt(readFileSync(countFile, "utf-8"), 10);
    expect(count).toBe(1);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("Stop is clickable by real mouse during a full popup storm", async () => {
  const state = createTempState({ kind: "media" });
  baseSeed(state, state.seedPath, {
    popupMod: 100,
    vidMod: 100,
    audioMod: 100,
    capPopChance: 100,
    movingChance: 100,
    movingSpeed: 50,
    delay: 100,
  });
  const running = await launchApp(state);
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => running.app.windows().length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(10);

    // A real mouse click on Stop must land even with a storm of always-on-top
    // windows around: popups never take window focus.
    await running.window.locator("[data-testid='start-stop-button']").click({ timeout: 8000 });
    await expect
      .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length, {
        timeout: 20000,
      })
      .toBe(0);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
