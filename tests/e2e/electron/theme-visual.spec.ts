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
  type TempState,
} from "./launch";

const EVIDENCE_DIR = path.join(__dirname, "..", "..", "..", "work", "05-overnight", "evidence", "themes");

// Legacy Tk theme surfaces: body background and text color per variant.
const THEMES: Array<{
  name: string;
  bg: string;
  fg: string;
}> = [
  { name: "Original", bg: "rgb(240, 240, 240)", fg: "rgb(22, 24, 29)" },
  { name: "Dark", bg: "rgb(23, 27, 38)", fg: "rgb(236, 238, 244)" },
  { name: "The One", bg: "rgb(40, 44, 52)", fg: "rgb(0, 255, 65)" },
  { name: "Ransom", bg: "rgb(132, 18, 18)", fg: "rgb(255, 255, 255)" },
  { name: "Goth", bg: "rgb(40, 44, 52)", fg: "rgb(227, 184, 255)" },
  { name: "Bimbo", bg: "rgb(255, 192, 203)", fg: "rgb(214, 23, 127)" },
];

function bodyColors(running: RunningApp): Promise<{ bg: string; fg: string }> {
  return running.window.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { bg: s.backgroundColor, fg: s.color };
  });
}

test.describe("theme surfaces (legacy Tk palette parity)", () => {
  let cleanup: Array<() => void> = [];
  let running: RunningApp | null = null;
  let state: TempState | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
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
    });
    cleanup.push(() => cleanupTempState(state!));
    running = await launchApp(state);
    cleanup.push(async () => {
      try {
        if (running) await quitApp(running);
      } catch {
        /* noop */
      }
    });
  });

  test.afterAll(async () => {
    while (cleanup.length) cleanup.pop()!();
  });

  for (const theme of THEMES) {
    test(`${theme.name} paints the legacy surfaces`, async () => {
      const app = running!;
      await app.window.evaluate((name) => {
        const store = (
          window as unknown as {
            __settingsStore?: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
          }
        ).__settingsStore;
        store?.getState().setRaw({ themeType: name });
      }, theme.name);

      await expect
        .poll(async () => (await bodyColors(app)).bg, { timeout: 5000 })
        .toBe(theme.bg);
      await expect
        .poll(async () => (await bodyColors(app)).fg, { timeout: 5000 })
        .toBe(theme.fg);

      await app.window.screenshot({ path: path.join(EVIDENCE_DIR, `${theme.name.toLowerCase()}.png`) });
    });
  }
});
