import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  quitApp,
  seedConfig,
} from "./launch";

/**
 * The renderer pushes every settings change into the main-process cache, so
 * main-side consumers (popup geometry) act on unsaved state immediately —
 * the disk autosave window must never delay a live change.
 */
test("an unsaved lowkey change positions the very next popup", async () => {
  ensureElectronBuild();
  const state = createTempState({ kind: "media" });
  seedConfig(state, {
    packPath: state.seedPath,
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    webMod: 0,
    capPopChance: 0,
    delay: 5000,
    popupRenderMode: "electron",
    lkToggle: 0,
    lkCorner: 0,
  });
  const running = await launchApp(state);
  try {
    const { window, app } = running;

    // Flip lowkey on WITHOUT saving: nothing has hit config.json yet.
    await window.evaluate(() => {
      const store = (window as unknown as { __settingsStore?: { setState: (p: object) => void } })
        .__settingsStore;
      if (!store) throw new Error("__settingsStore missing: push path cannot be proven");
      store.setState({ lkToggle: 1, lkCorner: 0 });
    });

    // The disk still holds the pre-change config: only the push cache can
    // make the next popup honour the unsaved value.
    const disk = JSON.parse(
      readFileSync(path.join(state.dir, "data", "config.json"), "utf-8")
    ) as Record<string, unknown>;
    expect(disk.lkToggle ?? 0).toBe(0);

    const id: string = await window.evaluate(async () => {
      const api = (
        window as unknown as {
          api: { popup: { create: (t: string, m: string) => Promise<{ id: string }> } };
        }
      ).api;
      const r = await api.popup.create("image", "applelw.png");
      return r.id;
    });

    // The window's navigation commits asynchronously; poll until it is found.
    let geo: { x: number; y: number; waY: number; waRight: number } | null = null;
    await expect
      .poll(async () => {
        geo = await app.evaluate(({ BrowserWindow, screen }, needle: string) => {
          const w = BrowserWindow.getAllWindows().find((bw) =>
            bw.webContents.getURL().includes(needle)
          );
          if (!w) return null;
          const b = w.getBounds();
          const wa = screen.getPrimaryDisplay().workArea;
          return { x: b.x, y: b.y, waY: wa.y, waRight: wa.x + wa.width };
        }, id);
        return geo !== null;
      }, { timeout: 15000 })
      .toBe(true);

    expect(geo).not.toBeNull();
    // Corner 0 = top-right of the work area, anchored with the 400px default
    // creation width (resize-to-media keeps the top-left corner).
    expect(Math.abs(geo!.x - (geo!.waRight - 400))).toBeLessThanOrEqual(2);
    expect(Math.abs(geo!.y - geo!.waY)).toBeLessThanOrEqual(2);

    await window.evaluate(() => {
      const api = (window as unknown as { api: { popup: { closeAll: () => Promise<void> } } }).api;
      return api.popup.closeAll();
    });
  } finally {
    await quitApp(running);
    cleanupTempState(state);
  }
});
