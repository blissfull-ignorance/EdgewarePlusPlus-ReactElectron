import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

test.describe("Error Handling — E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("a failed save shows the error badge with its message and recovers on the next success", async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const w = window as unknown as {
        api: { system: { saveSettings: (settings: Record<string, unknown>) => Promise<void> } };
        __settingsStore: { getState: () => { save: () => Promise<void> } };
      };
      w.api.system.saveSettings = async () => {
        throw new Error("Disk full");
      };
      await w.__settingsStore.getState().save();
    });

    await expect(page.locator("[data-testid='save-status-error']")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-testid='save-status-error-message']")).toContainText("Disk full");
    const dirtyAfterFailure = await page.evaluate(
      () =>
        (
          window as unknown as {
            __settingsStore: { getState: () => { dirty: boolean } };
          }
        ).__settingsStore.getState().dirty
    );
    expect(dirtyAfterFailure).toBe(true);

    // Recovery: once the bridge works again, the next save clears the error.
    await page.evaluate(async () => {
      const w = window as unknown as {
        api: { system: { saveSettings: (settings: Record<string, unknown>) => Promise<void> } };
        __settingsStore: { getState: () => { save: () => Promise<void> } };
      };
      w.api.system.saveSettings = async () => undefined;
      await w.__settingsStore.getState().save();
    });
    await expect(page.locator("[data-testid='save-status-saved']")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-testid='save-status-error']")).toHaveCount(0);
  });

  test("corruption IPC failures leave the panel reading level 0", async ({ page }) => {
    await launchApp(page, { corruptionIpcFails: true });
    await expect(page.locator("[data-testid='corruption-level']")).toContainText("Level: 0");
    await expect(page.getByText("Settings Error")).toHaveCount(0);
    await expect(page.getByText("Gallery Error")).toHaveCount(0);
  });

  test("a crashing gallery panel falls back without taking the shell down", async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).api;
      api.pack.listGallery = async () => ({ entries: null, moods: [], activeMoods: [], favourites: [] });
    });

    await page.locator("[data-testid='main-tab-gallery']").click();
    await expect(page.getByText("Gallery Error")).toBeVisible({ timeout: 10_000 });

    // The shell keeps working around the broken panel.
    await page.locator("[data-testid='main-tab-status']").click();
    await expect(page.locator("[data-testid='metadata-panel']")).toBeVisible();
    await page.locator("[data-testid='start-stop-button']").click();
    await expect(page.locator("[data-testid='start-stop-button']")).toHaveText("Stop");
    await page.locator("[data-testid='start-stop-button']").click();
    await expect(page.locator("[data-testid='start-stop-button']")).toHaveText("Start");
  });
});

test.describe("In-window panic key", () => {
  test("Escape panics from the page but never while typing in a field", async ({ page }) => {
    await launchApp(page, { settings: { panicButton: "Key.Escape" } });

    await page.evaluate(() => {
      const w = window as unknown as {
        __panicCalls?: number;
        api: { panic: { trigger: () => Promise<{ ok: boolean }> } };
      };
      w.__panicCalls = 0;
      const original = w.api.panic.trigger.bind(w.api.panic);
      w.api.panic.trigger = async () => {
        w.__panicCalls = (w.__panicCalls ?? 0) + 1;
        return original();
      };
    });

    // Typing context: Escape in a focused input must not panic.
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Annoyance / Runtime" }).click();
    await page.getByLabel("Image Popup Chance").click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => (window as unknown as { __panicCalls?: number }).__panicCalls)
    ).toBe(0);

    // Page context: the same key must panic exactly once.
    await page.getByRole("heading", { name: "Edgeware++ Configuration" }).click();
    await page.keyboard.press("Escape");
    await expect
      .poll(async () =>
        page.evaluate(() => (window as unknown as { __panicCalls?: number }).__panicCalls)
      )
      .toBe(1);
  });
});
