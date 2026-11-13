import { test, expect } from "@playwright/test";
import { launchApp, listRealPacks, type PackListing } from "./helpers";

const SYNTHETIC_PACK: PackListing = {
  name: "Second Pack",
  path: "/e2e/second-pack",
  version: "9.9",
};

function optionLabel(pack: PackListing): string {
  return `${pack.name} (v${pack.version || "unknown"})`;
}

test.describe("Pack Loading", () => {
  const realPacks = listRealPacks();
  const packs: PackListing[] = realPacks.length > 0 ? [...realPacks, SYNTHETIC_PACK] : [];

  test("app starts with a pack pre-selected from packs/ directory", async ({ page }) => {
    test.skip(realPacks.length === 0, "requires at least one pack in packs/");
    await launchApp(page, { packs: realPacks });

    await expect(page.locator("[data-testid='pack-info']")).not.toHaveText("No pack loaded");
    await expect(page.locator("[data-testid='pack-info']")).toHaveText(realPacks[0].name);
  });

  test("user can switch packs from Config → General → Pack Management", async ({ page }) => {
    test.skip(realPacks.length === 0, "requires at least one pack in packs/");
    await launchApp(page, { packs });

    const current = realPacks[0];
    const target = SYNTHETIC_PACK;

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Pack Management" }).click();

    const packSelect = page.getByRole("textbox", { name: "Available Packs" });
    await expect(packSelect).toHaveValue(optionLabel(current));

    await packSelect.click();
    await page.getByRole("option", { name: optionLabel(target), exact: true }).click();

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect(page.locator("[data-testid='pack-info']")).toHaveText(target.name);

    // The switch must reach the save payload, not just the badge.
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as unknown as { __e2eLastSaved?: Record<string, unknown> }).__e2eLastSaved
              ?.packPath ?? null
        ),
        { timeout: 8000 }
      )
      .toBe(target.path);
  });

  test("pack selector shows name and version metadata from pack info.json", async ({ page }) => {
    test.skip(realPacks.length === 0, "requires at least one pack in packs/");
    const withVersionless: PackListing[] = [
      ...packs,
      { name: "Versionless Pack", path: "/e2e/versionless" },
    ];
    await launchApp(page, { packs: withVersionless });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Pack Management" }).click();

    const packSelect = page.getByRole("textbox", { name: "Available Packs" });
    await packSelect.click();

    for (const pack of withVersionless) {
      await expect(page.getByRole("option", { name: optionLabel(pack), exact: true })).toBeVisible();
    }
  });

  test("Pack Info tab is reachable from General", async ({ page }) => {
    test.skip(realPacks.length === 0, "requires at least one pack in packs/");
    await launchApp(page, { packs: realPacks });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Pack Info" }).click();
    await expect(page.getByText("Pack Information")).toBeVisible();
  });
});
