import { ipcMain, BrowserWindow } from "electron";
import { logger } from "../utils/logger";

function getMainWin(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows();
  return wins[0] ?? null;
}

async function evaluateInRenderer(win: BrowserWindow, code: string): Promise<unknown> {
  // Electron 33 runtime accepts { userWorld: true } but TS types don't reflect it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (win.webContents.executeJavaScript as any)(code, { userWorld: true });
}

function registerHandlers(): void {
  ipcMain.handle("corruption:getCurrentLevel", async (): Promise<number> => {
    const win = getMainWin();
    if (!win) return 0;
    try {
      const level = await evaluateInRenderer(win,
        "typeof useCorruptionStore !== 'undefined' ? useCorruptionStore.getState().currentLevel : 0"
      );
      return Number(level) || 0;
    } catch {
      return 0;
    }
  });

  ipcMain.handle("corruption:getNextLevelTime", async (): Promise<number | null> => {
    const win = getMainWin();
    if (!win) return null;
    try {
      const time = await evaluateInRenderer(win,
        "typeof useCorruptionStore !== 'undefined' ? useCorruptionStore.getState().nextLevelTime : null"
      );
      return time != null ? Number(time) : null;
    } catch {
      return null;
    }
  });

  ipcMain.handle("corruption:applyLevelChanges", async (_event, changes: Record<string, unknown>): Promise<void> => {
    const win = getMainWin();
    if (!win) return;

    const serialized = JSON.stringify(changes);
    if (serialized.length > 10240) {
      logger.warn("[Corruption] Config changes payload too large, rejected");
      return;
    }

    try {
      await evaluateInRenderer(win, `
        (function() {
          var changes = ${serialized};
          if (typeof useSettingsStore !== 'undefined') {
            useSettingsStore.getState().setRaw(changes);
          }
        })()
      `);
    } catch (err) {
      logger.error("[Corruption] Failed to apply level changes:", err);
    }
  });
}

export { registerHandlers };
