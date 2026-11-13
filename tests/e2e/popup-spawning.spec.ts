import { test, expect, type Page } from "@playwright/test";
import { getPopupCount, TEST_IMAGE, TEST_VIDEO } from "./helpers";

type SettingsStore = {
  getState: () => Record<string, unknown>;
  setState: (values: Record<string, unknown>) => void;
};

async function setupPage(page: Page, overrides: Record<string, unknown> = {}) {
  await page.goto("/");
  await page.evaluate(
    ([img, o]: [string, Record<string, unknown>]) => {
      const api = (window as unknown as { api: { pack: Record<string, unknown> } }).api;
      api.pack.randomImage = async () => img;
      api.pack.randomVideo = async () => null;
      api.pack.randomAudio = async () => null;

      const store = (window as unknown as { __settingsStore: SettingsStore }).__settingsStore;
      store.setState({
        popupMod: 100,
        vidMod: 0,
        audioMod: 0,
        promptMod: 0,
        capPopChance: 0,
        subliminalsChance: 0,
        webMod: 0,
        mitosisMode: 0,
        delay: 200,
        ...o,
      });
    },
    [TEST_IMAGE, overrides]
  );
}

async function recordCreateTypes(page: Page) {
  await page.evaluate(() => {
    const api = (window as unknown as { api: { popup: Record<string, unknown> } }).api;
    (window as unknown as Record<string, unknown>).__createTypes = [] as string[];
    const originalCreate = api.popup.create;
    api.popup.create = async (...args: unknown[]) => {
      (window as unknown as { __createTypes: string[] }).__createTypes.push(String(args[0]));
      return (originalCreate as (...a: unknown[]) => Promise<unknown>)(...args);
    };
  });
}

async function createTypes(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __createTypes?: string[] }).__createTypes ?? []
  );
}

