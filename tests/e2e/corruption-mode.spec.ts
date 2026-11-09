import { test, expect } from "@playwright/test";
import { launchApp, listRealPacks } from "./helpers";

interface SettingsStoreHandle {
  getState: () => { corruptionMode: number; setRaw: (values: Record<string, unknown>) => void };
}

async function setCorruptionMode(page: Parameters<typeof launchApp>[0], mode: number) {
  await page.evaluate((m: number) => {
    const store = (window as unknown as { __settingsStore: SettingsStoreHandle }).__settingsStore;
    store.getState().setRaw({ corruptionMode: m });
  }, mode);
}

function corruptionBadge(page: Parameters<typeof launchApp>[0]) {
  return page.locator("[data-testid='corruption-level']").locator("xpath=..");
}

test.describe("Corruption Mode", () => {
  const packs = listRealPacks();

  test.beforeAll(() => {
    expect(packs.length).toBeGreaterThan(0);
  });

  test("corruption mode starts inactive at level 0", async ({ page }) => {
    await launchApp(page, { packs });

    await expect(corruptionBadge(page).getByText("Inactive", { exact: true })).toBeVisible();
    await expect(page.locator("[data-testid='corruption-level']")).toContainText("Level: 0");
    await expect(page.locator("[data-testid='driver-type']")).not.toBeVisible();
    await expect(page.locator("[data-testid='next-level-time']")).not.toBeVisible();
  });

  test("corruption config tab exposes the mode controls", async ({ page }) => {
    await launchApp(page, { packs });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Corruption" }).click();

    await expect(page.getByText("Corruption Mode (Guided Mode)")).toBeVisible();
    await expect(page.getByText("Enable Corruption Mode")).toBeVisible();
    await expect(page.getByText("Trigger Type")).toBeVisible();
    await expect(page.getByText("Time Per Level")).toBeVisible();
    await expect(page.getByText("Popup Count Trigger")).toBeVisible();
    await expect(page.getByTestId("corruption-error-banner")).not.toBeVisible();
  });

  test("enabling corruption mode shows the active level and driver in the metadata panel", async ({
    page,
  }) => {
    await launchApp(page, { packs });
    await setCorruptionMode(page, 1);

    await expect(corruptionBadge(page).getByText("Active", { exact: true })).toBeVisible();
    await expect(page.locator("[data-testid='corruption-level']")).toContainText("Level: 0");
    await expect(page.locator("[data-testid='driver-type']")).toContainText("Driver:");
    await expect(page.locator("[data-testid='next-level-time']")).toContainText("Next transition:");
  });

  test("disabling corruption mode hides the driver details and mood badges again", async ({
    page,
  }) => {
    await launchApp(page, { packs });
    await setCorruptionMode(page, 1);

    const panel = page.locator("[data-testid='metadata-panel']");
    await expect(corruptionBadge(page).getByText("Active", { exact: true })).toBeVisible();
    await expect(panel.locator("[data-testid='active-mood']")).toHaveCount(0);
    await setCorruptionMode(page, 0);

    await expect(corruptionBadge(page).getByText("Inactive", { exact: true })).toBeVisible();
    await expect(page.locator("[data-testid='driver-type']")).not.toBeVisible();
  });
});
