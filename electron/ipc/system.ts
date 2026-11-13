import { app, ipcMain, Tray, Menu, BrowserWindow, Notification, dialog, shell } from "electron";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger";
import { skipHibernate } from "./hibernate";
import { panicFromTray } from "./panic";
import { setDiscordPresence as discordSetPresence } from "./discord";
import { setWallpaper } from "../utils/wallpaper";
import { beforeWallpaperChange, restoreWallpaperIfDirty } from "../utils/wallpaperMemory";
import { autostartFilePath, buildAutostartEntry } from "../utils/autostart";
import { activePackDir, loadAppIcon, resolveIconFile } from "../utils/appIcon";
import {
  extractPackZip,
  parsePackInfo,
  sanitizePackName,
  uniqueDestPath,
  type ImportProgress,
} from "../utils/packImport";
import type { PackListing } from "../../src/types/pack";

const execFileAsync = promisify(execFile);

// System handler — OS-level operations (wallpaper, tray, packs, desktop icons)

/** Resolve the app's user data directory for storing config and packs. */
function dataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

/**
 * D-19 pack library convention: one canonical library at
 * `<userData>/data/packs`. In dev/unpackaged mode the repository `packs/`
 * directory is additionally scanned so local work keeps functioning.
 * Zip imports always extract into the canonical library.
 */
function canonicalPackLibrary(): string {
  return path.join(dataDir(), "packs");
}

function devRepoPackLibrary(): string | null {
  if (app.isPackaged) return null;
  // The built main process lives in <repo>/dist-electron, so the repository
  // packs/ directory is one level up from __dirname.
  const repoPacks = path.resolve(__dirname, "../packs");
  return fs.existsSync(repoPacks) ? repoPacks : null;
}

