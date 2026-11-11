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
const AUD_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "aud");

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

/** Pack whose script chains audio → on_stop → corrupt → next audio. */
function writeChainPack(packsDir: string): string {
  const packDir = path.join(packsDir, "Chain Pack");
  mkdirSync(path.join(packDir, "aud"), { recursive: true });
  copyFileSync(path.join(AUD_DIR, "think.wav"), path.join(packDir, "aud", "voice.wav"));
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "Chain Pack", id: "chain", creator: "e2e", version: "1.0", description: "chain" })
  );
  writeFileSync(
    path.join(packDir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: [], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" },
      moods: [],
    })
  );
  const moods: Record<string, unknown> = {};
  for (let i = 1; i <= 10; i++) moods[String(i)] = { add: [`m${i}`], remove: [] };
  writeFileSync(path.join(packDir, "corruption.json"), JSON.stringify({ moods, wallpapers: {}, config: {} }));
  writeFileSync(
    path.join(packDir, "script.lua"),
    'require("edgeware_v0")\nfunction chain()\n  corrupt()\n  audio(nil, chain)\nend\naudio(nil, chain)\n'
  );
  return packDir;
}

function waitForExit(app: RunningApp["app"], ms = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      app.process().kill("SIGKILL");
      resolve(false);
    }, ms);
    app.process().once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function currentLevel(window: RunningApp["window"]): Promise<number> {
  return window.evaluate(() =>
    (
      window as unknown as { api: { corruption: { getCurrentLevel: () => Promise<number> } } }
    ).api.corruption.getCurrentLevel()
  );
}

test.beforeAll(() => {
  ensureElectronBuild();
});

test("panic kills a live script chain instead of drowning in respawned popups", async () => {
  const state = createTempState();
  const packDir = writeChainPack(state.packsDir);
  baseSeed(state, packDir);
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => currentLevel(running.window), { timeout: 30000 })
      .toBeGreaterThanOrEqual(1);

    await running.window.evaluate(() =>
      (window as unknown as { api: { panic: { trigger: () => Promise<unknown> } } }).api.panic.trigger()
    );
    expect(await waitForExit(running.app)).toBe(true);
  } finally {
    try {
      await quitApp(running);
    } catch {
      /* already exited */
    }
    cleanupTempState(state);
  }
});

test("closing the main window mid-chain tears the session down and exits", async () => {
  const state = createTempState();
  const packDir = writeChainPack(state.packsDir);
  baseSeed(state, packDir);
  const running = await launchApp(state, {
    EDGWARE_STUB_BROWSER: "1",
    EDGWARE_PANIC_SKIP_WALLPAPER: "1",
  });
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => currentLevel(running.window), { timeout: 30000 })
      .toBeGreaterThanOrEqual(1);

    await running.window.close();
    expect(await waitForExit(running.app)).toBe(true);
  } finally {
    try {
      await quitApp(running);
    } catch {
      /* already exited */
    }
    cleanupTempState(state);
  }
});

test("a runaway script loop cannot freeze the app", async () => {
  const state = createTempState();
  const packDir = path.join(state.packsDir, "Loop Pack");
  mkdirSync(packDir, { recursive: true });
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "Loop Pack", id: "loop", creator: "e2e", version: "1.0", description: "loop" })
  );
  writeFileSync(path.join(packDir, "script.lua"), "while true do end\n");
  baseSeed(state, packDir);
  const running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();

    // The execution budget aborts the loop: the app answers again promptly.
    await expect
      .poll(
        () => running.window.evaluate(() => 1 + 1).catch(() => 0),
        { timeout: 15000 }
      )
      .toBe(2);

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect(running.window.locator("[data-testid='start-stop-button']")).toHaveText("Start", {
      timeout: 15000,
    });
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("a popup for broken media closes itself instead of lingering", async () => {
  const state = createTempState({ kind: "media" });
  writeFileSync(path.join(state.seedPath, "img", "zero.png"), "");
  baseSeed(state, state.seedPath);
  const running = await launchApp(state);
  try {
    const popupPromise = running.app.waitForEvent("window");
    await running.window.evaluate(() =>
      (
        window as unknown as { api: { popup: { create: (t: string, m: string) => Promise<unknown> } } }
      ).api.popup.create("image", "zero.png")
    );
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");

    // The decode fails (0-byte file) and the popup must go away on its own.
    await expect
      .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length, {
        timeout: 15000,
      })
      .toBe(0);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("a non-numeric delay cannot collapse the popup cadence into a flood", async () => {
  const state = createTempState({ kind: "media" });
  baseSeed(state, state.seedPath, { popupMod: 100, delay: "fast" });
  const running = await launchApp(state);
  try {
    await running.window.locator("[data-testid='start-stop-button']").click();
    await new Promise((r) => setTimeout(r, 2000));
    const count = running.app.windows().filter((w) => w.url().includes("/popup/")).length;
    // A NaN interval would fire at the ~4ms clamp (hundreds of spawns); the
    // guarded default cadence allows only a couple in two seconds.
    expect(count).toBeLessThan(25);

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length, {
        timeout: 15000,
      })
      .toBe(0);
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});

test("a scheduled session arms on cold boot and keeps the danger disclosure", async () => {
  const state = createTempState({ kind: "corruption" });
  baseSeed(state, state.seedPath, {
    schedule: 1,
    scheduleTime: 0,
    corruptionMode: 1,
    corruptionFullPerm: 1,
    corruptionTrigger: "Timed",
    corruptionTime: 60000,
  });
  const running = await launchApp(state);
  try {
    // The scheduler fires without any reload — and routes through the same
    // start path as the Start button, so the danger modal gates the session.
    await expect(running.window.locator("[data-testid='corruption-danger-modal']")).toBeVisible({
      timeout: 30000,
    });
    await running.window.locator("[data-testid='danger-cancel']").click();
    await expect(running.window.locator("[data-testid='start-stop-button']")).toHaveText("Start");
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
