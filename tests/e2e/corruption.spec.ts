import { test, expect } from "@playwright/test";

test.describe("Corruption Mode — Level Transitions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("corruption mode displays initial inactive state", async ({ page }) => {
    await expect(page.locator("[data-testid='corruption-level']")).toContainText("Level: 0");
    await expect(page.locator("[data-testid='driver-type']")).not.toBeVisible();
  });

  test("corruption level is displayed in metadata panel", async ({ page }) => {
    const corruptionLevel = page.locator("[data-testid='corruption-level']");
    await expect(corruptionLevel).toBeVisible();
    await expect(corruptionLevel).toContainText("Level:");
  });

  test("corruption mode badge is present", async ({ page }) => {
    await expect(page.locator("[data-testid='metadata-panel']").getByText("Corruption Mode")).toBeVisible();
  });

  test("active moods section renders when corruption is configured", async ({ page }) => {
    const metadataPanel = page.locator("[data-testid='metadata-panel']");
    await expect(metadataPanel).toBeVisible();
    await expect(metadataPanel.getByText("Corruption Mode")).toBeVisible();
  });

  test("next level time displays placeholder when no corruption active", async ({ page }) => {
    const nextLevelTime = page.locator("[data-testid='next-level-time']");
    await expect(nextLevelTime).not.toBeVisible();
  });
});