test.describe("Popup spawning — hybrid render modes", () => {
  test("the main app page keeps its opaque surface (transparency is popup-only)", async ({ page }) => {
    await page.goto("/");
    const flag = await page.evaluate(() => document.documentElement.dataset.popup ?? null);
    expect(flag).toBeNull();
  });


  test("electron popup route renders popup content and closes via IPC", async ({ page }) => {
    await page.goto("/#/popup/image/test.png/popup-abc");

    // The popup page must be fully transparent: a painted body/#root surface
    // shows through the transparent window as a thick border around media.
    await expect
      .poll(() =>
        page.evaluate(() => ({
          flag: document.documentElement.dataset.popup,
          body: getComputedStyle(document.body).backgroundColor,
          root: getComputedStyle(document.getElementById("root")!).backgroundColor,
        }))
      )
      .toEqual({ flag: "1", body: "rgba(0, 0, 0, 0)", root: "rgba(0, 0, 0, 0)" });

    await page.evaluate(() => {
      const api = (window as unknown as { api: { popup: Record<string, unknown> } }).api;
      (window as unknown as Record<string, string[]>).__closed = [];
      const originalClosePopup = api.popup.closePopup;
      api.popup.closePopup = async (id: string) => {
        (window as unknown as Record<string, string[]>).__closed.push(id);
        return (originalClosePopup as (i: string) => Promise<unknown>)(id);
      };
    });

    await expect(page.locator("[data-testid='popup-shell']")).toBeVisible();

    await page.locator("[data-testid='close-button']").click();

    expect(await page.evaluate(() => (window as unknown as Record<string, string[]>).__closed)).toEqual(
      ["popup-abc"]
    );
  });

  test("the Modes panel render-mode dropdown writes the store", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid='main-tabs']").getByRole("button", { name: "Config" }).click();
    await page.getByRole("tab", { name: "Modes" }).click();

    const select = page.getByRole("textbox", { name: "Popup Render Mode" });
    await expect(select).toHaveValue("Electron Windows (Topmost)");
    await select.click();
    await page.getByRole("option", { name: "In-App Overlay", exact: true }).click();

    const mode = await page.evaluate(() =>
      (
        window as unknown as {
          __settingsStore: { getState: () => { popupRenderMode: string } };
        }
      ).__settingsStore.getState().popupRenderMode
    );
    expect(mode).toBe("inapp");
  });

  test("electron mode: Start spawns via IPC, Stop closes all and resets count", async ({ page }) => {
    await setupPage(page);
    await page.evaluate(() => {
      const api = (window as unknown as { api: { popup: Record<string, unknown> } }).api;
      (window as unknown as Record<string, number>).__createCalls = 0;
      (window as unknown as Record<string, number>).__closeAllCalls = 0;
      const originalCreate = api.popup.create;
      api.popup.create = async (...args: unknown[]) => {
        (window as unknown as Record<string, number>).__createCalls += 1;
        return (originalCreate as (...a: unknown[]) => Promise<unknown>)(...args);
      };
      const originalCloseAll = api.popup.closeAll;
      api.popup.closeAll = async () => {
        (window as unknown as Record<string, number>).__closeAllCalls += 1;
        return (originalCloseAll as () => Promise<unknown>)();
      };
    });

    const popupCount = page.locator("[data-testid='popup-count']");
    await expect(popupCount).toContainText("Active: 0");

    await page.locator("[data-testid='start-stop-button']").click();

    await expect(popupCount).toHaveText(/Active: [1-9]/);
    expect(
      await page.evaluate(() => (window as unknown as Record<string, number>).__createCalls)
    ).toBeGreaterThan(0);

    await page.locator("[data-testid='start-stop-button']").click();

    await expect(popupCount).toContainText("Active: 0");
    expect(
      await page.evaluate(() => (window as unknown as Record<string, number>).__closeAllCalls)
    ).toBe(1);
  });

  test("in-app mode: Start renders in-app popups, Stop removes them", async ({ page }) => {
    await setupPage(page, { popupRenderMode: "inapp" });

    const popupCount = page.locator("[data-testid='popup-count']");
    const inAppPopups = page.locator("[data-testid='in-app-popup']");
    await expect(popupCount).toContainText("Active: 0");

    await page.locator("[data-testid='start-stop-button']").click();

    await expect(inAppPopups.first()).toBeVisible();
    await expect(popupCount).toHaveText(/Active: [1-9]/);

    await page.locator("[data-testid='start-stop-button']").click();

    await expect(popupCount).toContainText("Active: 0");
    await expect(inAppPopups).toHaveCount(0);
  });

  test("in-app mode: closing a popup removes it and decrements the count", async ({ page }) => {
    await setupPage(page, { popupRenderMode: "inapp", delay: 2500 });

    const popupCount = page.locator("[data-testid='popup-count']");
    const inAppPopups = page.locator("[data-testid='in-app-popup']");

    await page.locator("[data-testid='start-stop-button']").click();

    await expect(inAppPopups.first()).toBeVisible();
    await expect(popupCount).toHaveText(/Active: [1-9]/);

    await inAppPopups.first().locator("[data-testid='close-button']").click();

    await expect(popupCount).toHaveText("Active: 0");
    await expect(inAppPopups).toHaveCount(0);
  });

  test("image and video at 100% both spawn — no type shadows another", async ({ page }) => {
    await setupPage(page, { popupMod: 100, vidMod: 100 });
    await page.evaluate(
      (vid: string) => {
        const api = (window as unknown as { api: { pack: Record<string, unknown> } }).api;
        api.pack.randomVideo = async () => vid;
      },
      TEST_VIDEO
    );
    await recordCreateTypes(page);

    await page.locator("[data-testid='start-stop-button']").click();
    await expect
      .poll(async () => new Set(await createTypes(page)), { timeout: 10_000 })
      .toEqual(new Set(["image", "video"]));
    await page.locator("[data-testid='start-stop-button']").click();
  });

  test("single mode spawns at most one popup per roll tick", async ({ page }) => {
    await setupPage(page, { popupMod: 100, vidMod: 100, singleMode: 1 });
    await page.evaluate(
      (vid: string) => {
        const api = (window as unknown as { api: { pack: Record<string, unknown> } }).api;
        api.pack.randomVideo = async () => vid;
      },
      TEST_VIDEO
    );
    await recordCreateTypes(page);

    await page.locator("[data-testid='start-stop-button']").click();
    await page.waitForTimeout(2500);
    await page.locator("[data-testid='start-stop-button']").click();

    const calls = (await createTypes(page)).length;
    // delay 200ms over a 2.5s window ≈ 12 ticks: single mode must stay near
    // one create per tick; independent rolls (the regression) would double it.
    expect(calls).toBeGreaterThanOrEqual(5);
    expect(calls).toBeLessThanOrEqual(15);
  });

  test("the audio concurrency cap holds while running and releases after Stop", async ({ page }) => {
    await setupPage(page, { popupMod: 0, audioMod: 100, maxAudio: 1, delay: 400 });
    await page.evaluate(() => {
      const api = (window as unknown as { api: { pack: Record<string, unknown> } }).api;
      api.pack.randomAudio = async () => "aud/test.mp3";
    });
    await recordCreateTypes(page);

    const startStop = page.locator("[data-testid='start-stop-button']");
    await startStop.click();
    await page.waitForTimeout(2000);
    const audioWhileRunning = (await createTypes(page)).filter((t) => t === "audio").length;
    expect(audioWhileRunning).toBe(1);

    await startStop.click();
    await startStop.click();
    await expect
      .poll(async () => (await createTypes(page)).filter((t) => t === "audio").length, {
        timeout: 10_000,
      })
      .toBeGreaterThan(1);
    await startStop.click();
  });

  test("mitosis refills the screen when the last popup closes", async ({ page }) => {
    await setupPage(page, {
      popupRenderMode: "inapp",
      mitosisMode: 1,
      mitosisStrength: 3,
      delay: 4000,
    });
    await page.evaluate(
      (vid: string) => {
        const api = (window as unknown as { api: { pack: Record<string, unknown> } }).api;
        api.pack.randomVideo = async () => vid;
      },
      TEST_VIDEO
    );

    const startStop = page.locator("[data-testid='start-stop-button']");
    const inAppPopups = page.locator("[data-testid='in-app-popup']");
    const popupCount = page.locator("[data-testid='popup-count']");

    await startStop.click();
    await expect(inAppPopups.first()).toBeVisible({ timeout: 8000 });
    await expect(popupCount).toHaveText("Active: 1");

    await inAppPopups.first().locator("[data-testid='close-button']").click();
    await expect(inAppPopups).toHaveCount(3, { timeout: 2500 });
    await expect(popupCount).toHaveText("Active: 3");

    await startStop.click();
    await expect(popupCount).toHaveText("Active: 0");
  });

  test("popup count increments with each spawned popup while running", async ({ page }) => {
    await setupPage(page, { delay: 150 });

    const popupCount = page.locator("[data-testid='popup-count']");
    await expect(popupCount).toContainText("Active: 0");

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(popupCount).toHaveText(/Active: [1-9]/);

    const firstCount = await getPopupCount(page);
    await expect
      .poll(() => getPopupCount(page), { timeout: 20_000 })
      .toBeGreaterThan(firstCount);

    await page.locator("[data-testid='start-stop-button']").click();
    await expect(popupCount).toContainText("Active: 0");
  });
});
