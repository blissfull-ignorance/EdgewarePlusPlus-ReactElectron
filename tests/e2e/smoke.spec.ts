import { test, expect } from "@playwright/test";
import { launchApp, getPopupCount, TEST_IMAGE } from "./helpers";

test.describe("First User Smoke Test", () => {
  test.describe.configure({ timeout: 90_000 });

  test("a new user can: open the app, see a pack, change a setting, start, spawn popups, stop", async ({
    page,
  }) => {
    await launchApp(page, {
      packs: [{ name: "Smoke Pack", path: "/e2e/smoke-pack", version: "1.0" }],
      image: TEST_IMAGE,
      settings: { delay: 200, popupMod: 100, vidMod: 0, audioMod: 0 },
    });

    await expect(page.locator("[data-testid='pack-info']")).toHaveText("Smoke Pack");

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.getByText("General Settings")).toBeVisible();

    await page.getByRole("tab", { name: "Annoyance / Runtime" }).click();
    await page.getByLabel("Image Popup Chance").fill("80");

    // The edit must land in the store, not just the input.
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as {
              __settingsStore: { getState: () => { popupMod: number } };
            }
          ).__settingsStore.getState().popupMod
      )
    ).toBe(80);

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as unknown as { __e2eLastSaved?: Record<string, unknown> }).__e2eLastSaved
              ?.popupMod
        ),
        { timeout: 8000 }
      )
      .toBe(80);

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
