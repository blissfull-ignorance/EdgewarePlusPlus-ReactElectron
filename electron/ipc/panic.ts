/**
 * @file panic — The panic runtime: instant teardown of everything the app
 * shows, then quit.
 *
 * Panic sources: the global hotkey (`globalPanicButton`, Escape by default),
 * the tray's Panic entry, and the `panic:trigger` IPC. The hotkey path honors
 * `panicDisabled`; the tray path does not, so there is always a way out.
 * While a panic lockout (`timerMode`) is running, panic is gated behind the
 * safeword: blocked attempts notify the renderer so it can show the safeword
 * prompt, and `panic:unlock` completes the teardown on the correct word.
 *
 * Teardown order mirrors the legacy panic: set the panic wallpaper, close all
 * popup windows, quit. `EDGWARE_PANIC_SKIP_WALLPAPER=1` skips the wallpaper
 * step for automated tests (same spirit as `EDGWARE_NO_DEVTOOLS`).
 */
import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger";
import { toAccelerator } from "../utils/panicKeys";
import { isLockoutActive, safewordMatches } from "../utils/panicLockout";
import { destroyDiscord } from "./discord";
import { closeAllPopups } from "./popup";
import { setWallpaper } from "../utils/wallpaper";

export interface PanicResult {
  ok: boolean;
  reason?: "disabled" | "lockout";
}

export interface PanicStatus {
  lockoutActive: boolean;
  accelerator: string;
}

interface PanicConfig {
  panicDisabled: number;
  timerMode: number;
  timerSetupTime: number;
  safeword: string;
  globalPanicButton: string;
}

let lockoutUntil = 0;
let currentAccelerator = "Escape";

function dataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

function readPanicConfig(): PanicConfig {
  const fallback: PanicConfig = {
    panicDisabled: 0,
    timerMode: 0,
    timerSetupTime: 1,
    safeword: "password",
    globalPanicButton: "Key.esc",
  };
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dataDir(), "config.json"), "utf-8")) as Record<string, unknown>;
    return {
      panicDisabled: Number(parsed.panicDisabled ?? fallback.panicDisabled),
      timerMode: Number(parsed.timerMode ?? fallback.timerMode),
      timerSetupTime: Number(parsed.timerSetupTime ?? fallback.timerSetupTime),
      safeword: String(parsed.safeword ?? fallback.safeword),
      globalPanicButton: String(parsed.globalPanicButton ?? fallback.globalPanicButton),
    };
  } catch {
    return fallback;
  }
}

function lockoutActive(): boolean {
  const cfg = readPanicConfig();
  return isLockoutActive({ enabled: cfg.timerMode === 1, until: lockoutUntil, now: Date.now() });
}

function panicWallpaperPath(): string {
  return path.join(app.getAppPath(), "dist", "panic_wallpaper.jpg");
}

async function doPanic(): Promise<void> {
  if (process.env.EDGWARE_PANIC_SKIP_WALLPAPER !== "1") {
    const wallpaper = panicWallpaperPath();
    if (fs.existsSync(wallpaper)) {
      try {
        await setWallpaper(wallpaper);
      } catch (err) {
        logger.error("[Panic] Failed to set panic wallpaper:", err);
      }
    } else {
      logger.error(`[Panic] Panic wallpaper asset missing: ${wallpaper}`);
    }
  }
  closeAllPopups();
  globalShortcut.unregisterAll();
  // Hard exit: the runtime keeps spawning popups until the process dies, and
  // a graceful quit can be held open by a window created mid-teardown. The
  // legacy panic destroys the Tk root outright — same certainty here.
  app.exit(0);
}

function trigger(opts: { respectDisabled?: boolean } = {}): PanicResult {
  const respectDisabled = opts.respectDisabled !== false;
  const cfg = readPanicConfig();

  if (respectDisabled && cfg.panicDisabled === 1) {
    logger.info("[Panic] Blocked by panicDisabled setting");
    return { ok: false, reason: "disabled" };
  }
  if (lockoutActive()) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send("panic:blocked");
    }
    return { ok: false, reason: "lockout" };
  }
  // Defer teardown briefly so the IPC reply reaches the renderer before the
  // app hard-exits (app.exit does not wait for socket flush).
  setTimeout(() => void doPanic(), 50);
  return { ok: true };
}

function registerShortcut(): void {
  const cfg = readPanicConfig();
  const next = toAccelerator(cfg.globalPanicButton);
  if (next === currentAccelerator && globalShortcut.isRegistered(next)) return;
  globalShortcut.unregisterAll();
  currentAccelerator = next;
  try {
    const ok = globalShortcut.register(next, () => {
      trigger();
    });
    if (!ok) logger.error(`[Panic] Could not register global shortcut "${next}"`);
  } catch (err) {
    logger.error(`[Panic] Failed to register global shortcut "${next}":`, err);
  }
}

function registerHandlers(): void {
  const cfg = readPanicConfig();
  if (cfg.timerMode === 1 && cfg.timerSetupTime > 0) {
    lockoutUntil = Date.now() + cfg.timerSetupTime * 60 * 1000;
    logger.info(`[Panic] Lockout active until ${new Date(lockoutUntil).toISOString()}`);
  }
  registerShortcut();

  ipcMain.handle("panic:trigger", (_event, opts?: { respectDisabled?: boolean }): PanicResult =>
    trigger(opts ?? {})
  );

  ipcMain.handle("panic:status", (): PanicStatus => ({
    lockoutActive: lockoutActive(),
    accelerator: currentAccelerator,
  }));

  ipcMain.handle("panic:unlock", (_event, password: string): PanicResult => {
    const cfg = readPanicConfig();
    if (!lockoutActive()) return { ok: true };
    if (!safewordMatches(String(password ?? ""), cfg.safeword)) {
      logger.info("[Panic] Wrong safeword");
      return { ok: false };
    }
    lockoutUntil = 0;
    setTimeout(() => void doPanic(), 50);
    return { ok: true };
  });

  ipcMain.handle("panic:refreshShortcut", (): PanicStatus => {
    registerShortcut();
    return { lockoutActive: lockoutActive(), accelerator: currentAccelerator };
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    destroyDiscord();
  });
}

/** Forced panic for the tray: always available, even with panicDisabled set. */
function panicFromTray(): PanicResult {
  return trigger({ respectDisabled: false });
}

export { registerHandlers, panicFromTray };
