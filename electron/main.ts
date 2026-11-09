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

let win: BrowserWindow | null;

function registerAllHandlers(): void {
  registerPackHandlers();
  registerCorruptionHandlers();
  registerPopupHandlers();
  registerHibernateHandlers();
  registerScriptingHandlers();
  registerSystemHandlers();
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
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
  } else {
    const port = process.env.VITE_PORT ?? 5173;
    win.loadURL(`http://localhost:${port}`);
  }
}

app.whenReady().then(() => {
  registerPackMediaProtocol();
  registerAllHandlers();
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
