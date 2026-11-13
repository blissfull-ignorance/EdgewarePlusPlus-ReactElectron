import { test, expect } from "@playwright/test";

test.describe("Main App Page — Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("metadata panel shows every section with its initial state", async ({ page }) => {
    await expect(page.locator("[data-testid='popup-count']")).toHaveText("Active: 0");
    await expect(page.locator("[data-testid='corruption-level']")).toContainText("Level: 0");
    await expect(page.locator("[data-testid='pack-empty-state']")).toBeVisible();
    await expect(page.locator("[data-testid='mitosis-indicator']")).toContainText("Inactive");
    await expect(page.getByTestId("hibernate-state")).toHaveText("Disabled");
    await expect(page.getByTestId("hibernate-countdown")).toHaveText("Countdown: —");
  });

  test("the mitosis badge reflects the mode and strength settings", async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as unknown as {
        __settingsStore: { getState: () => { setRaw: (p: Record<string, unknown>) => void } };
      }).__settingsStore;
      store.getState().setRaw({ mitosisMode: 1, mitosisStrength: 3 });
    });
    await expect(page.getByTestId("mitosis-indicator")).toHaveText("Active (strength: 3)");
  });

  test("running state badge updates on start/stop", async ({ page }) => {
    const badge = page.locator("[data-testid='running-state']");
    await expect(badge).toHaveText("Stopped");

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(badge).toHaveText("Running");

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(badge).toHaveText("Stopped");
  });
});

test.describe("Start/Stop — Toggle Round-Trip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("start/stop toggle round-trips consistently across multiple cycles", async ({ page }) => {
    const startStopButton = page.locator("[data-testid='start-stop-button']");
    await expect(startStopButton).toHaveText("Start");

    await startStopButton.click();
    await expect(startStopButton).toHaveText("Stop");
    await startStopButton.click();
    await expect(startStopButton).toHaveText("Start");

    await startStopButton.click();
    await expect(startStopButton).toHaveText("Stop");
    await startStopButton.click();
    await expect(startStopButton).toHaveText("Start");
  });

  test("rapid toggling leaves a coherent session, and Stop settles the count to zero", async ({
    page,
  }) => {
    const startStopButton = page.locator("[data-testid='start-stop-button']");

    for (let i = 0; i < 5; i++) {
      await startStopButton.click();
      await page.waitForTimeout(100);
    }
    // Odd number of clicks: the session must end running.
    await expect(startStopButton).toHaveText("Stop");

    await startStopButton.click();
    await expect(startStopButton).toHaveText("Start");
    await expect(page.locator("[data-testid='popup-count']")).toHaveText("Active: 0");
    await page.waitForTimeout(2000);
    await expect(page.locator("[data-testid='popup-count']")).toHaveText("Active: 0");
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
  });
});
