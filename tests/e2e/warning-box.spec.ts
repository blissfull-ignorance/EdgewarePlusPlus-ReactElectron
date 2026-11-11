import { test, expect } from "@playwright/test";

/**
 * The warnings box must reflect the live store: a danger switched on shows
 * its line immediately, switching it off removes it — and a corrected schema
 * issue disappears too.
 */
test.describe("Live configuration warnings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
  });

  test("shows and hides the mitosis danger as the value changes", async ({ page }) => {
    await expect(page.locator("[data-testid='validation-errors']")).toHaveCount(0);

    await page.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ mitosisMode: 1 });
    });
    await expect(page.locator("[data-testid='validation-errors']")).toContainText("mitosisMode");

    await page.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ mitosisMode: 0 });
    });
    await expect(page.locator("[data-testid='validation-errors']")).toHaveCount(0);
  });

  test("a corrected invalid value clears its schema line", async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ themeType: "Bogus" });
    });
    await expect(page.locator("[data-testid='validation-errors']")).toContainText("themeType");

    await page.evaluate(() => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ themeType: "Goth" });
    });
    await expect(page.locator("[data-testid='validation-errors']")).toHaveCount(0);
  });
});
