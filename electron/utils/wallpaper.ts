/**
 * @file wallpaper — Cross-platform desktop wallpaper setting.
 *
 * macOS drives Finder through osascript; Linux picks a command per desktop
 * environment (gsettings for GNOME, qdbus for KDE, feh/nitrogen fallback);
 * Windows goes through PowerShell. Every failure path logs — callers never
 * receive exceptions, matching the legacy app's best-effort behavior.
 */
import fs from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "./logger";

const execAsync = promisify(exec);

function setWallpaperDarwin(filepath: string): Promise<void> {
  const script = `osascript -e 'tell application "Finder" to set desktop picture to POSIX file "${filepath}"'`;
  return execAsync(script).then(() => {}).catch((err) => {
    logger.error("[Wallpaper] Failed to set wallpaper (macOS):", err.message);
  });
}

function setWallpaperLinux(filepath: string): Promise<void> {
  const desktop = process.env.XDG_CURRENT_DESKTOP || "";
  let command: string;

  if (desktop.toLowerCase().includes("gnome") || desktop.toLowerCase().includes("ubuntu")) {
    command = `gsettings set org.gnome.desktop.background picture-uri "file://${filepath}"`;
  } else if (desktop.toLowerCase().includes("kde") || desktop.toLowerCase().includes("plasma")) {
    command = `qdbus org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "var root = GetComponent('plasmashell').shell.coreShell; var wallpaper = root.findObject('AllWidgets', 'Containment'); wallpaper.currentConfigGroup.writeEntry('Image', 'file://${filepath}')"`;
  } else {
    command = `feh --bg-scale "${filepath}" 2>/dev/null || nitrogen --set-scale "${filepath}" 2>/dev/null || true`;
  }

  return execAsync(command).then(() => {}).catch((err) => {
    logger.error("[Wallpaper] Failed to set wallpaper (Linux):", err.message);
  });
}

function setWallpaperWindows(filepath: string): Promise<void> {
  const script = `powershell -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\\"user32.dll\\")]public static extern int SystemParametersInfo(int uAction,int uParam,string lpvParam,int fuWinIni);}'; [W]::SystemParametersInfo(20,0,'${filepath}',3)"`;
  return execAsync(script).then(() => {}).catch((err) => {
    logger.error("[Wallpaper] Failed to set wallpaper (Windows):", err.message);
  });
}

export async function setWallpaper(filepath: string): Promise<void> {
  if (!fs.existsSync(filepath)) {
    logger.error("[Wallpaper] Wallpaper file does not exist:", filepath);
    return;
  }

  try {
    if (process.platform === "darwin") {
      await setWallpaperDarwin(filepath);
    } else if (process.platform === "linux") {
      await setWallpaperLinux(filepath);
    } else if (process.platform === "win32") {
      await setWallpaperWindows(filepath);
    } else {
      logger.warn("[Wallpaper] Unsupported platform for wallpaper:", process.platform);
    }
  } catch (err) {
    logger.error("[Wallpaper] Wallpaper set failed:", err);
  }
}
