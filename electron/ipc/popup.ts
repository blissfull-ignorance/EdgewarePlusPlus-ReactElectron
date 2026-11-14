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
import { getSettingNumber } from "../utils/configCache";
import { lowkeyPosition } from "../../src/features/popup/lowkeyPosition";
import { legacyPopupSize } from "../../src/features/popup/legacySize";
import { initialMoveState, stepMove, type MoveState } from "../../src/features/popup/windowMovement";

// Registry of open popup windows, keyed by popup ID
const popupWindows = new Map<string, BrowserWindow>();

// Window type per popup ID, for the legacy concurrency caps
const popupTypes = new Map<string, string>();

/** How many popups of a type are currently open (legacy max_audio/max_videos). */
export function countPopupsByType(type: "audio" | "video" | "image"): number {
  let n = 0;
  for (const t of popupTypes.values()) if (t === type) n += 1;
  return n;
}

// Windows whose popups drift, moved by one shared ticker (legacy try_move
// ran one thread per popup, but per-window JS timers saturate the main
// process once dozens move at once); each entry carries its own velocity.
const movers = new Map<string, MoveState>();
let moverTimer: ReturnType<typeof setInterval> | null = null;

function ensureMoverLoop(): void {
  if (moverTimer) return;
  moverTimer = setInterval(() => {
    for (const [id, state] of movers) {
      const win = popupWindows.get(id);
      if (!win || win.isDestroyed()) {
        movers.delete(id);
        continue;
      }
      const display = screen.getDisplayMatching(win.getBounds());
      const size = win.getBounds();
      movers.set(id, stepMove(state, display.workArea, size.width, size.height));
      const next = movers.get(id)!;
      win.setPosition(next.x, next.y);
    }
    if (movers.size === 0 && moverTimer) {
      clearInterval(moverTimer);
      moverTimer = null;
    }
  }, 16);
}

function stopMoving(id: string): void {
  movers.delete(id);
}

// Main window that requested popups — used to deliver close notifications
let mainWin: BrowserWindow | null = null;

function notifyPopupClosed(id: string): void {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send("popup:closed", id);
  }
  for (const listener of closeListeners) listener(id);
}

type PopupCloseListener = (id: string) => void;
const closeListeners = new Set<PopupCloseListener>();

/** Observe popup closes from any origin (renderer IPC or Lua scripts). */
function onPopupClosed(listener: PopupCloseListener): () => void {
  closeListeners.add(listener);
  return () => closeListeners.delete(listener);
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
  // The work area (not the full display bounds): a popup whose bottom-right
  // corner carries the close button must never spawn under the menu bar or
  // the dock, where the button would be unreachable.
  return screen.getPrimaryDisplay().workArea;
}

/** Read a raw numeric/boolean setting from the live settings cache. */
function readSetting(key: string): number {
  return getSettingNumber(key);
}

/**
 * Create a new popup BrowserWindow and register it in the global map.
 * Returns a unique ID caller can use to close the popup later.
 */
function createPopupWindow(
  type: "image" | "video" | "audio" | "subliminal" | "prompt",
  mediaId: string,
  hypnoGif?: string,
  pumpScare?: boolean
): { id: string } {
  const id = `popup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bounds = getPrimaryMonitorBounds();

  // Audio pops are a small chip, not a media window. Media pops start at a
  // default frame and resize to the file once the renderer knows its natural
  // size (popup:sizeToMedia).
  const isAudio = type === "audio";
  const isSubliminal = type === "subliminal";
  const defaultWidth = isAudio ? 140 : 400;
  const defaultHeight = isAudio ? 44 : 300;

  // The subliminal text popup is large and centered (legacy: label-sized box
  // at monitor center with wrap at monitor/1.5); media pops get a random spot.
  const width = isSubliminal ? Math.floor(bounds.width * 0.66) : defaultWidth;
  const height = isSubliminal ? Math.floor(bounds.height * 0.5) : defaultHeight;
  const lowkey = !isSubliminal && readSetting("lkToggle") === 1
    ? lowkeyPosition(readSetting("lkCorner"), bounds, width, height)
    : null;
  const x = isSubliminal
    ? Math.floor(bounds.x + (bounds.width - width) / 2)
    : lowkey
      ? lowkey.x
      : Math.floor(bounds.x + Math.random() * Math.max(0, bounds.width - defaultWidth));
  const y = isSubliminal
    ? Math.floor(bounds.y + (bounds.height - height) / 2)
    : lowkey
      ? lowkey.y
      : Math.floor(bounds.y + Math.random() * Math.max(0, bounds.height - defaultHeight));

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
    // Popups take mouse clicks but never window focus: focusable popups
    // starve the main window's input routing once many are open, which can
    // leave the user unable to click Stop during a storm. Prompt popups are
    // the exception — they carry a text field the user must be able to type
    // into — and they are rare enough not to storm.
    focusable: type === "prompt",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required",
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const url = getPopupUrl();
  const query = [hypnoGif ? `h=${encodeURIComponent(hypnoGif)}` : "", pumpScare ? "ps=1" : ""]
    .filter(Boolean)
    .join("&");
  const querySeg = query ? `?${query}` : "";
  popupWin.loadURL(`${url}#/popup/${type}/${encodeURIComponent(mediaId)}/${id}${querySeg}`);
  if (type === "prompt") {
    popupWin.webContents.once("did-finish-load", () => {
      if (!popupWin.isDestroyed()) popupWin.focus();
    });
  }

  popupWin.on("closed", () => {
    stopMoving(id);
    popupWindows.delete(id);
    popupTypes.delete(id);
    notifyPopupClosed(id);
  });

  popupWindows.set(id, popupWin);
  popupTypes.set(id, type);

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
    stopMoving(id);
    const win = popupWindows.get(id);
    popupWindows.delete(id);
    popupTypes.delete(id);
    // Destroy, not close: teardown must not wait on per-window unload
    // handling while dozens of windows come down at once. The "closed"
    // event still fires, so listeners see every window go.
    if (win && !win.isDestroyed()) win.destroy();
    logger.info(`[Popup] Closed popup ${id}`);
  }
  if (ids.length) logger.info(`[Popup] Closed all popups (${ids.length} total)`);
}

