/**
 * @file wallpaperMemory — the user's own desktop picture survives sessions.
 *
 * Before the app changes the wallpaper for the first time, the current
 * desktop picture is cached to disk and the state marked dirty. Stop, or the
 * next startup after a crash or panic, restores the cached original — pack
 * wallpapers, rotation and the panic image can never strand the desktop.
 * Every path the app itself applies is recorded in an `applied` set: a
 * desktop showing app output (a pack wallpaper left over from an unrestored
 * session, a panic image) must never be captured as the user's original.
 * EDGWARE_PANIC_SKIP_WALLPAPER=1 disables the whole mechanism (tests).
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { logger } from "./logger";
import { getWallpaper, setWallpaper } from "./wallpaper";
import { getConfig, invalidateConfigCache } from "./configCache";

interface WallpaperState {
  original: string;
  dirty: boolean;
  /** Paths the app itself applied — never legitimate as the user's original. */
  applied?: string[];
}

const APPLIED_CAP = 100;

function norm(p: string): string {
  return path.resolve(p.replace(/^~/, process.env.HOME ?? p));
}

/** Directories of the active pack and every registered pack. */
function packDirs(): string[] {
  const cfg = getConfig();
  const dirs: string[] = [];
  const push = (raw: unknown): void => {
    if (typeof raw === "string" && raw) dirs.push(norm(raw));
  };
  push(cfg.packPath);
  if (Array.isArray(cfg.packFolders)) cfg.packFolders.forEach(push);
  return dirs;
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
      return migrateLegacyPoison(parsed as WallpaperState);
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

/**
 * One-time upgrade migration: builds before the applied set existed could
 * cache a pack wallpaper as the "original" (captured while a previous
 * session's pack wallpaper was still on screen). Such an original is app
 * output — drop it and seed the applied set with it so re-capture rejects
 * it too. Pack membership is checked against every registered pack folder,
 * not just the active one: the poison is often left by a different pack.
 */
function migrateLegacyPoison(state: WallpaperState): WallpaperState {
  if (state.applied) return state;
  invalidateConfigCache();
  const original = state.original ? norm(state.original) : "";
  const insidePack = original && packDirs().some((dir) => original.startsWith(dir + path.sep));
  if (insidePack) {
    logger.warn(
      `[Wallpaper] Legacy cached original is inside a pack (${original}); dropping it`
    );
    const migrated: WallpaperState = { original: "", dirty: false, applied: [original] };
    writeState(migrated);
    return migrated;
  }
  const migrated: WallpaperState = { ...state, applied: [] };
  writeState(migrated);
  return migrated;
}

/**
 * The panic wallpaper by its legacy name (the bundled default, a pack's
 * override, and the old Python app's copy are all `panic_wallpaper.*`).
 */
function isPanicArtifact(p: string): boolean {
  return /^panic_wallpaper\.[a-z0-9]+$/i.test(path.basename(p));
}

/** App output, not a user choice: a panic image or a path the app applied. */
function isAppArtifact(p: string, state: WallpaperState | null): boolean {
  if (isPanicArtifact(p)) return true;
  const n = norm(p);
  return (state?.applied ?? []).some((a) => norm(a) === n);
}

/** A cached original we may safely restore: real, and never app output. */
function usableOriginal(state: WallpaperState | null): boolean {
  return !!state?.original && !isAppArtifact(state.original, state);
}

/** Call before every wallpaper change the app itself causes. */
async function beforeWallpaperChange(): Promise<void> {
  if (disabled()) return;
  try {
    const existing = readState();
    if (existing && usableOriginal(existing)) {
      if (!existing.dirty) writeState({ ...existing, dirty: true });
      return;
    }
    if (existing?.original) {
      // A poisoned entry (app output captured as the original): drop it so
      // the re-capture below replaces it. Re-dirtying it would make every
      // later restore re-apply that image over the user's desktop.
      logger.warn(
        `[Wallpaper] Cached original is app output (${existing.original}); dropping it and re-capturing`
      );
    }
    const current = await getWallpaper();
    if (current && isAppArtifact(current, existing)) {
      // The desktop still shows something the app put there (a pack
      // wallpaper or panic image from an unrestored session): caching it as
      // the "original" would strand it through every future restore.
      logger.warn(
        `[Wallpaper] Current desktop is app-applied (${current}); not caching it as the original`
      );
      writeState({ original: "", dirty: false, applied: existing?.applied ?? [] });
      return;
    }
    if (current) {
      writeState({ original: current, dirty: true, applied: existing?.applied ?? [] });
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
export function applyWallpaper(filepath: string): Promise<void> {
  return serialize(async () => {
    const mem = !disabled();
    const alreadyDirty = mem && readState()?.dirty === true;
    await beforeWallpaperChange();
    if (mem) {
      // Whatever happens next, this path is app output from now on: record
      // it so no later capture mistakes it for the user's original.
      const state = readState() ?? { original: "", dirty: false };
      const n = norm(filepath);
      const applied = state.applied ?? [];
      if (!applied.some((a) => norm(a) === n)) {
        state.applied = [...applied, n].slice(-APPLIED_CAP);
        writeState(state);
      }
    }
    try {
      await setWallpaper(filepath);
    } catch (err) {
      if (mem && !alreadyDirty) {
        const state = readState();
        if (state?.dirty) writeState({ ...state, dirty: false });
      }
      throw err;
    }
  });
}

/**
 * All desktop mutations serialize through one queue: an apply racing a
 * restore could otherwise leave the pack wallpaper applied while the dirty
 * flag is already retired, stranding it past every future boot.
 */
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Restore the cached original when a previous change left it applied. */
export function restoreWallpaperIfDirty(): Promise<boolean> {
  return serialize(restoreNow);
}

async function restoreNow(): Promise<boolean> {
  if (disabled()) return false;
  const state = readState();
  if (!state?.dirty) return false;
  if (!state.original || isAppArtifact(state.original, state)) {
    // A poisoned or empty cache (the "original" was app output): restoring
    // it would re-apply a pack or panic wallpaper. Drop the original so the
    // next app change re-captures from the desktop; keep the applied set.
    logger.warn(
      `[Wallpaper] Cached original is unusable (${state.original || "empty"}); retiring the cache without restoring`
    );
    writeState({ original: "", dirty: false, applied: state.applied ?? [] });
    return false;
  }
  if (!fs.existsSync(state.original)) {
    logger.warn(`[Wallpaper] Cached original no longer exists: ${state.original}`);
    writeState({ original: "", dirty: false, applied: state.applied ?? [] });
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
