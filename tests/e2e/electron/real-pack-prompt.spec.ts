import { expect, test } from "@playwright/test";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

const PHRASES = ["default", "I find prompts annoying to test, so this will only pop up at corruption levels 4 or 5."];

function seed(mode: "electron" | "inapp") {
  const state = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    popupRenderMode: mode,
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 100,
    webMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    mitosisMode: 0,
    delay: 5000,
  });
  return state;
}

test.describe("user-fix — prompt popups spawn from pack prompts (electron + in-app)", () => {
  let cleanup: Array<() => void> = [];
  test.beforeAll(async () => {
    ensureElectronBuild();
  });
  test.afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("electron mode: popup window shows the phrase on its own line; typing it back closes the popup", async () => {
    const state = seed("electron");
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => { try { await quitApp(running); } catch { /* noop */ } });

    expect(await running.window.locator("[data-testid='pack-info']").count()).toBe(1);
    await running.window.locator("[data-testid='start-stop-button']").click();

    let found: { page: import("@playwright/test").Page; phrase: string } | null = null;
    await expect
      .poll(async () => {
        for (const w of running.app.windows()) {
          try {
            if ((await w.locator('[data-testid="prompt-dialog"]').count()) === 0) continue;
            const t = (await w.locator('[data-testid="prompt-phrase"]').first().innerText()).trim();
            if (PHRASES.includes(t)) { found = { page: w, phrase: t }; return true; }
          } catch { /* mid-close */ }
        }
        return false;
      }, { timeout: 60000 })
      .toBe(true);

    // Legacy layout: title is the pack command, the type-it-back phrase has its line.
    await expect(found!.page.locator('[data-testid="prompt-phrase"]')).toHaveText(found!.phrase);

    await found!.page.locator('[data-testid="prompt-input"]').fill(found!.phrase);
    await found!.page.locator('[data-testid="prompt-submit"]').click();

    // Exactly that dialog must disappear (new ticks may spawn other pops).
    await expect
      .poll(async () => {
        try {
          return (await found!.page.locator('[data-testid="prompt-dialog"]').count()) === 0;
        } catch {
          return true; /* window already closed */
        }
      }, { timeout: 20000 })
      .toBe(true);

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect.poll(async () => running.app.windows().length, { timeout: 30000 }).toBe(1);
  });

  test("in-app mode: a prompt popup appears in the overlay and closes on the correct answer", async () => {
    const state = seed("inapp");
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => { try { await quitApp(running); } catch { /* noop */ } });

    expect(await running.window.locator("[data-testid='pack-info']").count()).toBe(1);
    await running.window.locator("[data-testid='start-stop-button']").click();

    const dialog = running.window.locator('[data-testid="in-app-popup"] [data-testid="prompt-dialog"]');
    await expect.poll(async () => (await dialog.count()) > 0, { timeout: 60000 }).toBe(true);

    const phrase = (await dialog.locator('[data-testid="prompt-phrase"]').first().innerText()).trim();
    expect(PHRASES).toContain(phrase);
    await expect(dialog.locator('[data-testid="prompt-phrase"]')).toHaveText(phrase);

    const before = await dialog.count();
    await dialog.first().locator('[data-testid="prompt-input"]').fill(phrase);
    await dialog.first().locator('[data-testid="prompt-submit"]').click();

    await expect.poll(async () => (await dialog.count()) < before, { timeout: 20000 }).toBe(true);

    await running.window.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(async () => running.app.windows().length === 1 && (await running.window.locator('[data-testid="in-app-popup"]').count()) === 0, { timeout: 30000 })
      .toBe(true);
  });
});