/** User-added pack folders, persisted in settings (config.json `packFolders`). */
function userPackFolders(): string[] {
  const configPath = path.join(dataDir(), "config.json");
  if (!fs.existsSync(configPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    const folders = parsed.packFolders;
    if (!Array.isArray(folders)) return [];
    return folders.filter((folder): folder is string => typeof folder === "string" && folder.length > 0);
  } catch {
    return [];
  }
}

/** Read and parse a JSON file, returning null on error. */
function readJson<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function packIdentityFor(packPath: string, fallbackName: string): PackListing {
  const info = readJson<Record<string, unknown>>(path.join(packPath, "info.json"));
  const identity = parsePackInfo(info, fallbackName);
  return {
    name: identity.name,
    path: packPath,
    ...(identity.version ? { version: identity.version } : {}),
    ...(identity.creator ? { creator: identity.creator } : {}),
  };
}

let trayIcon: Tray | null = null;

function createDesktopIconsDarwin(): void {
  logger.info("[System] Desktop icons on macOS — alias creation not natively supported via Electron. User must manually create shortcuts.");
}

function createDesktopIconsLinux(): void {
  try {
    const desktopDir = path.join(app.getPath("home"), "Desktop");
    if (!fs.existsSync(desktopDir)) {
      fs.mkdirSync(desktopDir, { recursive: true });
    }

    const exePath = process.execPath;
    const desktopContent = `[Desktop Entry]
Type=Application
Name=EdgewarePlusPlus
Exec=${exePath}
Icon=application-x-executable
Terminal=false
Categories=Utility;
Comment=Edgeware++ Desktop Application
`;

    const desktopPath = path.join(desktopDir, "EdgewarePlusPlus.desktop");
    fs.writeFileSync(desktopPath, desktopContent, "utf-8");
    fs.chmodSync(desktopPath, 0o755);
    logger.info("[System] Desktop icon created:", desktopPath);
  } catch (err) {
    logger.error("[System] Failed to create desktop icon (Linux):", err);
  }
}

function createDesktopIconsWindows(): void {
  try {
    const desktopDir = path.join(app.getPath("desktop"));
    const exePath = process.execPath;
    const vbsPath = path.join(app.getPath("temp"), "create_shortcut.vbs");

    const vbsContent = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${path.join(desktopDir, "EdgewarePlusPlus.lnk")}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "${exePath}"
oLink.Save
`;

    fs.writeFileSync(vbsPath, vbsContent, "utf-8");
    execFileAsync("cscript", ["//nologo", vbsPath])
      .then(() => fs.unlinkSync(vbsPath))
      .catch(() => {});
    logger.info("[System] Desktop icon created (Windows)");
  } catch (err) {
    logger.error("[System] Failed to create desktop icon (Windows):", err);
  }
}

function createTrayIcon(): Tray | null {
  try {
    const image = loadAppIcon(activePackDir());
    if (!image) {
      logger.error("[System] Tray icon asset missing");
      return null;
    }

    const tray = new Tray(image);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Panic",
        click: () => {
          panicFromTray();
        },
      },
      {
        label: "Stop",
        click: () => {
          ipcMain.emit("hibernate:stop");
          BrowserWindow.getAllWindows().forEach((win) => win.close());
          app.quit();
        },
      },
      {
        label: "Skip Hibernate",
        click: () => {
          skipHibernate();
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit(),
      },
    ]);

    tray.setToolTip("Edgeware++");
    tray.setContextMenu(contextMenu);
    logger.info("[System] Tray icon created");
    return tray;
  } catch (err) {
    logger.error("[System] Failed to create tray icon:", err);
    return null;
  }
}

async function toggleRunAtStartup(state: boolean): Promise<void> {
  if (process.platform === "linux") {
    const file = autostartFilePath(app.getPath("home"));
    if (state) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buildAutostartEntry(app.getPath("exe")), "utf-8");
    } else if (fs.existsSync(file)) {
      fs.rmSync(file);
    }
    logger.info(`[System] Run at startup (Linux autostart): ${state ? "enabled" : "disabled"} → ${file}`);
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: state,
    openAsHidden: true,
  });
  logger.info(`[System] Run at startup: ${state ? "enabled" : "disabled"}`);
}

async function setDiscordPresence(text: string, imageId: string): Promise<void> {
  await discordSetPresence(text, imageId);
}

function sendNotification(title: string, message: string, attachmentPath?: string): void {
  const expanded =
    attachmentPath && attachmentPath.startsWith("~")
      ? attachmentPath.replace("~", app.getPath("home"))
      : attachmentPath;
  // Notification art: the pack's own icon, overridden by an attached image.
  // (macOS draws its banner icon from the app bundle and ignores this field;
  // Windows and Linux show it.)
  const iconFile =
    (expanded && fs.existsSync(expanded) ? expanded : null) ?? resolveIconFile(activePackDir());
  const notification = new Notification({
    title,
    body: message,
    ...(iconFile ? { icon: iconFile } : {}),
  });
  notification.show();
  logger.info(`[System] Notification shown: "${title}: ${message}"${expanded && fs.existsSync(expanded) ? " (with image)" : ""}`);
}

/**
 * Open an http(s) url in the system browser (legacy open_web). With
 * EDGWARE_STUB_BROWSER set the open is only logged, so automated runs never
 * launch a real browser.
 */
async function openExternalUrl(url: unknown): Promise<boolean> {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
  if (process.env.EDGWARE_STUB_BROWSER) {
    logger.info(`[System] Browser open stubbed: ${url}`);
    return true;
  }
  try {
    await shell.openExternal(url);
    return true;
  } catch (err) {
    logger.error("[System] Failed to open external url:", err);
    return false;
  }
}

function registerHandlers(): void {
  ipcMain.handle("system:sendNotification", async (_event, title: string, message: string, attachmentPath?: string): Promise<void> => {
    sendNotification(title, message, attachmentPath);
  });

  /**
   * Open a URL in the system's default browser (legacy open_web behaviour for
   * web popups). Only http(s) urls are honoured so a pack can never point the
   * OS at local resources via file:// etc.
   */
  ipcMain.handle("system:openExternal", async (_event, url: unknown): Promise<boolean> =>
    openExternalUrl(url)
  );

  ipcMain.handle("system:setWallpaper", async (_event, filepath: string): Promise<void> => {
    const expanded = filepath.startsWith("~") ? filepath.replace("~", app.getPath("home")) : filepath;
    await beforeWallpaperChange();
    await setWallpaper(expanded);
  });

  ipcMain.handle("wallpaper:restoreOriginal", async (): Promise<boolean> =>
    restoreWallpaperIfDirty()
  );

  // Legacy run_on_save_quit: the app exits once settings have been written.
  ipcMain.handle("system:quit", async (): Promise<void> => {
    setTimeout(() => app.quit(), 50);
  });

  ipcMain.handle("system:createDesktopIcons", async (): Promise<void> => {
    if (process.platform === "darwin") {
      createDesktopIconsDarwin();
    } else if (process.platform === "linux") {
      createDesktopIconsLinux();
    } else if (process.platform === "win32") {
      createDesktopIconsWindows();
    } else {
      logger.warn("[System] Unsupported platform for desktop icons:", process.platform);
    }
  });

  ipcMain.handle("system:createTray", async (): Promise<boolean> => {
    if (trayIcon) {
      trayIcon.destroy();
      trayIcon = null;
    }
    trayIcon = createTrayIcon();
    return trayIcon !== null;
  });

  /**
   * Read the persisted corruption launch count, then record this launch.
   * Mirrors legacy `Data.CORRUPTION_LAUNCHES`; returns the count from before
   * this launch so the runtime can resolve the starting level. The count
   * tracks app launches, not runtime starts: it increments at most once per
   * process, however often the user starts and stops.
   */
  let launchRecorded = false;
  ipcMain.handle("system:corruptionLaunches", async (): Promise<number> => {
    const file = path.join(dataDir(), "corruption_launches");
    let previous = 0;
    try {
      if (fs.existsSync(file)) previous = parseInt(fs.readFileSync(file, "utf-8"), 10) || 0;
      if (!launchRecorded) {
        fs.mkdirSync(dataDir(), { recursive: true });
        fs.writeFileSync(file, String(previous + 1));
        launchRecorded = true;
      }
    } catch (err) {
      logger.error("[System] Failed to update corruption launch count:", err);
    }
    return previous;
  });

  ipcMain.handle("system:toggleRunAtStartup", async (_event, state: boolean): Promise<void> => {
    await toggleRunAtStartup(state);
  });

  ipcMain.handle("system:setDiscordPresence", async (_event, text: string, imageId: string): Promise<void> => {
    await setDiscordPresence(text, imageId);
  });

  ipcMain.handle("system:listPacks", async (): Promise<PackListing[]> => {
    try {
      const library = canonicalPackLibrary();
      if (!fs.existsSync(library)) {
        await fs.promises.mkdir(library, { recursive: true });
      }

      const seen = new Set<string>();
      const packs: PackListing[] = [];

      const addPack = (packPath: string, fallbackName: string): void => {
        const resolved = path.resolve(packPath);
        if (seen.has(resolved)) return;
        seen.add(resolved);
        packs.push(packIdentityFor(resolved, fallbackName));
      };

      const libraryDirs = [library, devRepoPackLibrary()].filter(
        (dir): dir is string => dir !== null && fs.existsSync(dir)
      );

      for (const dir of libraryDirs) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const sorted = entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of sorted) {
          addPack(path.join(dir, entry.name), entry.name);
        }
      }

      for (const folder of userPackFolders()) {
        const resolved = path.resolve(folder);
        if (!fs.existsSync(resolved)) continue;
        addPack(resolved, path.basename(resolved));
      }

      return packs;
    } catch (err) {
      logger.error("[System] Error listing packs:", err);
      return [];
    }
  });

  ipcMain.handle("system:importPack", async (event, filepath: string): Promise<PackListing> => {
    if (typeof filepath !== "string" || filepath.length === 0) {
      throw new Error("No file path was provided for the pack import.");
    }

    const source = path.resolve(filepath);
    if (!fs.existsSync(source)) {
      throw new Error(`Pack file not found: ${source}`);
    }

    const library = canonicalPackLibrary();
    await fs.promises.mkdir(library, { recursive: true });

    const baseName = sanitizePackName(path.basename(source));
    const destPath = uniqueDestPath(library, baseName);

    const sender = event.sender;
    const sendProgress = (progress: ImportProgress): void => {
      if (sender && !sender.isDestroyed()) {
        sender.send("system:packImportProgress", {
          done: progress.done,
          total: progress.total,
          name: baseName,
        });
      }
    };

    try {
      await extractPackZip(source, destPath, sendProgress);
    } catch (err) {
      logger.error("[System] Pack import failed:", err);
      throw err instanceof Error ? err : new Error("Pack import failed.");
    }

    const imported = packIdentityFor(destPath, path.basename(destPath));
    logger.info(`[System] Imported pack: ${source} -> ${destPath}`);
    return imported;
  });

  ipcMain.handle(
    "system:selectZip",
    async (): Promise<{ cancelled: boolean; filePaths: string[] }> => {
      const override = process.env.EDGWARE_IMPORT_TEST_PATH;
      if (override) {
        return { cancelled: false, filePaths: [override] };
      }
      const windows = BrowserWindow.getAllWindows();
      const parent = windows.find((w) => !w.webContents.isDestroyed());
      const result = parent
        ? await dialog.showOpenDialog(parent, {
            title: "Import a pack from a zip file",
          buttonLabel: "Import",
          filters: [{ name: "Zip archives", extensions: ["zip"] }],
          properties: ["openFile"],
        })
        : await dialog.showOpenDialog({
            title: "Import a pack from a zip file",
            buttonLabel: "Import",
            filters: [{ name: "Zip archives", extensions: ["zip"] }],
            properties: ["openFile"],
          });
      return { cancelled: result.canceled, filePaths: result.filePaths };
    }
  );

  ipcMain.handle(
    "system:selectPackFolder",
    async (): Promise<{ cancelled: boolean; folderPath?: string }> => {
      const override = process.env.EDGWARE_PACK_FOLDER_TEST_PATH;
      if (override) {
        return { cancelled: false, folderPath: override };
      }
      const windows = BrowserWindow.getAllWindows();
      const parent = windows.find((w) => !w.webContents.isDestroyed());
      const result = parent
        ? await dialog.showOpenDialog(parent, {
            title: "Add an existing pack folder",
          buttonLabel: "Add",
          properties: ["openDirectory"],
        })
        : await dialog.showOpenDialog({
            title: "Add an existing pack folder",
            buttonLabel: "Add",
            properties: ["openDirectory"],
          });
      return { cancelled: result.canceled, folderPath: result.filePaths[0] };
    }
  );

  ipcMain.handle(
    "system:validatePackFolder",
    async (
      _event,
      folderPath: string
    ): Promise<{
      ok: boolean;
      error?: string;
      warning?: string;
      name?: string;
      version?: string;
      creator?: string;
    }> => {
      if (typeof folderPath !== "string" || folderPath.length === 0) {
        throw new Error("No folder path was provided.");
      }
      const abs = path.resolve(folderPath);
      let stats: fs.Stats;
      try {
        stats = fs.statSync(abs);
      } catch {
        return { ok: false, error: `That location does not exist: ${abs}` };
      }
      if (!stats.isDirectory()) {
        return { ok: false, error: `That location is not a folder: ${abs}` };
      }

      const info = readJson<Record<string, unknown>>(path.join(abs, "info.json"));
      const hasIndex = fs.existsSync(path.join(abs, "index.json"));
      const identity = parsePackInfo(info, path.basename(abs));

      if (!info && !hasIndex) {
        return {
          ok: true,
          warning:
            "No info.json or index.json found — the folder was added anyway, but the pack may be incomplete.",
          ...identity,
        };
      }
      return { ok: true, ...identity };
    }
  );

  ipcMain.handle("system:openPackLibrary", async (): Promise<void> => {
    const library = canonicalPackLibrary();
    try {
      await fs.promises.mkdir(library, { recursive: true });
      await shell.openPath(library);
    } catch (err) {
      logger.error("[System] Could not open pack library folder:", err);
    }
  });

  let saveSeq = 0;

  /**
   * Last-chance settings write: the renderer calls this synchronously from
   * its unload hook so dirty state inside the autosave window is not lost
   * when the app quits.
   */
  ipcMain.on("system:saveSettingsSync", (event, settings: unknown): void => {
    try {
      const dir = dataDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const configPath = path.join(dir, "config.json");
      const tmpPath = `${configPath}.${process.pid}.${saveSeq++}.sync.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
      fs.renameSync(tmpPath, configPath);
      event.returnValue = true;
    } catch (err) {
      logger.error("[System] Failed to flush settings on unload:", err);
      event.returnValue = false;
    }
  });

ipcMain.handle("system:loadSettings", async (): Promise<Record<string, unknown> | null> => {
    const configPath = path.join(dataDir(), "config.json");
    return readJson<Record<string, unknown>>(configPath);
  });

  ipcMain.handle("system:saveSettings", async (_event, settings: Record<string, unknown>): Promise<void> => {
    // config.json must stay a settings object: a string or array payload
    // would land on disk and only limp along because readers are lenient.
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      logger.error("[System] saveSettings rejected a non-object payload");
      return;
    }
    try {
      const dir = dataDir();
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const configPath = path.join(dir, "config.json");
      // Atomic replace with a per-writer temp name: concurrent saves must
      // never share a staging file, or one writer's rename consumes or
      // truncates another's payload and the config lands half-written.
      const tmpPath = `${configPath}.${process.pid}.${saveSeq++}.tmp`;
      try {
        await fs.promises.writeFile(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
        await fs.promises.rename(tmpPath, configPath);
      } catch (err) {
        await fs.promises.rm(tmpPath, { force: true }).catch(() => undefined);
        throw err;
      }
    } catch (err) {
      logger.error("[System] Failed to save settings:", err);
      throw err;
    }
  });
}

export { registerHandlers, sendNotification as showNotification, openExternalUrl };
