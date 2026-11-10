import { test, expect } from "@playwright/test";
import { launchApp, listRealPacks, parseRGB, getPopupCount, TEST_IMAGE } from "./helpers";

test.describe("First User Smoke Test", () => {
  test.describe.configure({ timeout: 90_000 });

  test("a new user can: open the app, see a pack, change a setting, start, see popups, stop", async ({ page }) => {
    const packs = listRealPacks();
    expect(packs.length).toBeGreaterThan(0);

    await launchApp(page, {
      packs,
      image: TEST_IMAGE,
      settings: { delay: 200, popupMod: 100, vidMod: 0, audioMod: 0 },
    });

    // Legacy "Original" theme surface (#f0f0f0) — styled app chrome, not the
    // browser default white.
    const body = parseRGB(
      await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)
    );
    expect(body).toEqual({ r: 240, g: 240, b: 240 });

    await expect(page.locator("[data-testid='pack-info']")).not.toHaveText("No pack loaded");

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.getByText("General Settings")).toBeVisible();

    await page.getByRole("tab", { name: "Annoyance / Runtime" }).click();
    const popupModInput = page
      .locator("div.mantine-Group-root")
      .filter({ hasText: "Image Popup Chance" })
      .locator("input:not([type=hidden])");
    await popupModInput.fill("80");

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible({ timeout: 8000 });

    const startStop = page.locator("[data-testid='start-stop-button']");
    await startStop.click();
    await expect(startStop).toHaveText("Stop");

    await expect(page.locator("[data-testid='popup-count']")).toHaveText(/Active: [1-9]/);
    expect(await getPopupCount(page)).toBeGreaterThan(0);

    await startStop.click();
    await expect(startStop).toHaveText("Start");
    await expect(page.locator("[data-testid='popup-count']")).toContainText("Active: 0");
  });
});
