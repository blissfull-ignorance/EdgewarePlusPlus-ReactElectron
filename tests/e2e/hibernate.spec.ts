import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

// The hibernate scheduler is not yet mounted in the renderer (the badge and
// countdown reflect the setting only), so this layer pins exactly that.
test.describe("Hibernate Mode — Status Display", () => {
  test("the badge and countdown follow the hibernateMode setting", async ({ page }) => {
    await launchApp(page, { settings: { hibernateMode: 0 } });
    await expect(page.getByTestId("hibernate-state")).toHaveText("Disabled");
    await expect(page.getByTestId("hibernate-countdown")).toHaveText("Countdown: —");

    await page.evaluate(() => {
      const store = (window as unknown as {
        __settingsStore: { getState: () => { setRaw: (p: Record<string, unknown>) => void } };
      }).__settingsStore;
      store.getState().setRaw({ hibernateMode: 1 });
    });
    await expect(page.getByTestId("hibernate-state")).toHaveText("Enabled, Idle");
  });
});
