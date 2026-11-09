import { app, nativeImage, type NativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger";

const ICON_MIME: Record<string, string> = {
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Icon candidates in legacy resolution order: the active pack's icon file
 * (icon.ico, then icon.png), then the bundled default derived from the
 * legacy default_icon.ico.
 */
export function iconCandidates(packDir: string | null): string[] {
  const list = packDir
    ? [path.join(packDir, "icon.ico"), path.join(packDir, "icon.png")]
    : [];
  // Dev and packaged layouts keep the renderer dist next to the main bundle.
  list.push(
    path.join(__dirname, "..", "dist", "icon.png"),
    path.join(app.getAppPath(), "dist", "icon.png")
  );
  return list;
}

function firstExisting(packDir: string | null): string | null {
  for (const candidate of iconCandidates(packDir)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** The active pack directory as recorded in the persisted config. */
export function activePackDir(): string | null {
  try {
    const cfg = fs.readFileSync(
      path.join(app.getPath("userData"), "data", "config.json"),
      "utf-8"
    );
    const parsed = JSON.parse(cfg) as Record<string, unknown>;
    const raw = typeof parsed.packPath === "string" ? parsed.packPath : "";
    if (!raw) return null;
    return raw.startsWith("~") ? raw.replace("~", app.getPath("home")) : raw;
  } catch {
    return null;
  }
}

/** The app icon (window, dock, tray) as a native image, or null. */
export function loadAppIcon(packDir: string | null): NativeImage | null {
  const file = firstExisting(packDir);
  if (!file) {
    logger.error("[Icon] No app icon asset found");
    return null;
  }
  const image = nativeImage.createFromPath(file);
  return image.isEmpty() ? null : image;
}

/** The app icon as a data URL for renderer use, or null. */
export function loadAppIconDataUrl(packDir: string | null): string | null {
  const file = firstExisting(packDir);
  if (!file) return null;
  const mime = ICON_MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  try {
    return `${mime};base64,${fs.readFileSync(file).toString("base64")}`;
  } catch (err) {
    logger.error("[Icon] Failed to read app icon:", err);
    return null;
  }
}

/** Log which icon file the app resolved (startup diagnostics and tests). */
export function logResolvedIcon(packDir: string | null): void {
  const file = firstExisting(packDir);
  logger.info(`[Icon] Using app icon: ${file ?? "none"}`);
}
