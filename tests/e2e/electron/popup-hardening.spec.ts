import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
  type RunningApp,
  type TempState,
} from "./launch";

const REPO_ROOT = path.join(__dirname, "..", "..", "..");
const VID_DIR = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack", "vid");

let state: TempState | null = null;
let running: RunningApp | null = null;

test.beforeAll(async () => {
  ensureElectronBuild();
  state = createTempState({ kind: "media" });
  // Ship a real mp4 so range serving is exercised by a real <video>.
  mkdirSync(path.join(state.seedPath, "vid"), { recursive: true });
  copyFileSync(path.join(VID_DIR, "tempest.mp4"), path.join(state.seedPath, "vid", "clip.mp4"));
  seedConfig(state, {
    packPath: state.seedPath,
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    mitosisMode: 0,
    showLoadingFlair: 0,
    delay: 60000,
  });
  running = await launchApp(state, { EDGWARE_STUB_BROWSER: "1" });
});

test.afterAll(async () => {
  if (running) await quitApp(running);
  cleanupTempState(state);
});

test("packmedia answers Range requests with exact 206 slices", async () => {
  const probe = await running!.window.evaluate(async () => {
    const full = await fetch("packmedia://vid/clip.mp4");
    const size = Number(full.headers.get("content-length"));
    await full.arrayBuffer();
    const part = await fetch("packmedia://vid/clip.mp4", {
      headers: { Range: "bytes=0-1023" },
    });
    const body = await part.arrayBuffer();
    const tail = await fetch("packmedia://vid/clip.mp4", {
      headers: { Range: `bytes=${size - 16}-` },
    });
    const tailBody = await tail.arrayBuffer();
    const etag = full.headers.get("etag") ?? "";
    const revalidated = await fetch("packmedia://vid/clip.mp4", {
      headers: { "If-None-Match": etag },
    });
    return {
      size,
      status: part.status,
      len: body.byteLength,
      contentRange: part.headers.get("content-range"),
      acceptRanges: part.headers.get("accept-ranges"),
      tailStatus: tail.status,
      tailLen: tailBody.byteLength,
      revalidatedStatus: revalidated.status,
    };
  });
  expect(probe.size).toBeGreaterThan(2048);
  expect(probe.status).toBe(206);
  expect(probe.len).toBe(1024);
  expect(probe.contentRange).toBe(`bytes 0-1023/${probe.size}`);
  expect(probe.acceptRanges).toBe("bytes");
  expect(probe.tailStatus).toBe(206);
  expect(probe.tailLen).toBe(16);
  expect(probe.revalidatedStatus).toBe(304);
});

test("a gallery video element loads metadata and plays via range requests", async () => {
  const { window } = running!;
  await window.locator("[data-testid='main-tab-gallery']").click();
  await expect(window.locator("[data-testid='gallery-card-clip.mp4']")).toBeVisible();
  const played = await window.evaluate(async () => {
    const el = document.createElement("video");
    el.src = "packmedia://vid/clip.mp4";
    el.muted = true;
    document.body.appendChild(el);
    const meta = await new Promise<boolean>((resolve) => {
      el.addEventListener("loadedmetadata", () => resolve(true), { once: true });
      el.addEventListener("error", () => resolve(false), { once: true });
      setTimeout(() => resolve(false), 10_000);
    });
    if (!meta) return { meta, duration: 0, seeked: false };
    const seeked = await new Promise<boolean>((resolve) => {
      el.addEventListener("seeked", () => resolve(true), { once: true });
      el.currentTime = Math.min(1, (el.duration || 2) / 2);
      setTimeout(() => resolve(false), 8_000);
    });
    el.remove();
    return { meta, duration: el.duration, seeked };
  });
  expect(played.meta).toBe(true);
  expect(played.duration).toBeGreaterThan(0);
  expect(played.seeked).toBe(true);
});

