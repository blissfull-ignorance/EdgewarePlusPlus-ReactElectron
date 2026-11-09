import { test, expect } from "@playwright/test";
import { launchApp, parseRGB } from "./helpers";

interface SettingsStoreHandle {
  getState: () => { themeType: string };
}

test.describe("Dark Theme", () => {
  test("app renders with dark color scheme", async ({ page }) => {
    await launchApp(page);

    const body = parseRGB(
      await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)
    );
    expect(body.r).toBeLessThan(128);
    expect(body.g).toBeLessThan(128);
    expect(body.b).toBeLessThan(128);
  });

  test("theme selector in config can be changed without breaking the app", async ({ page }) => {
    await launchApp(page);

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    const startPanel = page
      .locator("div.mantine-Paper-root")
      .filter({ has: page.getByText("Start Settings", { exact: true }) });
    const themeSelect = startPanel.locator("input.mantine-Select-input").first();
    await expect(themeSelect).toHaveValue("Original");

    await themeSelect.click();
    await page.getByRole("option", { name: "Dark" }).click();

    await expect(themeSelect).toHaveValue("Dark");
    const themeType = await page.evaluate(() => {
      const store = (window as unknown as { __settingsStore: SettingsStoreHandle }).__settingsStore;
      return store.getState().themeType;
    });
    expect(themeType).toBe("Dark");

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
  });
});
