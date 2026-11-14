/**
 * @file configCache — the main process's live view of the renderer's settings.
 *
 * The renderer owns config.json and flushes it on an autosave cadence, so a
 * bare file read shows main-side consumers (popup geometry) a stale picture
 * inside that window. The renderer pushes every settings change through
 * `system:pushSettings` and every save refreshes this cache, making main-side
 * reads immediate; the disk file remains the boot source before the first
 * push lands. Persistence stays entirely with the save paths.
 */

import fs from "fs";
import path from "path";
import { app } from "electron";

let cache: Record<string, unknown> | null = null;

function configPath(): string {
  return path.join(app.getPath("userData"), "data", "config.json");
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The current settings: pushed state, else the disk file, else null. */
export function loadConfigOrNull(): Record<string, unknown> | null {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(configPath(), "utf-8"));
    if (isSettingsObject(parsed)) cache = parsed;
  } catch {
    // Missing or corrupt config: readers fall back to their own defaults.
  }
  return cache;
}

export function getConfig(): Record<string, unknown> {
  return loadConfigOrNull() ?? {};
}

/** Numeric setting view used by popup geometry; absent or junk reads as 0. */
export function getSettingNumber(key: string): number {
  return Number(getConfig()[key]) || 0;
}

/** Replace the cached view with a freshly pushed or saved settings object. */
export function refreshConfig(settings: unknown): void {
  if (isSettingsObject(settings)) cache = settings;
}

/** Drop the cached view so the next read re-primes from disk. */
export function invalidateConfigCache(): void {
  cache = null;
}
