import { test, expect } from "@playwright/test";
import { launchApp, listRealPacks, parseRGB } from "./helpers";

// ember[8] — the default theme (themeType "Original") filled-primary control color under Mantine's
// dark color scheme, where `filled` controls resolve to ramp index 8. See src/theme/themeConfig.ts.
const EMBER_8 = { r: 136, g: 19, b: 55 };

test.describe("Visual Regression — styled app", () => {
  test.describe.configure({ timeout: 90_000 });

  test("A18.1 Mantine CSS is loaded: ≥50 --mantine-* vars on :root and mantine- component rules", async ({
    page,
  }) => {
    await launchApp(page);

    const varCount = await page.evaluate(() => {
      let count = 0;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          const selectorText = rule.selectorText || "";
          if (selectorText === ":root" || selectorText === "html") {
            for (const name of Array.from(rule.style || [])) {
              if (name.startsWith("--mantine-")) count += 1;
            }
          }
        }
      }
      return count;
    });
    expect(varCount).toBeGreaterThanOrEqual(50);

    const styles = await page.evaluate(() => {
      let mantineComponentRules = 0;
      let totalRules = 0;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          totalRules += 1;
          const selectorText = (rule as { selectorText?: string }).selectorText;
          if (selectorText && /(^|[\s.,:>+~])mantine-/.test(selectorText)) {
            mantineComponentRules += 1;
          }
        }
      }
      return { mantineComponentRules, totalRules };
    });
    expect(styles.totalRules).toBeGreaterThan(0);
    expect(styles.mantineComponentRules).toBeGreaterThan(0);
  });

  test("A18.2 primary filled button uses the theme primary, not native grey", async ({ page }) => {
    await launchApp(page);

    const button = page.locator("[data-testid='start-stop-button']");
    await expect(button).toBeVisible();
    const bg = parseRGB(await button.evaluate((el) => getComputedStyle(el).backgroundColor));
    expect(bg).toEqual(EMBER_8);

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
      if (!el) return { outlineWidth: 0 };
      return { outlineWidth: parseFloat(getComputedStyle(el).outlineWidth) };
    });
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
