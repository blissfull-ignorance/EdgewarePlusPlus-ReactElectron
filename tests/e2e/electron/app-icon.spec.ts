import { expect, test, afterEach } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
// A different 1x1 PNG for the second pack — distinct bytes, distinct data URL.
const PNG_ALT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const dataUrl = (bytes: Buffer): string => `data:image/png;base64,${bytes.toString("base64")}`;

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
  let cleanup: Array<() => Promise<void> | void> = [];

  test.beforeAll(() => {
    ensureElectronBuild();
  });

  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!();
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

    // Exact payload: the bundled default icon is also a PNG data URL, so a
    // prefix check would pass even when the header kept the default icon.
    const logo = running.window.locator("[data-testid='app-icon']");
    await expect
      .poll(async () => await logo.getAttribute("src"), { timeout: 10000 })
      .toBe(dataUrl(PNG_1PX));
  });

  test("switching packs while running re-resolves the header logo and window icon", async () => {
    const state = createTempState({ kind: "media" });
    writeFileSync(path.join(state.seedPath, "icon.png"), PNG_1PX);
    const packB = path.join(state.packsDir, "icon-pack-b");
    mkdirSync(packB, { recursive: true });
    writeFileSync(
      path.join(packB, "info.json"),
      JSON.stringify({ name: "Icon Pack B", version: "1.0", creator: "e2e" })
    );
    writeFileSync(path.join(packB, "icon.png"), PNG_ALT);
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

    const logo = running.window.locator("[data-testid='app-icon']");
    await expect
      .poll(async () => await logo.getAttribute("src"), { timeout: 15000 })
      .toBe(dataUrl(PNG_1PX));

    // Round-2 regression: the logo resolved once at mount and kept the old
    // pack's icon after a switch. Drive the real Pack Management selector.
    await running.window.locator("[data-testid='main-tab-config']").click();
    await running.window.getByRole("tab", { name: "Pack Management" }).click();
    const select = running.window.getByRole("textbox", { name: "Available Packs" });
    await select.click();
    await running.window.getByRole("option", { name: "Icon Pack B (v1.0)", exact: true }).click();

    await expect
      .poll(async () => await logo.getAttribute("src"), { timeout: 15000 })
      .toBe(dataUrl(PNG_ALT));
    // The main process re-resolved too: a second resolution line names B.
    await expect
      .poll(() => mainLog(state).includes(`Using app icon: ${path.join(packB, "icon.png")}`), {
        timeout: 15000,
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
    expect((await logo.getAttribute("src")) ?? "").toMatch(/^data:image\/png;base64,/);
  });
});
