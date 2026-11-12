import { persistSessionBaseline, applyBaselineRevert } from "../utils/sessionBaseline";
import { ipcMain, BrowserWindow } from "electron";
import { logger } from "../utils/logger";

/**
 * Main-process mirror of the renderer's corruption runtime. The Lua scripting
 * API and status readers consume this; the runtime hook publishes to it on
 * every transition.
 */
interface CorruptionMirror {
  level: number;
  nextLevelTime: number | null;
}

const mirror: CorruptionMirror = { level: 0, nextLevelTime: null };

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

/** The last mirrored corruption level (what the renderer published or a script injected). */
export function mirroredLevel(): number {
  return mirror.level;
}

function injectLevel(level: number): boolean {
  const value = Number(level);
  if (!Number.isFinite(value) || value < 1) {
    logger.warn(`[Corruption] Rejected inject level ${JSON.stringify(level)}`);
    return false;
  }
  const next = Math.floor(value);
  // Keep the mirror current even when the renderer runtime has not attached
  // its listener yet; the runtime pulls the level on activation.
  mirror.level = next;
  broadcast("corruption:inject", next);
  return true;
}

function registerHandlers(): void {
  ipcMain.handle("corruption:persistBaseline", async (_event, baseline: unknown): Promise<boolean> =>
    persistSessionBaseline(baseline)
  );
  ipcMain.handle("corruption:revertBaseline", async (): Promise<number> => applyBaselineRevert());
  ipcMain.handle("corruption:getCurrentLevel", async (): Promise<number> => mirror.level);

  ipcMain.handle("corruption:getNextLevelTime", async (): Promise<number | null> =>
    mirror.nextLevelTime
  );

  ipcMain.handle(
    "corruption:setLevel",
    (_event, level: number, nextLevelTime: number | null): void => {
      const next = Number(level);
      const nextTime = Number(nextLevelTime);
      mirror.level = Number.isFinite(next) && next >= 0 ? next : 0;
      mirror.nextLevelTime = Number.isFinite(nextTime) && nextLevelTime != null ? nextTime : null;
    }
  );

  /**
   * Script-driven level change: relay to the renderer runtime, which owns
   * level application (moods, overrides, wallpaper).
   */
  ipcMain.handle("corruption:injectLevel", (_event, level: number): boolean => injectLevel(level));

  ipcMain.handle("corruption:applyLevelChanges", async (_event, changes: Record<string, unknown>): Promise<void> => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;

    const serialized = JSON.stringify(changes);
    if (serialized.length > 10240) {
      logger.warn("[Corruption] Config changes payload too large, rejected");
      return;
    }

    try {
      win.webContents.send("corruption:applyChanges", JSON.parse(serialized));
    } catch (err) {
      logger.error("[Corruption] Failed to relay level changes:", err);
    }
  });
}

export { registerHandlers, injectLevel };
