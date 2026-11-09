import { test, expect } from "@playwright/test";

test.describe("Main App Page — Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("app loads and renders the main page", async ({ page }) => {
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edgeware++" })).toBeVisible();
  });

  test("start button changes to stop when clicked", async ({ page }) => {
    const startStopButton = page.locator("[data-testid='start-stop-button']");
    await expect(startStopButton).toHaveText("Start");

    await startStopButton.click();
    await expect(startStopButton).toHaveText("Stop");

    await startStopButton.click();
    await expect(startStopButton).toHaveText("Start");
  });

  test("metadata panel displays all sections in initial state", async ({ page }) => {
    await expect(page.locator("[data-testid='popup-count']")).toBeVisible();
    await expect(page.locator("[data-testid='corruption-level']")).toBeVisible();
    await expect(page.locator("[data-testid='pack-empty-state']")).toBeVisible();
    await expect(page.locator("[data-testid='mitosis-indicator']")).toBeVisible();
    await expect(page.locator("[data-testid='hibernate-countdown']")).toBeVisible();
  });

  test("popup count shows 0 initially", async ({ page }) => {
    await expect(page.locator("[data-testid='popup-count']")).toContainText("Active: 0");
  });

  test("running state badge updates on start/stop", async ({ page }) => {
    const badge = page.locator("[data-testid='running-state']");
    await expect(badge).toHaveText("Stopped");

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(badge).toHaveText("Running");

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(badge).toHaveText("Stopped");
  });

  test("corruption mode shows inactive initially", async ({ page }) => {
    await expect(page.locator("[data-testid='corruption-level']")).toContainText("Level: 0");
  });

  test("hibernate shows disabled initially", async ({ page }) => {
    await expect(page.locator("[data-testid='metadata-panel']").getByText("Disabled")).toBeVisible();
  });

  test("mitosis shows inactive initially", async ({ page }) => {
    await expect(page.locator("[data-testid='mitosis-indicator']")).toContainText("Inactive");
  });
});

test.describe("Start/Stop — Toggle Round-Trip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("start/stop toggle round-trips consistently across multiple cycles", async ({ page }) => {
    const startStopButton = page.locator("[data-testid='start-stop-button']");

    await startStopButton.click();
    await expect(startStopButton).toHaveText("Stop");
    await startStopButton.click();
    await expect(startStopButton).toHaveText("Start");

    await startStopButton.click();
    await expect(startStopButton).toHaveText("Stop");
    await startStopButton.click();
    await expect(startStopButton).toHaveText("Start");
  });

  test("app state remains consistent after rapid start/stop interactions", async ({ page }) => {
    const startStopButton = page.locator("[data-testid='start-stop-button']");

    for (let i = 0; i < 5; i++) {
      await startStopButton.click();
      await page.waitForTimeout(100);
    }

    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='popup-count']")).toBeVisible();
  });
});