test("media popups stay fully inside the work area after resizing", async () => {
  const { window, app } = running!;
  const work = await app.evaluate(({ screen }) => {
    const wa = screen.getPrimaryDisplay().workArea;
    return { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
  });
  // Spawn several image popups; each resizes to its media on load.
  for (let i = 0; i < 6; i++) {
    await window.evaluate(() =>
      (
        window as unknown as {
          api: { popup: { create: (t: string, m: string) => Promise<{ id: string }> } };
        }
      ).api.popup.create("image", "applelw.png")
    );
  }
  await new Promise((r) => setTimeout(r, 1500));
  expect(app.windows().filter((w) => w.url().includes("/popup/image")).length).toBeGreaterThanOrEqual(6);
  // Bounds come from the main process: popup pages are transparent overlays.
  const bounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((win) => win.webContents.getURL().includes("/popup/image"))
      .map((win) => win.getBounds())
  );
  expect(bounds.length).toBeGreaterThanOrEqual(6);
  for (const b of bounds) {
    expect(b.x).toBeGreaterThanOrEqual(work.x - 1);
    expect(b.y).toBeGreaterThanOrEqual(work.y - 1);
    expect(b.x + b.width).toBeLessThanOrEqual(work.x + work.width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(work.y + work.height + 1);
  }
  await window.evaluate(() =>
    (window as unknown as { api: { popup: { closeAll: () => Promise<unknown> } } }).api.popup.closeAll()
  );
});

test("buttonless popups close when the media itself is clicked", async () => {
  const { window, app } = running!;
  await window.evaluate(() => {
    (
      window as unknown as {
        __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
      }
    ).__settingsStore.getState().setRaw({ buttonless: 1 });
  });
  await expect
    .poll(() =>
      window.evaluate(
        () =>
          (
            window as unknown as {
              __settingsStore: { getState: () => { dirty: boolean } };
            }
          ).__settingsStore.getState().dirty
      )
    )
    .toBe(false);

  await window.evaluate(() =>
    (
      window as unknown as { api: { popup: { create: (t: string, m: string) => Promise<unknown> } } }
    ).api.popup.create("image", "applelw.png")
  );
  const popup = await app.waitForEvent("window", {
    predicate: (w) => w.url().includes("/popup/image"),
    timeout: 15_000,
  });
  await popup.waitForSelector("[data-testid='image-popup-img']", { timeout: 15_000 });
  // No close button in buttonless mode.
  await expect(popup.locator("[data-testid='close-button']")).toHaveCount(0);
  // Clicking the media itself closes the popup (legacy whole-window click).
  await popup.locator("[data-testid='image-popup-img']").click({ force: true });
  await expect
    .poll(() => app.windows().filter((w) => w.url().includes("/popup/image")).length, {
      timeout: 10_000,
    })
    .toBe(0);

  await window.evaluate(() => {
    (
      window as unknown as {
        __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
      }
    ).__settingsStore.getState().setRaw({ buttonless: 0 });
  });
});

test("prompt popups accept keyboard input", async () => {
  const { window, app } = running!;
  await window.evaluate(() =>
    (
      window as unknown as { api: { popup: { create: (t: string, m: string) => Promise<unknown> } } }
    ).api.popup.create("prompt", "Type your confession here")
  );
  const popup = await app.waitForEvent("window", {
    predicate: (w) => w.url().includes("/popup/prompt"),
    timeout: 15_000,
  });
  await popup.waitForSelector("[data-testid='prompt-input']", { timeout: 15_000 });
  const field = popup.locator("[data-testid='prompt-input']");
  await field.click();
  await field.pressSequentially("confession text", { delay: 20 });
  await expect(field).toHaveValue(/confession text/);
  const focusable = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes("/popup/prompt")
    );
    return win ? win.isFocusable() : null;
  });
  expect(focusable).toBe(true);
  await window.evaluate(() =>
    (window as unknown as { api: { popup: { closeAll: () => Promise<unknown> } } }).api.popup.closeAll()
  );
});
