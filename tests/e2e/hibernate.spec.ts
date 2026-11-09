import { test, expect } from "@playwright/test";

test.describe("Hibernate Mode — Status Display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("hibernate shows as disabled by default", async ({ page }) => {
    await expect(page.locator("[data-testid='hibernate-countdown']")).toBeVisible();
    await expect(page.locator("[data-testid='metadata-panel']").getByText("Disabled")).toBeVisible();
  });

  test("hibernate countdown shows placeholder when disabled", async ({ page }) => {
    const hibernateCountdown = page.locator("[data-testid='hibernate-countdown']");
    await expect(hibernateCountdown).toBeVisible();
    await expect(hibernateCountdown).toContainText("Countdown:");
  });

  test("hibernate section is visible in metadata panel", async ({ page }) => {
    await expect(page.locator("[data-testid='metadata-panel']").getByText("Hibernate")).toBeVisible();
  });

  test("hibernate state persists through start/stop interactions", async ({ page }) => {
    const startStopButton = page.locator("[data-testid='start-stop-button']");
    await startStopButton.click();
    await expect(page.locator("[data-testid='metadata-panel']").getByText("Disabled")).toBeVisible();
    await startStopButton.click();
    await expect(page.locator("[data-testid='metadata-panel']").getByText("Disabled")).toBeVisible();
  });
});
