import { test, expect, type Page } from "@playwright/test";
import { launchApp } from "./helpers";

interface StoreHandle {
  getState: () => {
    popupMod: number;
    loaded: boolean;
    dirty: boolean;
    saveStatus: string;
    save: () => Promise<void>;
  };
}

function readStore(page: Page) {
  return page.evaluate(() => {
    const store = (window as unknown as { __settingsStore: StoreHandle }).__settingsStore;
    const s = store.getState();
    return { popupMod: s.popupMod, loaded: s.loaded, dirty: s.dirty, saveStatus: s.saveStatus };
  });
}

function lastSaved(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __e2eLastSaved?: Record<string, unknown> }).__e2eLastSaved ?? null
  );
}

function saveCalls(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __e2eSaveCalls?: number }).__e2eSaveCalls ?? 0
  );
}

async function openPopupModInput(page: Page) {
  await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
  await page.getByRole("tab", { name: "Annoyance / Runtime" }).click();
  return page.getByLabel("Image Popup Chance");
}

async function switchToStatus(page: Page) {
  await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
}

test.describe("Config Persistence", () => {
  test.describe.configure({ timeout: 60_000 });

  test("the save payload carries the changed value and no store machinery", async ({ page }) => {
    await launchApp(page, { persistSettings: true });

    const input = await openPopupModInput(page);
    await expect(input).toHaveValue("100");
    await input.fill("80");

    await switchToStatus(page);
    await expect
      .poll(async () => (await lastSaved(page))?.popupMod, { timeout: 8000 })
      .toBe(80);

    const saved = await lastSaved(page);
    // A save must serialize settings values only — never store machinery.
    for (const key of ["saveStatus", "dirty", "loaded", "validationErrors", "save", "setRaw"]) {
      expect(saved).not.toHaveProperty(key);
    }
  });

  test("a reload rehydrates the value from the saved file, not from memory", async ({ page }) => {
    await launchApp(page, { persistSettings: true });

    const input = await openPopupModInput(page);
    await input.fill("50");
    await switchToStatus(page);
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible({ timeout: 8000 });

    await page.reload();
    // Gate on load() resolving, so the value provably came from
    // system:loadSettings rather than the still-warm in-memory store.
    await expect
      .poll(async () => (await readStore(page)).loaded, { timeout: 5000 })
      .toBe(true);
    expect((await readStore(page)).popupMod).toBe(50);

    const reloaded = await openPopupModInput(page);
    await expect(reloaded).toHaveValue("50");
  });

  test("dirty settings are flushed to disk when the page unloads", async ({ page }) => {
    await launchApp(page, { persistSettings: true });

    const input = await openPopupModInput(page);
    await input.fill("65");
    // Reload immediately — before the 5s autosave tick can run.
    await page.reload();
    await expect
      .poll(async () => (await readStore(page)).loaded, { timeout: 5000 })
      .toBe(true);
    expect((await readStore(page)).popupMod).toBe(65);
  });

  test("saves happen on the autosave tick, not per keystroke", async ({ page }) => {
    await launchApp(page, { settings: {} });

    const input = await openPopupModInput(page);
    await input.fill("80");

    // No navigation: the 5s dirty-autosave must surface the saved badge.
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible({ timeout: 6000 });
    const callsAfterFirst = await saveCalls(page);

    await input.fill("70");
    await page.waitForTimeout(1200);
    // An edit right after a save must not trigger an immediate second save.
    expect(await saveCalls(page)).toBe(callsAfterFirst);
    // The next save lands on the following autosave tick — poll the counter,
    // the badge from the first save is still on screen and proves nothing.
    await expect.poll(() => saveCalls(page), { timeout: 8000 }).toBe(callsAfterFirst + 1);
    expect((await lastSaved(page))?.popupMod).toBe(70);
  });

  test("saveStatus goes through saving → saved → idle on an explicit save", async ({ page }) => {
    await launchApp(page, { persistSettings: true, saveDelayMs: 1500 });

    // Nothing has been saved yet: neither badge is on screen (idle).
    await expect(page.locator("[data-testid='save-status-saving']")).toHaveCount(0);
    await expect(page.locator("[data-testid='save-status-saved']")).toHaveCount(0);

    await page.evaluate(() => {
      const store = (window as unknown as { __settingsStore: StoreHandle }).__settingsStore;
      void store.getState().save();
    });

    await expect(page.locator("[data-testid='save-status-saving']")).toBeVisible();
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible();
    await expect(page.locator("[data-testid='save-status-saved']")).not.toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("[data-testid='save-status-saving']")).toHaveCount(0);
  });
});
