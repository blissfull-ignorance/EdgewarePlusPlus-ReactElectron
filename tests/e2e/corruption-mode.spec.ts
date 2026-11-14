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

  test("the Corruption panel toggle turns the mode on and off", async ({ page }) => {
    await launchApp(page, { packs });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Corruption" }).click();

    const trigger = page.getByRole("textbox", { name: "Trigger Type" });
    const startLevel = page.getByTestId("corruption-start-level");
    await expect(trigger).toBeDisabled();
    await expect(startLevel).toBeDisabled();

    await page.getByLabel("Enable Corruption Mode").click();
    const after = await page.evaluate(
      () =>
        (
          window as unknown as {
            __settingsStore: { getState: () => { corruptionMode: number } };
          }
        ).__settingsStore.getState().corruptionMode
    );
    expect(after).toBe(1);
    await expect(trigger).toBeEnabled();
    await expect(startLevel).toBeEnabled();

    await page.getByLabel("Enable Corruption Mode").click();
    const off = await page.evaluate(
      () =>
        (
          window as unknown as {
            __settingsStore: { getState: () => { corruptionMode: number } };
          }
        ).__settingsStore.getState().corruptionMode
    );
    expect(off).toBe(0);
    await expect(trigger).toBeDisabled();
  });

  test("corruption config tab exposes the mode controls", async ({ page }) => {
    await launchApp(page, { packs });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Corruption" }).click();

    await expect(page.getByText("Corruption Mode", { exact: true })).toBeVisible();
    await expect(page.getByText("Enable Corruption Mode")).toBeVisible();
    await expect(page.getByText("Trigger Type")).toBeVisible();
    await expect(page.getByText("Time Per Level")).toBeVisible();
    await expect(page.getByText("Popup Count Trigger")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Trigger Type" })).toBeDisabled();
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

  test("disabling corruption mode hides the driver details again", async ({ page }) => {
    await launchApp(page, { packs });
    await setCorruptionMode(page, 1);

    await expect(corruptionBadge(page).getByText("Active", { exact: true })).toBeVisible();
    await setCorruptionMode(page, 0);

    await expect(corruptionBadge(page).getByText("Inactive", { exact: true })).toBeVisible();
    await expect(page.locator("[data-testid='driver-type']")).not.toBeVisible();
  });
});
