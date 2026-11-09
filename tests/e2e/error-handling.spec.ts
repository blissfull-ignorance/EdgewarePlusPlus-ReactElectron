import { test, expect } from "@playwright/test";

test.describe("Error Handling — E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("app continues to function after simulating a save error", async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).api;
      if (api && api.system) {
        api.system.saveSettings = async () => {
          throw new Error("Simulated disk full");
        };
      }
    });

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(page.locator("[data-testid='start-stop-button']")).toHaveText("Stop");

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(page.locator("[data-testid='start-stop-button']")).toHaveText("Start");
  });

  test("app UI remains intact after save error is triggered", async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).api;
      if (api && api.system) {
        api.system.saveSettings = async () => {
          throw new Error("Simulated disk full");
         };
       }
     });

    const metadataPanel = page.locator("[data-testid='metadata-panel']");
    await expect(metadataPanel).toBeVisible();

    await page.locator("[data-testid='start-stop-button']").click();
    await page.waitForTimeout(100);
    await expect(metadataPanel).toBeVisible();
  });

  test("save error status badge appears and persists", async ({ page }) => {
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).api;
      if (api && api.system) {
        api.system.saveSettings = async () => {
          throw new Error("Disk full");
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__settingsStore;
      if (store) {
        await store.getState().save();
      }
    });

    await expect(page.locator("[data-testid='save-status-error']")).toBeVisible({
      timeout: 10000,
    });
  });

  test("corruption mode section does not crash with missing data", async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).api;
      if (api && api.corruption) {
        api.corruption.getCurrentLevel = async () => 0;
        api.corruption.getNextLevelTime = async () => null;
      }
    });

    await expect(page.locator("[data-testid='corruption-level']")).toBeVisible();
    await expect(page.locator("[data-testid='corruption-level']")).toContainText("Level: 0");
  });
});
