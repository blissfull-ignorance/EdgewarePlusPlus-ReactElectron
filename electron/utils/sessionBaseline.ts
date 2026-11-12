/**
 * @file sessionBaseline — pack config overrides survive even a hard exit.
 *
 * Corruption levels mutate real settings for the session; the renderer
 * restores them on Stop. A quit, crash or panic skips that cleanup, so the
 * first mutation of a session also persists the pre-session values here, and
 * the next startup merges them back into config.json before any window
 * reads it. The file exists only while a session holds overrides.
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { logger } from "./logger";

function baselineFile(): string {
  return path.join(app.getPath("userData"), "data", "session_baseline.json");
}

function configFile(): string {
  return path.join(app.getPath("userData"), "data", "config.json");
}

/** The file only ever holds JSON round-trips of settings values. */
function isBaseline(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Record the pre-session values a running session can restore. */
export function persistSessionBaseline(value: unknown): boolean {
  if (!isBaseline(value)) return false;
  try {
    fs.mkdirSync(path.dirname(baselineFile()), { recursive: true });
    const existing = readSessionBaseline() ?? {};
    fs.writeFileSync(baselineFile(), JSON.stringify({ ...existing, ...value }), "utf-8");
    return true;
  } catch (err) {
    logger.error("[SessionBaseline] Persist failed:", err);
    return false;
  }
}

export function readSessionBaseline(): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(baselineFile(), "utf-8")) as unknown;
    return isBaseline(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Merge the persisted baseline into config.json and retire the file.
 * Returns the number of keys given back; 0 when nothing was pending.
 */
export function applyBaselineRevert(): number {
  const baseline = readSessionBaseline();
  if (!baseline) return 0;
  try {
    const file = configFile();
    const cfg = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>)
      : {};
    let restored = 0;
    for (const [key, value] of Object.entries(baseline)) {
      if (cfg[key] !== value) {
        cfg[key] = value;
        restored++;
      }
    }
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf-8");
    fs.renameSync(tmp, file);
    fs.rmSync(baselineFile(), { force: true });
    logger.info(`[SessionBaseline] Restored ${restored} pack-overridden setting(s) at startup`);
    return restored;
  } catch (err) {
    logger.error("[SessionBaseline] Startup revert failed:", err);
    return 0;
  }
}

/** Session ended cleanly: the renderer already restored; drop the file. */
export function clearSessionBaseline(): void {
  try {
    fs.rmSync(baselineFile(), { force: true });
  } catch (err) {
    logger.error("[SessionBaseline] Clear failed:", err);
  }
}
