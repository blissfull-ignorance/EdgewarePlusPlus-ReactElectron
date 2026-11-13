import { test, expect } from "@playwright/test";
import { launchApp, listRealPacks, parseRGB } from "./helpers";

// ember[6] — the default theme (themeType "Original") filled-primary control color under Mantine's
// light color scheme, where `filled` controls resolve to ramp index 6. See src/theme/themeConfig.ts.
const EMBER_6 = { r: 225, g: 29, b: 72 };

test.describe("Visual Regression — styled app", () => {
  test.describe.configure({ timeout: 90_000 });

  test("A18.2 primary filled button uses the theme primary, not native grey", async ({ page }) => {
    await launchApp(page);

    const button = page.locator("[data-testid='start-stop-button']");
    await expect(button).toBeVisible();
    const bg = parseRGB(await button.evaluate((el) => getComputedStyle(el).backgroundColor));
    expect(bg).toEqual(EMBER_6);

    const radius = await button.evaluate((el) => {
      const value = getComputedStyle(el).borderTopLeftRadius;
      return value === "0px" ? 0 : parseFloat(value);
    });
    expect(radius).toBeGreaterThan(0);
  });

  test("keyboard navigation shows a focus ring", async ({ page }) => {
    await launchApp(page);

    await page.locator("[data-testid='main-tab-status']").click();
    await page.keyboard.press("Tab");

    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { testId: null, outlineWidth: 0 };
      return {
        testId: el.getAttribute("data-testid"),
        outlineWidth: parseFloat(getComputedStyle(el).outlineWidth),
      };
    });
    expect(focus.testId).toBe("main-tab-config");
    expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  });

  test("long pack paths truncate with a tooltip", async ({ page }) => {
    const longPath =
      "/very/long/pack/library/location/with/a/lot/of/nested/directories/That/Should/Truncate/Nicely";
    await launchApp(page, { packs: listRealPacks(), settings: { packPath: longPath } });

    const pathEl = page.locator("[data-testid='pack-path']");
    await expect(pathEl).toBeVisible();
    const style = await pathEl.evaluate((el) => {
      const s = getComputedStyle(el);
      return { overflow: s.overflow, textOverflow: s.textOverflow };
    });
    expect(style.overflow).toBe("hidden");
    expect(style.textOverflow).toBe("ellipsis");

    await pathEl.hover();
    await expect(page.getByText(longPath).last()).toBeVisible();
  });

  test("config content scrolls instead of clipping at 800px window height", async ({ page }) => {
    await launchApp(page, { packs: listRealPacks() });
    await page.setViewportSize({ width: 1024, height: 800 });

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Annoyance / Runtime" }).click();
    await page.getByRole("tab", { name: "Popup Tweaks" }).click();

    const scroll = await page
      .locator("[data-testid='app-content']")
      .evaluate((el) => ({
        scrollable: el.scrollHeight > el.clientHeight,
        horizontalOverflow: el.scrollWidth > el.clientWidth,
      }));
    expect(scroll.scrollable).toBe(true);
    expect(scroll.horizontalOverflow).toBe(false);
  });

  test("no-pack state shows icon and one-click CTA into Pack Management", async ({ page }) => {
    await launchApp(page);

    await expect(page.locator("[data-testid='pack-empty-state']")).toContainText("No pack loaded");
    const cta = page.locator("[data-testid='open-pack-manager']");
    await expect(cta).toBeVisible();

    await cta.click();

    await expect(page.getByRole("tab", { name: "Pack Management" })).toBeVisible();
    await expect(page.locator("[data-testid='pack-dropzone']")).toBeVisible();
  });

  test("toast appears on save success", async ({ page }) => {
    await launchApp(page, { persistSettings: true, packs: listRealPacks() });

    // Startup auto-selects the first pack and saves it — that save must toast.
    await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Settings saved")).toBeHidden();

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Annoyance / Runtime" }).click();
    const popupModInput = page
      .locator("div.mantine-Group-root")
      .filter({ hasText: "Image Popup Chance" })
      .locator("input:not([type=hidden])");
    await popupModInput.fill("77");

    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible({ timeout: 8000 });
  });

  test("toast appears on save failure with the error message", async ({ page }) => {
    await launchApp(page, { packs: listRealPacks() });

    await page.evaluate(() => {
      const api = (window as unknown as { api: { system: Record<string, unknown> } }).api;
      api.system.saveSettings = async () => {
        throw new Error("Simulated disk full");
      };
      const store = (
        window as unknown as { __settingsStore: { getState: () => { save: () => Promise<void> } } }
      ).__settingsStore;
      void store.getState().save();
    });

    const toastStack = page.locator("[data-testid='toast-stack']");
    await expect(toastStack.getByText("Couldn't save settings")).toBeVisible({ timeout: 8000 });
    await expect(toastStack.getByText("Simulated disk full")).toBeVisible();
  });
});
