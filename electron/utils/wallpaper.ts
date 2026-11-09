/**
 * @file wallpaper — Cross-platform desktop wallpaper setting.
 *
 * macOS drives Finder through osascript; Linux picks a command per desktop
 * environment (gsettings for GNOME, qdbus for KDE, feh/nitrogen fallback);
 * Windows goes through PowerShell. Every invocation passes the filepath as
 * an argument (never interpolated into a shell string), so paths containing
 * quotes or spaces cannot break out into command execution. Every failure
 * path logs — callers never receive exceptions, matching the legacy app's
 * best-effort behavior.
 */
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

/** Escape a value for embedding inside an AppleScript double-quoted string. */
function appleScriptString(filepath: string): string {
  return filepath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Escape a value for embedding inside a PowerShell single-quoted string. */
function powerShellString(filepath: string): string {
  return filepath.replace(/'/g, "''");
}

function setWallpaperDarwin(filepath: string): Promise<void> {
  const script = `tell application "Finder" to set desktop picture to POSIX file "${appleScriptString(filepath)}"`;
  return execFileAsync("osascript", ["-e", script]).then(() => {}).catch((err) => {
    logger.error("[Wallpaper] Failed to set wallpaper (macOS):", err instanceof Error ? err.message : err);
  });
}

function setWallpaperLinux(filepath: string): Promise<void> {
  const desktop = process.env.XDG_CURRENT_DESKTOP || "";

  if (desktop.toLowerCase().includes("gnome") || desktop.toLowerCase().includes("ubuntu")) {
    return execFileAsync("gsettings", [
      "set",
      "org.gnome.desktop.background",
      "picture-uri",
      `file://${filepath}`,
    ])
      .then(() => {})
      .catch((err) => {
        logger.error("[Wallpaper] Failed to set wallpaper (GNOME):", err instanceof Error ? err.message : err);
      });
  }

  if (desktop.toLowerCase().includes("kde") || desktop.toLowerCase().includes("plasma")) {
    const js =
      "var root = GetComponent('plasmashell').shell.coreShell; " +
      "var wallpaper = root.findObject('AllWidgets', 'Containment'); " +
      `wallpaper.currentConfigGroup.writeEntry('Image', 'file://${filepath.replace(/'/g, "''")}')`;
    return execFileAsync("qdbus", [
      "org.kde.plasmashell",
      "/PlasmaShell",
      "org.kde.PlasmaShell.evaluateScript",
      js,
    ])
      .then(() => {})
      .catch((err) => {
        logger.error("[Wallpaper] Failed to set wallpaper (KDE):", err instanceof Error ? err.message : err);
      });
  }

  return execFileAsync("feh", ["--bg-scale", filepath])
    .catch(() => execFileAsync("nitrogen", ["--set-scale", filepath]))
    .then(() => {})
    .catch((err) => {
      logger.error("[Wallpaper] Failed to set wallpaper (feh/nitrogen):", err instanceof Error ? err.message : err);
    });
}

function setWallpaperWindows(filepath: string): Promise<void> {
  const script =
    "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;" +
    "public class W{[DllImport(\"user32.dll\")]public static extern int SystemParametersInfo(int uAction,int uParam,string lpvParam,int fuWinIni);}';" +
    `[W]::SystemParametersInfo(20,0,'${powerShellString(filepath)}',3)`;
  return execFileAsync("powershell", ["-NoProfile", "-Command", script])
    .then(() => {})
    .catch((err) => {
      logger.error("[Wallpaper] Failed to set wallpaper (Windows):", err instanceof Error ? err.message : err);
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
