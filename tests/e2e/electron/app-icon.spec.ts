import { expect, test, afterEach } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

// 1x1 red PNG.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function mainLog(state: ReturnType<typeof createTempState>): string {
  const logDir = path.join(state.dir, "logs");
  if (!existsSync(logDir)) return "";
  return readdirSync(logDir)
    .map((f) => {
      try {
        return readFileSync(path.join(logDir, f), "utf-8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

test.describe("app icon parity (legacy pack-icon resolution)", () => {
  let cleanup: Array<() => void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  test("pack icon.png is used for the app icon and header logo", async () => {
    const state = createTempState({ kind: "media" });
    writeFileSync(path.join(state.seedPath, "icon.png"), PNG_1PX);
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      showLoadingFlair: 0,
      delay: 60000,
    });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await expect
      .poll(() => mainLog(state).includes(`Using app icon: ${path.join(state.seedPath, "icon.png")}`), {
        timeout: 15000,
      })
      .toBe(true);

    const logo = running.window.locator("[data-testid='app-icon']");
    await expect
      .poll(async () => (await logo.getAttribute("src"))?.startsWith("data:image/png;base64,"), {
        timeout: 10000,
      })
      .toBe(true);
  });

  test("bundled legacy default icon is used when the pack ships none", async () => {
    const state = createTempState({ kind: "media" });
    seedConfig(state, {
      packPath: state.seedPath,
      popupRenderMode: "electron",
      showLoadingFlair: 0,
      delay: 60000,
    });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state);
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await expect
      .poll(() => mainLog(state).includes("Using app icon:"), { timeout: 15000 })
      .toBe(true);
    expect(mainLog(state)).toContain("dist/icon.png");
    expect(mainLog(state)).not.toContain("No app icon asset found");

    const logo = running.window.locator("[data-testid='app-icon']");
    await expect(logo).toBeVisible();
    expect((await logo.getAttribute("src")) ?? "").not.toBe("");
  });
});
