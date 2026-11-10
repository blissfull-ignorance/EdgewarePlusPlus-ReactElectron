import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type RunningApp,
} from "./launch";

const EVIDENCE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "work",
  "05-overnight",
  "evidence",
  "popups"
);

/** Media elements must carry no border, outline or shadow. */
async function assertNoBorder(win: RunningApp["window"], selector: string): Promise<void> {
  const style = await win
    .locator(selector)
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
        outline: s.outlineWidth,
        outlineStyle: s.outlineStyle,
        shadow: s.boxShadow,
      };
    });
  expect(style.borders, `borders on ${selector}`).toEqual(["0px", "0px", "0px", "0px"]);
  expect(style.outlineStyle === "none" || style.outlineWidth === "0px", `outline on ${selector}`).toBe(
    true
  );
  expect(style.shadow === "none", `box-shadow on ${selector}`).toBe(true);
}

async function setSettings(running: RunningApp, settings: Record<string, unknown>): Promise<void> {
  await running.window.evaluate((patch) => {
    (
      window as unknown as {
        __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
      }
    ).__settingsStore.getState().setRaw(patch);
  }, settings);
}

async function closeAllPopups(running: RunningApp): Promise<void> {
  // Silence spawner first so closing windows cannot race fresh spawns.
  await setSettings(running, ALL_OFF);
  await new Promise((r) => setTimeout(r, 1500));
  await running.window.evaluate(() => void window.api.popup.closeAll());
  await expect
    .poll(() => running.app.windows().filter((w) => w.url().includes("/popup/")).length, {
      timeout: 10000,
    })
    .toBe(0);
}

async function waitForPopup(running: RunningApp, routeType: string) {
  const locator = `[data-testid='${routeType}']`;
  const diag: string[] = [];
  const found = await poll(async () => {
    const wins = running.app.windows();
    diag.push(`n=${wins.length}`);
    if (diag.length > 400) diag.shift();
    for (const w of wins) {
      if (!w.url().includes("/popup/")) continue;
      try {
        if ((await w.locator(locator).count()) > 0) return w;
      } catch {
        /* window mid-load */
      }
    }
    return null;
  });
  if (!found) {
    const dump: string[] = [];
    for (const w of running.app.windows()) {
      let ids = "loading";
      try {
        ids = (
          await w.evaluate(() =>
            Array.from(document.querySelectorAll("[data-testid]"))
              .map((e) => e.getAttribute("data-testid"))
              .join(",")
          )
        ).slice(0, 120);
      } catch {
        /* not ready */
      }
      dump.push(`${w.url().split("#")[1] ?? "main"} -> [${ids}]`);
    }
    throw new Error(`no popup with ${locator}. Windows:\n${dump.join("\n")}\nDIAG ${diag.join(",")}`);
  }
  return found;
}

async function poll<T>(fn: () => Promise<T>, timeoutMs = 30000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeoutMs) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
}

const ALL_OFF = {
  popupMod: 0,
  vidMod: 0,
  audioMod: 0,
  promptMod: 0,
  webMod: 0,
  capPopChance: 0,
  notificationChance: 0,
  subliminalsChance: 0,
  denialChance: 0,
  mitosisMode: 0,
};

test.describe("popup visuals (no thick borders; overlays keep media clean)", () => {
  let cleanup: Array<() => void> = [];
  let running: RunningApp | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      showLoadingFlair: 0,
      delay: 1200,
      ...ALL_OFF,
    });
    cleanup.push(() => cleanupTempState(state));
    running = await launchApp(state);
    cleanup.push(async () => {
      try {
        if (running) await quitApp(running);
      } catch {
        /* noop */
      }
    });
    await running.window.locator("[data-testid='start-stop-button']").click();
  });

  test.afterAll(async () => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("image popup: media renders borderless", async () => {
    await setSettings(running!, { ...ALL_OFF, popupMod: 100 });
    const win = await waitForPopup(running!, "image-popup-img");
    await expect
      .poll(
        () =>
          win
            .locator("[data-testid='image-popup-img']")
            .first()
            .evaluate((img) => (img as HTMLImageElement).naturalWidth),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);
    await assertNoBorder(win, "[data-testid='image-popup-img']");
    await win.screenshot({ path: path.join(EVIDENCE_DIR, "image.png") });
    await closeAllPopups(running!);
  });

  test("video popup: media renders borderless", async () => {
    await setSettings(running!, { ...ALL_OFF, vidMod: 100 });
    const win = await waitForPopup(running!, "video-popup-video");
    await expect
      .poll(
        () =>
          win
            .locator("[data-testid='video-popup-video']")
            .first()
            .evaluate((el) => (el as HTMLVideoElement).readyState),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);
    await assertNoBorder(win, "[data-testid='video-popup-video']");
    await win.screenshot({ path: path.join(EVIDENCE_DIR, "video.png") });
    await closeAllPopups(running!);
  });

  test("hypno overlay on an image popup adds no border to the media", async () => {
    await setSettings(running!, { ...ALL_OFF, popupMod: 100, subliminalsChance: 100 });
    const win = await waitForPopup(running!, "hypno-overlay-img");
    await assertNoBorder(win, "[data-testid='image-popup-img']");
    await assertNoBorder(win, "[data-testid='hypno-overlay-img']");
    await win.screenshot({ path: path.join(EVIDENCE_DIR, "hypno-overlay.png") });
    await closeAllPopups(running!);
  });

  test("subliminal text popup renders", async () => {
    await setSettings(running!, { ...ALL_OFF, capPopChance: 100 });
    const win = await waitForPopup(running!, "subliminal-text");
    await win.screenshot({ path: path.join(EVIDENCE_DIR, "subliminal-text.png") });
    await closeAllPopups(running!);
  });

  test("prompt popup renders", async () => {
    await setSettings(running!, { ...ALL_OFF, promptMod: 100 });
    const win = await waitForPopup(running!, "prompt-dialog");
    await win.screenshot({ path: path.join(EVIDENCE_DIR, "prompt.png") });
    await closeAllPopups(running!);
  });

  test("audio popup plays without a visible window body", async () => {
    await setSettings(running!, { ...ALL_OFF, audioMod: 100 });
    const win = await waitForPopup(running!, "audio-popup-audio");
    await expect
      .poll(
        () =>
          win
            .locator("[data-testid='audio-popup-audio']")
            .first()
            .evaluate((el) => (el as HTMLAudioElement).currentTime),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);
    await win.screenshot({ path: path.join(EVIDENCE_DIR, "audio.png") });
    await closeAllPopups(running!);
  });

  test("denial keeps the media borderless", async () => {
    await setSettings(running!, { ...ALL_OFF, popupMod: 100, denialChance: 100 });
    const win = await waitForPopup(running!, "image-popup-img");
    await assertNoBorder(win, "[data-testid='image-popup-img']");
    await win.screenshot({ path: path.join(EVIDENCE_DIR, "denial.png") });
    await closeAllPopups(running!);
  });
});
