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
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { app } from "electron";
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

/** Escape a value for embedding inside a QtScript/JS single-quoted string. */
function qtScriptString(filepath: string): string {
  return filepath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function setWallpaperDarwin(filepath: string): Promise<void> {
  // System Events is the path that actually applies on modern macOS; the
  // Finder variant silently no-ops there. First use needs Automation
  // permission for Edgeware++ (System Events); a denial is logged with the
  // osascript reason. The timeout keeps a pending permission prompt from
  // stalling the caller forever.
  const script = `tell application "System Events" to tell every desktop to set picture to "${appleScriptString(filepath)}"`;
  return execFileAsync("osascript", ["-e", script], { timeout: 15000 })
    .then(() => {
      logger.info(`[Wallpaper] Applied via System Events: ${filepath}`);
    })
    .catch((err) => {
      const e = err as Error & { stderr?: string };
      const detail = e ? `${e.message}${e.stderr ? ` | ${e.stderr}` : ""}` : String(err);
      logger.error("[Wallpaper] System Events wallpaper set failed (macOS):", detail);
      // Older macOS applies through Finder; try it as a fallback.
      const finder = `tell application "Finder" to set desktop picture to POSIX file "${appleScriptString(filepath)}"`;
      return execFileAsync("osascript", ["-e", finder], { timeout: 15000 })
        .then(() => undefined)
        .catch((err2) => {
          logger.error("[Wallpaper] Finder wallpaper fallback failed (macOS):", err2 instanceof Error ? err2.message : err2);
        });
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
      `wallpaper.currentConfigGroup.writeEntry('Image', 'file://${qtScriptString(filepath)}')`;
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

/**
 * Test hook (EDGWARE_WALLPAPER_STUB=<initial desktop picture path>): applies
 * are recorded into a userData log instead of touching the real desktop, and
 * reads answer from that log — so wallpaper memory can be exercised end to
 * end without hijacking the developer's machine.
 */
function stubLogPath(): string {
  return path.join(app.getPath("userData"), "wallpaper_applied.log");
}

export async function setWallpaper(filepath: string): Promise<void> {
  if (process.env.EDGWARE_WALLPAPER_STUB) {
    try {
      fs.appendFileSync(stubLogPath(), `${filepath}\n`, "utf-8");
    } catch (err) {
      logger.error("[Wallpaper] Stub apply failed:", err);
    }
    return;
  }
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

/**
 * The desktop picture currently applied, or null when the platform cannot
 * report it (or nothing is known). macOS reads every desktop through System
 * Events and returns the first; other platforms report null.
 */
export async function getWallpaper(): Promise<string | null> {
  const stub = process.env.EDGWARE_WALLPAPER_STUB;
  if (stub) {
    try {
      const lines = fs
        .readFileSync(stubLogPath(), "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length) return lines[lines.length - 1];
    } catch {
      /* no apply recorded yet — fall through to the initial desktop */
    }
    return stub;
  }
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-e", 'tell application "System Events" to tell every desktop to get picture'],
      { timeout: 15000 }
    );
    const first = stdout
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean);
    return first ?? null;
  } catch (err) {
    logger.error("[Wallpaper] Failed to read current wallpaper:", err);
    return null;
  }
}
