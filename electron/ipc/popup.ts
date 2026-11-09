/**
 * @file popup — IPC handlers for the popup spawning engine.
 *
 * Spawns BrowserWindow popups with frameless, transparent, always-on-top
 * styling (skipTaskbar: true). Each popup receives a URL hash route of the
 * form `#/popup/:type/:mediaId/:popupId` so the renderer can mount popup
 * content and close the window via IPC.
 * Windows are tracked in an internal Map keyed by a unique ID and cleaned up
 * on the `"closed"` event.
 */
import { app, ipcMain, BrowserWindow, screen } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { logger } from "../utils/logger";

// Registry of open popup windows, keyed by popup ID
const popupWindows = new Map<string, BrowserWindow>();

// Main window that requested popups — used to deliver close notifications
let mainWin: BrowserWindow | null = null;

function notifyPopupClosed(id: string): void {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send("popup:closed", id);
  }
}

/**
 * Get the URL that popup windows should load.
 * Matches the logic in main.ts for loading the dev server or production build.
 */
function getPopupUrl(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
   }
  if (app.isPackaged) {
    return pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  }
  const port = process.env.VITE_PORT ?? 5173;
  return `http://localhost:${port}`;
}

/**
 * Get the primary monitor bounds. Disabled-monitor filtering delegates
 * to the renderer-side geometry calculation for consistency.
 */
function getPrimaryMonitorBounds() {
  return screen.getPrimaryDisplay().bounds;
}

/**
 * Create a new popup BrowserWindow and register it in the global map.
 * Returns a unique ID caller can use to close the popup later.
 */
function createPopupWindow(
  type: "image" | "video" | "audio" | "subliminal" | "prompt",
  mediaId: string,
  hypnoGif?: string
): { id: string } {
  const id = `popup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bounds = getPrimaryMonitorBounds();

  const defaultWidth = 400;
  const defaultHeight = 300;

  // The subliminal text popup is large and centered (legacy: label-sized box
  // at monitor center with wrap at monitor/1.5); media pops get a random spot.
  const isSubliminal = type === "subliminal";
  const width = isSubliminal ? Math.floor(bounds.width * 0.66) : defaultWidth;
  const height = isSubliminal ? Math.floor(bounds.height * 0.5) : defaultHeight;
  const x = isSubliminal
    ? Math.floor(bounds.x + (bounds.width - width) / 2)
    : Math.floor(Math.random() * Math.max(0, bounds.width - defaultWidth));
  const y = isSubliminal
    ? Math.floor(bounds.y + (bounds.height - height) / 2)
    : Math.floor(Math.random() * Math.max(0, bounds.height - defaultHeight));

  const popupWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const url = getPopupUrl();
  const hypnoSeg = hypnoGif ? `?h=${encodeURIComponent(hypnoGif)}` : "";
  popupWin.loadURL(`${url}#/popup/${type}/${encodeURIComponent(mediaId)}/${id}${hypnoSeg}`);

  popupWin.on("closed", () => {
    popupWindows.delete(id);
    notifyPopupClosed(id);
  });

  popupWindows.set(id, popupWin);

  logger.info(`[Popup] Created popup ${id}: type=${type}, mediaId=${mediaId}`);
  return { id };
}

function closePopupById(id: string): void {
  const popupWin = popupWindows.get(id);
  if (popupWin && !popupWin.isDestroyed()) {
    popupWin.close();
    popupWindows.delete(id);
    logger.info(`[Popup] Closed popup ${id}`);
  } else {
    logger.warn(`[Popup] Popup ${id} not found or already closed`);
  }
}

function closeAllPopups(): void {
  const ids = Array.from(popupWindows.keys());
  for (const id of ids) {
    closePopupById(id);
  }
  logger.info(`[Popup] Closed all popups (${ids.length} total)`);
}

function registerHandlers(): void {
  ipcMain.handle(
    "popup:create",
    async (
      event,
      type: "image" | "video" | "audio" | "subliminal" | "prompt",
      mediaId: string,
      hypnoGif?: string
    ): Promise<{ id: string }> => {
      try {
        mainWin = BrowserWindow.fromWebContents(event.sender);
        return createPopupWindow(type, mediaId, hypnoGif);
      } catch (err) {
        logger.error("[Popup] Failed to create popup:", err);
        throw err;
      }
    }
  );

  ipcMain.handle("popup:closePopup", async (_event, id: string): Promise<void> => {
    try {
      closePopupById(id);
    } catch (err) {
      logger.error("[Popup] Failed to close popup:", err);
    }
  });

  ipcMain.handle("popup:closeAll", async (): Promise<void> => {
    try {
      closeAllPopups();
    } catch (err) {
      logger.error("[Popup] Failed to close all popups:", err);
    }
  });
}

export { registerHandlers, closeAllPopups };
export { popupWindows };
