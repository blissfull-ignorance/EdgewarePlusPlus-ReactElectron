import { restoreWallpaperIfDirty } from "./utils/wallpaperMemory";
import { applyBaselineRevert } from "./utils/sessionBaseline";
import { invalidateConfigCache } from "./utils/configCache";
import { app, BrowserWindow } from "electron";
import path from "path";

if (process.env.EDGWARE_USER_DATA_DIR && path.isAbsolute(process.env.EDGWARE_USER_DATA_DIR)) {
  app.setPath("userData", process.env.EDGWARE_USER_DATA_DIR);
}

// Privilege the pack-media scheme before the app is ready — must precede any
// window load so popup overlays can stream real pack media.
import {
  configurePackMediaScheme,
  registerPackMediaProtocol,
} from "./ipc/packmedia";

configurePackMediaScheme();

import { registerHandlers as registerPackHandlers } from "./ipc/pack";
import { registerHandlers as registerCorruptionHandlers } from "./ipc/corruption";
import { registerHandlers as registerPopupHandlers, closeAllPopups } from "./ipc/popup";
import { registerHandlers as registerScriptingHandlers, stopScripting } from "./ipc/scripting";
import { registerHandlers as registerSystemHandlers } from "./ipc/system";
import { registerHandlers as registerPanicHandlers } from "./ipc/panic";
import { activePackDir, loadAppIcon, logResolvedIcon } from "./utils/appIcon";
import { logger } from "./utils/logger";
import fs from "node:fs";

// Legacy video_hardware_acceleration gates media decoding acceleration;
// the Chromium equivalent must be decided before the app is ready.
function applyHardwareAccelerationSetting(): void {
  try {
    const cfg = fs.readFileSync(path.join(app.getPath("userData"), "data", "config.json"), "utf-8");
    const parsed = JSON.parse(cfg) as Record<string, unknown>;
    if (parsed.videoHardwareAcceleration === 0) {
      app.disableHardwareAcceleration();
      logger.info("[Main] Hardware acceleration disabled (videoHardwareAcceleration=0)");
    }
  } catch {
    /* no persisted config yet */
  }
}
applyHardwareAccelerationSetting();

let win: BrowserWindow | null;

// One runtime per userData directory: a second launch would spawn a parallel
// popup session and race config.json writes against the first. The second
// process exits; the first window wakes.
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

function registerAllHandlers(): void {
  registerPackHandlers();
  registerCorruptionHandlers();
  registerPopupHandlers();
  registerScriptingHandlers();
  registerSystemHandlers();
  registerPanicHandlers();
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    backgroundColor: "#000000",
    icon: loadAppIcon(activePackDir()) ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  win.on("ready-to-show", () => {
    win?.show();
  });

  win.on("closed", () => {
    win = null;
    // The main window is the app: close its popups and Lua session so no
    // popup-spawning chain keeps the process alive behind invisible windows.
    stopScripting();
    closeAllPopups();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (app.isPackaged) {
    // Packaged builds ship the built renderer inside the app bundle; there is
    // no dev server to point at.
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    const port = process.env.VITE_PORT ?? 5173;
    win.loadURL(`http://localhost:${port}`);
  }
}

app.whenReady().then(() => {
  if (!ownsInstance) return;
  registerPackMediaProtocol();
  registerAllHandlers();
  const packDir = activePackDir();
  logResolvedIcon(packDir);
  if (process.platform === "darwin" && app.dock) {
    const dockIcon = loadAppIcon(packDir);
    if (dockIcon) app.dock.setIcon(dockIcon);
  }
  // A quit/crash/panic mid-session leaves pack-overridden settings in
  // config.json; the persisted baseline gives the user's values back
  // before any window reads the file.
  applyBaselineRevert();
  // The revert rewrote config.json; make sure the live cache primes from the
  // merged file, never a pre-revert snapshot.
  invalidateConfigCache();
  createWindow();
  // A crash or panic mid-session can leave the pack's wallpaper applied;
  // the cached original comes back on the next boot.
  void restoreWallpaperIfDirty().catch((err) =>
    logger.error("[Main] Startup wallpaper restore failed:", err)
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  // Media windows stream audio and the Lua session schedules callbacks;
  // both must die with the app, not outlive the window the user quit.
  closeAllPopups();
  stopScripting();
});

app.on("window-all-closed", () => {
  win = null;
  // No background mode on any platform: with every window gone there is
  // nothing left to see or hear, so the process must exit.
  app.quit();
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
