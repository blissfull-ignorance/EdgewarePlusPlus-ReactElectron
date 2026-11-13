import { test, expect, type Page } from "@playwright/test";
import { launchApp } from "./helpers";

function readDelay(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as { __settingsStore: { getState: () => { delay: number } } }
    ).__settingsStore.getState().delay
  );
}

// The round-3 regression: a pack's level config permanently rewrote the
// user's settings. Overrides must be session-scoped — captured on first
// touch, restored on Stop, and mirrored to disk for the crash path.
test.describe("Corruption session-scoped settings", () => {
  test.describe.configure({ timeout: 60_000 });

  const corruption = {
    moods: { "1": { add: ["session-test"], remove: [] } },
    config: { "1": { delay: 12500 } },
  };

  test("a level override applies on Start and is reverted on Stop", async ({ page }) => {
    await launchApp(page, {
      corruption,
      settings: {
        corruptionMode: 1,
        corruptionFullPerm: 1,
        corruptionTrigger: "Script",
        delay: 5000,
        popupMod: 0,
      },
    });

    expect(await readDelay(page)).toBe(5000);

    const startStop = page.locator("[data-testid='start-stop-button']");
    await startStop.click();

    await expect.poll(() => readDelay(page), { timeout: 10_000 }).toBe(12500);

    // The pre-session value was captured for the disk baseline exactly once.
    const baselines = await page.evaluate(
      () => (window as unknown as { __e2eBaselines?: Record<string, unknown>[] }).__e2eBaselines ?? []
    );
    expect(baselines.length).toBeGreaterThanOrEqual(1);
    expect(baselines[0]).toEqual({ delay: 5000 });

    await startStop.click();
    await expect.poll(() => readDelay(page), { timeout: 10_000 }).toBe(5000);
    expect(
      await page.evaluate(
        () => (window as unknown as { __e2eRevertCalls?: number }).__e2eRevertCalls ?? 0
      )
    ).toBe(1);
  });

  test("without full permission the level config never touches settings", async ({ page }) => {
    await launchApp(page, {
      corruption,
      settings: {
        corruptionMode: 1,
        corruptionFullPerm: 0,
        corruptionTrigger: "Script",
        delay: 5000,
        popupMod: 0,
      },
    });

    const startStop = page.locator("[data-testid='start-stop-button']");
    await startStop.click();
    await expect(page.locator("[data-testid='running-state']")).toHaveText("Running");
    await page.waitForTimeout(1000);
    expect(await readDelay(page)).toBe(5000);

    const baselines = await page.evaluate(
      () => (window as unknown as { __e2eBaselines?: Record<string, unknown>[] }).__e2eBaselines ?? []
    );
    expect(baselines).toEqual([]);
    await startStop.click();
  });
});
