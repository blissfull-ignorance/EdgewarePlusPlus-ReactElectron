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
import { registerHandlers as registerPopupHandlers } from "./ipc/popup";
import { registerHandlers as registerHibernateHandlers } from "./ipc/hibernate";
import { registerHandlers as registerScriptingHandlers } from "./ipc/scripting";
import { registerHandlers as registerSystemHandlers } from "./ipc/system";
import { registerHandlers as registerPanicHandlers } from "./ipc/panic";
import { registerHandlers as registerBooruHandlers } from "./ipc/booru";
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

function registerAllHandlers(): void {
  registerPackHandlers();
  registerCorruptionHandlers();
  registerPopupHandlers();
  registerHibernateHandlers();
  registerScriptingHandlers();
  registerSystemHandlers();
  registerPanicHandlers();
  registerBooruHandlers();
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
  registerPackMediaProtocol();
  registerAllHandlers();
  const packDir = activePackDir();
  logResolvedIcon(packDir);
  if (process.platform === "darwin" && app.dock) {
    const dockIcon = loadAppIcon(packDir);
    if (dockIcon) app.dock.setIcon(dockIcon);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