function registerHandlers(): void {
  ipcMain.handle(
    "popup:create",
    async (
      event,
      type: "image" | "video" | "audio" | "subliminal" | "prompt",
      mediaId: string,
      hypnoGif?: string,
      pumpScare?: boolean
    ): Promise<{ id: string }> => {
      const POPUP_TYPES = ["image", "video", "audio", "subliminal", "prompt"] as const;
      if (!POPUP_TYPES.includes(type) || typeof mediaId !== "string" || !mediaId || mediaId.length > 2048) {
        logger.warn(`[Popup] Rejected create with type=${JSON.stringify(type)}`);
        throw new Error("Invalid popup request");
      }
      try {
        mainWin = BrowserWindow.fromWebContents(event.sender);
        return createPopupWindow(type, mediaId, hypnoGif, pumpScare === true);
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

  /**
   * Resize a popup window to exactly fit its media, legacy-style: the media's
   * longest side spans a random 30–70% of the display's shortest side
   * (20–50% lowkey). The renderer measures the natural media size and calls
   * this once on load, so no letterbox surface surrounds the media.
   */
  ipcMain.handle(
    "popup:sizeToMedia",
    async (
      _event,
      id: string,
      mediaWidth: number,
      mediaHeight: number,
      lowkey?: boolean
    ): Promise<{ width: number; height: number } | null> => {
      const win = popupWindows.get(id);
      if (!win || win.isDestroyed() || !(mediaWidth > 0) || !(mediaHeight > 0)) return null;
      try {
        const display = screen.getDisplayMatching(win.getBounds());
        const shortSide = Math.min(display.workAreaSize.width, display.workAreaSize.height);
        const target = legacyPopupSize(mediaWidth, mediaHeight, shortSide, Math.random, lowkey === true);
        const width = Math.max(32, Math.min(target.width, display.workAreaSize.width));
        const height = Math.max(32, Math.min(target.height, display.workAreaSize.height));
        win.setContentSize(width, height);
        // The window grows around its top-left corner; pull it back inside
        // the work area so the close button at its bottom-right stays
        // reachable (an off-screen popup cannot be dismissed).
        const wa = display.workArea;
        const placed = win.getBounds();
        const nx = Math.max(wa.x, Math.min(placed.x, wa.x + Math.max(0, wa.width - placed.width)));
        const ny = Math.max(wa.y, Math.min(placed.y, wa.y + Math.max(0, wa.height - placed.height)));
        if (nx !== placed.x || ny !== placed.y) win.setPosition(nx, ny);
        return { width, height };
      } catch (err) {
        logger.error("[Popup] Failed to size popup to media:", err);
        return null;
      }
    }
  );

  /**
   * Start moving a popup window across its display (legacy try_move): random
   * velocity of up to ±movingSpeed px per tick, bouncing off display edges.
   */
  ipcMain.handle("popup:startMoving", async (_event, id: string): Promise<boolean> => {
    const win = popupWindows.get(id);
    if (!win || win.isDestroyed() || movers.has(id)) return false;
    const speed = readSetting("movingSpeed") || 5;
    const start = win.getBounds();
    movers.set(id, initialMoveState(start.x, start.y, speed));
    ensureMoverLoop();
    return true;
  });
}

export { registerHandlers, closeAllPopups, createPopupWindow, onPopupClosed };
export type { PopupCloseListener };
export { popupWindows };
