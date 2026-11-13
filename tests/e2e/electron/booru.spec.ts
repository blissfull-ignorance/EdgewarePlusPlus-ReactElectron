import { expect, test, afterEach } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type TempState,
} from "./launch";

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

function stubServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url ?? "";
      if (url.startsWith("/index.php")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            post: [{ file_url: `http://${req.headers.host ?? "127.0.0.1"}/img/booru-result.png` }],
          })
        );
        return;
      }
      if (url === "/img/booru-result.png") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(PNG);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr) resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function seed(overrides: Record<string, unknown> = {}): TempState {
  const state = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    popupRenderMode: "electron",
    popupMod: 100,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    mitosisMode: 0,
    delay: 1000,
    downloadEnabled: 1,
    tagList: "test>tags",
    ...overrides,
  });
  return state;
}

test.describe("booru downloader (stubbed gelbooru, no real network)", () => {
  let cleanup: Array<() => Promise<void> | void> = [];
  let stub: { server: Server; url: string } | null = null;

  test.beforeAll(async () => {
    ensureElectronBuild();
    stub = await stubServer();
    cleanup.push(() => stub?.server.close());
  });

  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()!();
  });

  test("forced roll swaps the pack image for the downloaded booru image", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, {
      EDGWARE_BOORU_BASE_URL: stub!.url,
      EDGWARE_BOORU_ROLL: "100",
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();

    await expect
      .poll(
        async () =>
          running.app
            .windows()
            .some((w) => w !== running.window && decodeURIComponent(w.url()).includes("packmedia://booru-cache/")),
        { timeout: 60000 }
      )
      .toBe(true);

    const cacheDir = path.join(state.dir, "data", "booru-cache");
    expect(existsSync(cacheDir)).toBe(true);
    expect(readdirSync(cacheDir)).toContain("booru-result.png");
  });

  test("missed roll keeps pack media", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, {
      EDGWARE_BOORU_BASE_URL: stub!.url,
      EDGWARE_BOORU_ROLL: "0",
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();

    await expect
      .poll(
        async () =>
          running.app
            .windows()
            .some((w) => w !== running.window && w.url().includes("/popup/image/")),
        { timeout: 60000 }
      )
      .toBe(true);

    expect(existsSync(path.join(state.dir, "data", "booru-cache"))).toBe(false);
  });

  test("a failing booru server falls back to pack media and never stalls the loop", async () => {
    const state = seed();
    cleanup.push(() => cleanupTempState(state));
    // Forced roll against a closed port: every fetch fails at connect time.
    // The downloader's contract is that each failure path returns null so
    // the caller keeps the pack image — the popup loop must never stall on
    // the network.
    const running = await launchApp(state, {
      EDGWARE_BOORU_BASE_URL: "http://127.0.0.1:9",
      EDGWARE_BOORU_ROLL: "100",
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();

    const imagePopups = () =>
      new Set(
        running.app
          .windows()
          .filter((w) => w !== running.window && w.url().includes("/popup/image/"))
          .map((w) => w.url())
      );
    // Two distinct popups prove the loop kept rolling after the failures.
    await expect.poll(() => imagePopups().size, { timeout: 60000 }).toBeGreaterThanOrEqual(2);
    expect(existsSync(path.join(state.dir, "data", "booru-cache"))).toBe(false);
  });

  test("downloadEnabled off skips the downloader even on a forced roll", async () => {
    const state = seed({ downloadEnabled: 0 });
    cleanup.push(() => cleanupTempState(state));
    const running = await launchApp(state, {
      EDGWARE_BOORU_BASE_URL: stub!.url,
      EDGWARE_BOORU_ROLL: "100",
    });
    cleanup.push(async () => {
      try {
        await quitApp(running);
      } catch {
        /* noop */
      }
    });

    await running.window.locator("[data-testid='start-stop-button']").click();

    // The stub would serve a swap if the gate were ignored: popups must be
    // pack media and the cache directory must never appear.
    await expect
      .poll(
        async () =>
          running.app
            .windows()
            .some((w) => w !== running.window && w.url().includes("/popup/image/")),
        { timeout: 60000 }
      )
      .toBe(true);
    expect(
      running.app
        .windows()
        .some((w) => decodeURIComponent(w.url()).includes("packmedia://booru-cache/"))
    ).toBe(false);
    expect(existsSync(path.join(state.dir, "data", "booru-cache"))).toBe(false);
  });
});
