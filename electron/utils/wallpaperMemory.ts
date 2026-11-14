/**
 * @file wallpaperMemory — the user's own desktop picture survives sessions.
 *
 * Before the app changes the wallpaper for the first time, the current
 * desktop picture is cached to disk and the state marked dirty. Stop, or the
 * next startup after a crash or panic, restores the cached original — pack
 * wallpapers, rotation and the panic image can never strand the desktop.
 * EDGWARE_PANIC_SKIP_WALLPAPER=1 disables the whole mechanism (tests).
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { logger } from "./logger";
import { getWallpaper, setWallpaper } from "./wallpaper";

interface WallpaperState {
  original: string;
  dirty: boolean;
}

function stateFile(): string {
  return path.join(app.getPath("userData"), "wallpaper_state.json");
}

function disabled(): boolean {
  return process.env.EDGWARE_PANIC_SKIP_WALLPAPER === "1";
}

function readState(): WallpaperState | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), "utf-8")) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as WallpaperState).original === "string" &&
      typeof (parsed as WallpaperState).dirty === "boolean"
    ) {
      return parsed as WallpaperState;
    }
  } catch {
    /* no state cached yet */
  }
  return null;
}

function writeState(state: WallpaperState): void {
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(state), "utf-8");
  } catch (err) {
    logger.error("[Wallpaper] Failed to persist wallpaper state:", err);
  }
}

/** Call before every wallpaper change the app itself causes. */
async function beforeWallpaperChange(): Promise<void> {
  if (disabled()) return;
  try {
    const existing = readState();
    if (existing) {
      if (!existing.dirty) writeState({ ...existing, dirty: true });
      return;
    }
    const current = await getWallpaper();
    if (current) {
      writeState({ original: current, dirty: true });
      logger.info(`[Wallpaper] Cached the user's original wallpaper: ${current}`);
    }
  } catch (err) {
    logger.error("[Wallpaper] Failed to cache the original wallpaper:", err);
  }
}

/**
 * Cache the original, then apply the new wallpaper. If the apply fails and
 * this change is what dirtied the state, the flag is cleared again: a
 * wallpaper that never actually changed should not leave a restore pending.
 * A crash before returning keeps the flag set — a pending restore is the
 * crash-safe direction.
 */
export async function applyWallpaper(filepath: string): Promise<void> {
  const alreadyDirty = readState()?.dirty === true;
  await beforeWallpaperChange();
  try {
    await setWallpaper(filepath);
  } catch (err) {
    if (!alreadyDirty) {
      const state = readState();
      if (state?.dirty) writeState({ ...state, dirty: false });
    }
    throw err;
  }
}

/** Restore the cached original when a previous change left it applied. */
export async function restoreWallpaperIfDirty(): Promise<boolean> {
  if (disabled()) return false;
  const state = readState();
  if (!state?.dirty) return false;
  if (!fs.existsSync(state.original)) {
    logger.warn(`[Wallpaper] Cached original no longer exists: ${state.original}`);
    writeState({ ...state, dirty: false });
    return false;
  }
  // Verify before re-applying: if the desktop already shows the original
  // (a failed apply, or the user restored it themselves), retire the flag
  // instead of performing a pointless visible re-set.
  try {
    const current = await getWallpaper();
    if (current === state.original) {
      writeState({ ...state, dirty: false });
      return false;
    }
  } catch (err) {
    logger.warn("[Wallpaper] Could not read the current wallpaper; restoring anyway:", err);
  }
  logger.info(`[Wallpaper] Restoring the original wallpaper: ${state.original}`);
  await setWallpaper(state.original);
  writeState({ ...state, dirty: false });
  return true;
}
