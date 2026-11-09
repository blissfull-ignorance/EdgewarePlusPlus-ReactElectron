import { test, expect } from "@playwright/test";
import { launchApp, listRealPacks, type PackListing } from "./helpers";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function packOptionName(pattern: string) {
  return new RegExp(`^${pattern} \\(v\\d+\\.\\d+\\)$`);
}

function pickSwitchTarget(all: PackListing[]): PackListing | undefined {
  if (all.length < 2) return undefined;
  const preferred = all.find((p) => p.path.endsWith("/CaliaWare v4 NOAI"));
  return preferred ?? all.find((p) => p.path !== all[0].path);
}

test.describe("Pack Loading", () => {
  const packs = listRealPacks();

  test.beforeAll(() => {
    expect(packs.length).toBeGreaterThan(0);
  });

  test("app starts with a pack pre-selected from packs/ directory", async ({ page }) => {
    await launchApp(page, { packs });

    const first = packs[0];
    await expect(page.locator("[data-testid='pack-info']")).not.toHaveText("No pack loaded");
    await expect(page.locator("[data-testid='pack-info']")).toHaveText(first.name);
  });

  test("user can switch packs from Config → General → Pack Management", async ({ page }) => {
    const target = pickSwitchTarget(packs);
    test.skip(!target, "requires at least two packs in packs/ to switch between");
    if (!target) return;

    await launchApp(page, { packs });

    const current = packs[0];

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Pack Management" }).click();

    const packSelect = page.getByRole("textbox", { name: "Available Packs" });
    await expect(packSelect).toHaveValue(packOptionName(escapeRegExp(current.name)));

    await packSelect.click();
    await page
      .getByRole("option", { name: packOptionName(escapeRegExp(target.name)) })
      .click();

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect(page.locator("[data-testid='pack-info']")).toHaveText(target.name);
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible();
  });

  test("pack selector shows name and version metadata from pack info.json", async ({ page }) => {
    await launchApp(page, { packs });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Pack Management" }).click();

    const packSelect = page.getByRole("textbox", { name: "Available Packs" });
    await packSelect.click();

    for (const pack of packs) {
      await expect(
        page.getByRole("option", { name: packOptionName(escapeRegExp(pack.name)) })
      ).toBeVisible();
    }
    await expect(page.getByRole("option", { name: /v\d+\.\d+/ })).toHaveCount(packs.length);
  });

  test("Pack Info tab is reachable from General", async ({ page }) => {
    await launchApp(page, { packs });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Pack Info" }).click();
    await expect(page.getByText("Pack Information")).toBeVisible();
  });
});
