import { test, expect } from "@playwright/test";

test.describe("Config Access — Tab Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("MainAppPage renders with Status tab active by default", async ({ page }) => {
    await expect(page.locator("[data-testid='main-tabs']")).toBeVisible();
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edgeware++" })).toBeVisible();
  });

  test("Clicking Config tab switches view to ConfigPage", async ({ page }) => {
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.getByText("Edgeware++ Configuration")).toBeVisible();
    await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Annoyance / Runtime" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Modes" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Corruption" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Troubleshooting" })).toBeVisible();
  });

  test("Clicking Status tab returns to status view", async ({ page }) => {
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.getByText("Edgeware++ Configuration")).toBeVisible();

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='start-stop-button']")).toBeVisible();
  });

  test("Config tab shows General sub-tabs including Pack Management", async ({ page }) => {
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.getByText("Edgeware++ Configuration")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Start" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pack Info" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pack Management" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Presets" })).toBeVisible();
  });

  test("Config view does not show metadata panel", async ({ page }) => {
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.locator("[data-testid='metadata-panel']")).not.toBeVisible();
  });
});
