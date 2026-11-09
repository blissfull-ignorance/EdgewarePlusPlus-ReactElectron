import { test, expect, type Page } from "@playwright/test";
import { launchApp } from "./helpers";

interface SettingsStoreHandle {
  getState: () => { popupMod: number; saveStatus: string; save: () => Promise<void> };
}

async function openPopupModInput(page: Page) {
  await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
  await page.getByRole("tab", { name: "Annoyance / Runtime" }).click();
  return page
    .locator("div.mantine-Group-root")
    .filter({ hasText: "Image Popup Chance" })
    .locator("input:not([type=hidden])");
}

async function readPopupMod(page: Page) {
  return page.evaluate(() => {
    const store = (window as unknown as { __settingsStore: SettingsStoreHandle }).__settingsStore;
    return store.getState().popupMod;
  });
}

async function switchToStatus(page: Page) {
  await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
}

test.describe("Config Persistence", () => {
  test.describe.configure({ timeout: 60_000 });

  test("changing a setting and saving persists the value across a reload", async ({ page }) => {
    await launchApp(page, { persistSettings: true });

    const input = await openPopupModInput(page);
    await expect(input).toHaveValue("100");
    await input.fill("50");

    await switchToStatus(page);
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible({ timeout: 8000 });
    const saveCalls = await page.evaluate(
      () => (window as unknown as { __e2eSaveCalls?: number }).__e2eSaveCalls
    );
    expect(saveCalls ?? 0).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    expect(await readPopupMod(page)).toBe(50);

    const reloaded = await openPopupModInput(page);
    await expect(reloaded).toHaveValue("50");
  });

  test("saveStatus goes through idle → saving → saved → idle cycle", async ({ page }) => {
    await launchApp(page, { persistSettings: true, saveDelayMs: 1500 });

    const input = await openPopupModInput(page);
    await input.fill("50");

    await switchToStatus(page);
    await page.evaluate(() => {
      const store = (window as unknown as { __settingsStore: SettingsStoreHandle }).__settingsStore;
      void store.getState().save();
    });

    await expect(page.locator("[data-testid='save-status-saving']")).toBeVisible();
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible();
    await expect(page.locator("[data-testid='save-status-saved']")).not.toBeVisible({ timeout: 10_000 });
  });
});
