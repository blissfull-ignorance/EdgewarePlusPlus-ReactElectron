import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test.describe("Config Access — Tab Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Status view is active by default", async ({ page }) => {
    await expect(page.locator("[data-testid='main-tabs']")).toBeVisible();
    await expect(page.locator("[data-testid='main-tab-status']")).toHaveAttribute("data-active", "true");
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edgeware++" })).toBeVisible();
  });

  test("Clicking Config switches views and exposes every tab", async ({ page }) => {
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.getByText("Edgeware++ Configuration")).toBeVisible();
    await expect(page.locator("[data-testid='main-tab-config']")).toHaveAttribute("data-active", "true");
    await expect(page.locator("[data-testid='main-tab-status']")).not.toHaveAttribute("data-active", "true");
    await expect(page.locator("[data-testid='metadata-panel']")).not.toBeVisible();

    await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Annoyance / Runtime" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Modes" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Corruption" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Troubleshooting" })).toBeVisible();

    await expect(page.getByRole("tab", { name: "Start" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pack Info" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pack Management" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Presets" })).toBeVisible();
  });

  test("Clicking Status returns from the config view", async ({ page }) => {
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await expect(page.getByText("Edgeware++ Configuration")).toBeVisible();

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='start-stop-button']")).toBeVisible();
  });

  test("Gallery and Creator tabs render their panels", async ({ page }) => {
    await launchApp(page);
    await page.locator("[data-testid='main-tab-gallery']").click();
    await expect(page.locator("[data-testid='gallery-panel']")).toBeVisible();

    await page.locator("[data-testid='main-tab-creator']").click();
    await expect(page.locator("[data-testid='creator-panel']")).toBeVisible();

    await page.locator("[data-testid='main-tab-status']").click();
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
  });
});

async function readLkCorner(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __settingsStore: { getState: () => { lkCorner: number } } }).__settingsStore
        .getState().lkCorner
  );
}

test.describe("Modes panel option semantics", () => {
  test("Lowkey Corner labels name the corner the runtime maps that value to", async ({ page }) => {
    await launchApp(page);
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Modes" }).click();

    // Enable lowkey so the corner dropdown is interactive.
    await page.getByLabel("Lowkey Mode").click();
    const corner = page.getByRole("textbox", { name: "Lowkey Corner" });
    await corner.click();

    // lowkeyPosition(): 0 top-right, 1 top-left, 2 bottom-left, 3 bottom-right, 4 random.
    const options = page.locator("[role='listbox']:visible [role='option']");
    await expect(options).toHaveText([
      "Top Right",
      "Top Left",
      "Bottom Left",
      "Bottom Right",
      "Random",
    ]);

    // Pick the non-default entry first so the wiring assertion cannot pass
    // on the untouched default, then pin "Top Right" to value 0.
    await options.filter({ hasText: "Random" }).first().click();
    expect(await readLkCorner(page)).toBe(4);

    await corner.click();
    await page.getByRole("option", { name: "Top Right", exact: true }).click();
    expect(await readLkCorner(page)).toBe(0);
  });
});
