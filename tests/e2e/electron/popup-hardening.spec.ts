import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  // Proof the resize ran: at least one window left the 400x300 spawn
  // default. Without this, a dead sizeToMedia still passes containment —
  // spawn bounds are clamped to the work area from the start.
  let bounds: Array<{ x: number; y: number; width: number; height: number }> = [];
  await expect
    .poll(
      async () => {
        bounds = await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .filter((win) => win.webContents.getURL().includes("/popup/image"))
            .map((win) => win.getBounds())
        );
        return bounds.some((b) => b.width !== 400 || b.height !== 300);
      },
      { timeout: 15000 }
    )
    .toBe(true);
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

test("a normal popup closes on a single click anywhere on its window", async () => {
  // The pack's click-to-close intent (index.json maxClicks, 1 by default)
  // applies without buttonless or multi-click: one click on the media ends
  // the popup, wherever it lands on the window.
  const { window, app } = running!;
  await window.evaluate(() => {
    (
      window as unknown as {
        __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
      }
    ).__settingsStore.getState().setRaw({ buttonless: 0, multiClick: 0 });
  });
  await window.evaluate(() =>
    (
      window as unknown as { api: { popup: { create: (t: string, m: string) => Promise<unknown> } } }
    ).api.popup.create("image", "globelw.png")
  );
  const popup = await app.waitForEvent("window", {
    predicate: (w) => w.url().includes("/popup/image"),
    timeout: 15_000,
  });
  await popup.waitForSelector("[data-testid='image-popup-img']", { timeout: 15_000 });
  // The close button stays as an affordance in normal mode.
  await expect(popup.locator("[data-testid='close-button']")).toBeVisible();
  await popup.locator("[data-testid='image-popup-img']").click({ force: true });
  await expect
    .poll(() => app.windows().filter((w) => w.url().includes("/popup/image")).length, {
      timeout: 10_000,
    })
    .toBe(0);
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

async function flushSettings(window: RunningApp["window"], values: Record<string, unknown>): Promise<void> {
  await window.evaluate((v: Record<string, unknown>) => {
    (
      window as unknown as {
        __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
      }
    ).__settingsStore.getState().setRaw(v);
  }, values);
  // Popup windows read settings from disk at mount — wait for the autosave.
  await expect
    .poll(() =>
      window.evaluate(
        () =>
          (
            window as unknown as { __settingsStore: { getState: () => { dirty: boolean } } }
          ).__settingsStore.getState().dirty
      )
    )
    .toBe(false);
}

function appLogs(state: TempState): string {
  const logDir = path.join(state.dir, "logs");
  try {
    return readdirSync(logDir)
      .map((f) => {
        try {
          return readFileSync(path.join(logDir, f), "utf-8");
        } catch {
          return "";
        }
      })
      .join("\n");
  } catch {
    return "";
  }
}

test("multi-click packs roll 1..maxClicks media clicks and hide the close button", async () => {
  const { window, app } = running!;
  // Legacy parity: each popup rolls random 1..maxClicks clicks (randint),
  // so the protocol adapts to the rolled count instead of pinning one.
  writeFileSync(
    path.join(state!.seedPath, "index.json"),
    JSON.stringify({ default: { maxClicks: 10, captions: [], prompts: [] }, moods: [] })
  );
  await flushSettings(window, { multiClick: 1 });

  try {
    const spawnImagePopup = async () => {
      await window.evaluate(() =>
        (
          window as unknown as {
            api: { popup: { create: (t: string, m: string) => Promise<unknown> } };
          }
        ).api.popup.create("image", "applelw.png")
      );
      const popup = await app.waitForEvent("window", {
        predicate: (w) => w.url().includes("/popup/image"),
        timeout: 15_000,
      });
      await popup.waitForSelector("[data-testid='image-popup-img']", { timeout: 15_000 });
      return popup;
    };
    const readRolledClicks = async (popup: RunningApp["window"]): Promise<number> => {
      const badge = popup.locator("[data-testid='clicks-remaining']");
      await expect(badge).toBeVisible({ timeout: 15_000 });
      const m = (await badge.textContent())?.match(/(\d+) click/);
      return m ? parseInt(m[1], 10) : 0;
    };

    // First popup: the full close protocol at its rolled count.
    const popup = await spawnImagePopup();
    // No close button while clicks remain.
    await expect(popup.locator("[data-testid='close-button']")).toHaveCount(0);
    const n = await readRolledClicks(popup);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(10);

    const popupId = popup.url().split("/").pop();
    // n-1 clicks decrement but must not close.
    for (let i = 1; i < n; i++) {
      await popup.locator("[data-testid='image-popup-img']").click({ force: true });
      await expect(popup.locator("[data-testid='clicks-remaining']")).toContainText(
        `${n - i} click`
      );
    }
    expect(app.windows().some((w) => w.url().includes(String(popupId)))).toBe(true);

    // The nth click closes it exactly at zero.
    await popup.locator("[data-testid='image-popup-img']").click({ force: true });
    await expect.poll(() => popup.isClosed(), { timeout: 10_000 }).toBe(true);

    // Across rolls: every count stays within the pack bound and at least one
    // popup demands more than a single click — an ignored pack maxClicks
    // would always roll exactly 1 (P(all-ones | correct) = 0.1%).
    const counts = [n];
    for (let p = 0; p < 2; p++) {
      const extra = await spawnImagePopup();
      counts.push(await readRolledClicks(extra));
      await window.evaluate(() =>
        (window as unknown as { api: { popup: { closeAll: () => Promise<unknown> } } }).api.popup.closeAll()
      );
      await expect
        .poll(() => app.windows().filter((w) => w.url().includes("/popup/image")).length, {
          timeout: 10_000,
        })
        .toBe(0);
    }
    for (const c of counts) expect(c).toBeLessThanOrEqual(10);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(2);
  } finally {
    await flushSettings(window, { multiClick: 0 });
    rmSync(path.join(state!.seedPath, "index.json"), { force: true });
  }
});

test("closing a renderer-owned popup opens a pack url when web-on-close is on", async () => {
  const { window, app } = running!;
  writeFileSync(
    path.join(state!.seedPath, "web.json"),
    JSON.stringify({ urls: ["https://e2e.example/"], args: [""], moods: [null] })
  );
  await flushSettings(window, {
    popupMod: 100,
    delay: 500,
    webPopup: 1,
    webMod: -100, // roll((100 - -100) / 2) = roll(100): every close opens
  });

  const startStop = window.locator("[data-testid='start-stop-button']");
  try {
    await startStop.click();

    const closeOneImagePopup = async () => {
      const popup = await app.waitForEvent("window", {
        predicate: (w) => w.url().includes("/popup/image"),
        timeout: 15_000,
      });
      await popup.waitForSelector("[data-testid='close-button']", { timeout: 15_000 });
      await popup.locator("[data-testid='close-button']").click();
    };

    await closeOneImagePopup();
    await expect
      .poll(() => appLogs(state!).includes("Browser open stubbed: https://e2e.example/"), {
        timeout: 10_000,
      })
      .toBe(true);

    // Control: with the feature off, a close never opens the browser.
    await flushSettings(window, { webPopup: 0 });
    const before = (appLogs(state!).match(/Browser open stubbed:/g) ?? []).length;
    await closeOneImagePopup();
    await window.waitForTimeout(1500);
    expect((appLogs(state!).match(/Browser open stubbed:/g) ?? []).length).toBe(before);
  } finally {
    const text = await startStop.textContent();
    if (text === "Stop") await startStop.click();
    await flushSettings(window, { popupMod: 0, delay: 60000, webMod: 0 });
    rmSync(path.join(state!.seedPath, "web.json"), { force: true });
    await window.evaluate(() =>
      (window as unknown as { api: { popup: { closeAll: () => Promise<unknown> } } }).api.popup.closeAll()
    );
  }
});

test("popup:create rejects malformed payloads without opening windows", async () => {
  const { window, app } = running!;
  const before = app.windows().length;

  const attempt = async (type: string, mediaId: string): Promise<string> =>
    window.evaluate(
      async ([t, m]: [string, string]) => {
        try {
          await (
            window as unknown as {
              api: { popup: { create: (t: string, m: string) => Promise<unknown> } };
            }
          ).api.popup.create(t, m);
          return "created";
        } catch (err) {
          return String(err);
        }
      },
      [type, mediaId] as [string, string]
    );

  expect(await attempt("bogus", "applelw.png")).toContain("Invalid popup request");
  expect(await attempt("image", "")).toContain("Invalid popup request");
  expect(await attempt("image", "x".repeat(3000))).toContain("Invalid popup request");
  expect(app.windows().length).toBe(before);
});
