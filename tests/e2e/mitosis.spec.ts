import { test, expect } from "@playwright/test";

test.describe("Mitosis Mode — Auto-spawn Display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("mitosis shows as inactive by default", async ({ page }) => {
    await expect(page.locator("[data-testid='mitosis-indicator']")).toContainText("Inactive");
  });

  test("mitosis section is visible in metadata panel", async ({ page }) => {
    await expect(page.locator("[data-testid='metadata-panel']").getByText("Mitosis")).toBeVisible();
  });

  test("popup count starts at 0 when no popups spawned", async ({ page }) => {
    await expect(page.locator("[data-testid='popup-count']")).toContainText("Active: 0");
  });

  test("popup count remains 0 after start/stop when no popups spawned", async ({ page }) => {
    const startStopButton = page.locator("[data-testid='start-stop-button']");
    await startStopButton.click();
    await startStopButton.click();
    await expect(page.locator("[data-testid='popup-count']")).toContainText("Active: 0");
  });
});
