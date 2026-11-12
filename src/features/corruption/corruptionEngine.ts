/**
 * Corruption (Guided Mode) engine — pure logic for parsing corruption.json,
 * computing level transitions, and managing active moods.
 *
 * This module contains no React hooks, no Electron imports, no side effects.
 * It is fully testable in isolation with Vitest.
 */

import { MoodSet } from "../../types/pack";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Raw JSON structure of a single corruption level from corruption.json.
 * Matches the legacy pack/data.py CorruptionLevel structure.
 */
export interface RawCorruptionLevel {
  add: string[];
  remove: string[];
  wallpaper?: string | null;
  config?: Record<string, string | number>;
}

/**
 * Parsed corruption level with resolved MoodSet instances.
 */
export interface ParsedCorruptionLevel {
  level: number;
  addMoods: MoodSet;
  removeMoods: MoodSet;
  wallpaper: string | null;
  config: Record<string, string | number>;
}

/**
 * Complete parsed corruption.json structure.
 */
export interface ParsedCorruptionData {
  levels: Record<number, ParsedCorruptionLevel>;
}

/**
 * Config keys that are blocked from corruption-level modification
 * (corresponds to block=True/block=BROKEN in legacy config/items.py).
 * `startOnLogon` is included for both spellings: the legacy item registry
 * stores the config.json key as "start_on_logon".
 */
const BLOCKED_CONFIG_KEYS = new Set([
  "avoidList",
  "corruptionDevMode",
  "corruptionFullPerm",
  "corruptionMode",
  "desktopIcons",
  "disabledMonitors",
  "drivePath",
  "globalPanicButton",
  "hibernateMode",
  "messageOff",
  "mitosisMode",
  "mpvSubprocess",
  "panicButton",
  "presetsDanger",
  "replace",
  "replaceThresh",
  "rotateWallpaper",
  "runOnSaveQuit",
  "safeMode",
  "safeword",
  "showDiscord",
  "showLoadingFlair",
  "start_on_logon",
  "startOnLogon",
  "themeNoConfig",
  "timerMode",
  "timerSetupTime",
  "toggleHibSkip",
  "toggleInternet",
  "toggleMoodSet",
]);

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Parse a raw corruption.json object into ParsedCorruptionData.
 * Handles both the legacy format (moods + config objects keyed by level number)
 * and gracefully degrades on missing fields.
 */
export function parseCorruptionData(
  rawData: Record<string, unknown>
): ParsedCorruptionData {
  const levels: Record<number, ParsedCorruptionLevel> = {};

  const moodsRaw = rawData.moods as Record<string, Record<string, unknown>> | undefined;
  const configRaw = rawData.config as Record<string, Record<string, unknown>> | undefined;
  // Legacy packs carry wallpapers as a separate top-level map keyed by level
  // number, with an optional "default" entry applied at level 1 (pack/load.py).
  const wallpapersRaw = rawData.wallpapers as Record<string, unknown> | undefined;
  const legacyWallpaper = (level: number): string | null => {
    if (!wallpapersRaw || typeof wallpapersRaw !== "object") return null;
    const own = wallpapersRaw[String(level)];
    if (typeof own === "string" && own) return own;
    if (level === 1 && typeof wallpapersRaw["default"] === "string" && wallpapersRaw["default"]) {
      return wallpapersRaw["default"] as string;
    }
    return null;
  };

  if (moodsRaw) {
    for (const [levelStr, levelData] of Object.entries(moodsRaw)) {
      const level = parseInt(levelStr, 10);
      if (isNaN(level)) continue;

      const addMoods = new MoodSet(
        (levelData.add as string[] | undefined) ?? []
      );
      const removeMoods = new MoodSet(
        (levelData.remove as string[] | undefined) ?? []
      );
      const wallpaper =
        (typeof levelData.wallpaper === "string" && levelData.wallpaper
          ? (levelData.wallpaper as string)
          : null) ?? legacyWallpaper(level);

      const levelConfig: Record<string, string | number> = {};
      if (configRaw && configRaw[levelStr]) {
        const rawConfig = configRaw[levelStr];
        for (const [key, value] of Object.entries(rawConfig)) {
          if (!BLOCKED_CONFIG_KEYS.has(key)) {
            levelConfig[key] = value as string | number;
          }
        }
      }

      levels[level] = { level, addMoods, removeMoods, wallpaper, config: levelConfig };
    }
  }

  // Levels that exist only to change the wallpaper (legacy counted the
  // wallpapers map into the level list as well).
  if (wallpapersRaw && typeof wallpapersRaw === "object") {
    for (const [levelStr, file] of Object.entries(wallpapersRaw)) {
      const level = parseInt(levelStr, 10);
      if (isNaN(level) || level < 1 || level in levels) continue;
      if (typeof file !== "string" || !file) continue;
      levels[level] = {
        level,
        addMoods: new MoodSet(),
        removeMoods: new MoodSet(),
        wallpaper: file,
        config: {},
      };
    }
  }

  if (configRaw) {
    for (const [levelStr, rawConfig] of Object.entries(configRaw)) {
      const level = parseInt(levelStr, 10);
      if (isNaN(level)) continue;

      const levelConfig: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(rawConfig)) {
        if (!BLOCKED_CONFIG_KEYS.has(key)) {
          levelConfig[key] = value as string | number;
        }
      }

      if (!(level in levels)) {
        levels[level] = {
          level,
          addMoods: new MoodSet(),
          removeMoods: new MoodSet(),
          wallpaper: legacyWallpaper(level),
          config: levelConfig,
        };
      } else {
        for (const [key, value] of Object.entries(levelConfig)) {
          levels[level].config[key] = value;
        }
      }
    }
  }

  return { levels };
}

// ── Transition Logic ─────────────────────────────────────────────────────────

/**
 * Compute the resulting active moods after transitioning to a given level.
 * Moods removed by the level are deleted; moods added are inserted.
 * Returns a new array (does not mutate the input).
 */
export function computeActiveMoods(
  currentMoods: string[],
  levelData: ParsedCorruptionLevel
): string[] {
  const moodSet = new Set(currentMoods);
  for (const mood of levelData.removeMoods) {
    moodSet.delete(mood);
  }
  for (const mood of levelData.addMoods) {
    moodSet.add(mood);
  }
  return [...moodSet];
}

/**
 * Compute config overrides to apply when transitioning to a level.
 * Only includes keys that are NOT in the blocked set.
 */
export function computeConfigOverrides(
  levelData: ParsedCorruptionLevel
): Record<string, string | number> {
  return { ...levelData.config };
}

/**
 * Get the next level number from the available levels, starting after `currentLevel`.
 * Returns null if there are no more levels.
 */
export function getNextLevel(
  levels: Record<number, ParsedCorruptionLevel>,
  currentLevel: number
): number | null {
  const sortedLevels = Object.keys(levels)
    .map(Number)
    .sort((a, b) => a - b);

  const currentIndex = sortedLevels.indexOf(currentLevel);
  if (currentIndex < 0 || currentIndex >= sortedLevels.length - 1) {
    return null;
  }
  return sortedLevels[currentIndex + 1];
}

/**
 * Get all available level numbers in ascending order.
 */
export function getAvailableLevels(
  levels: Record<number, ParsedCorruptionLevel>
): number[] {
  return Object.keys(levels)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Check if a config key is blocked from corruption modification.
 */
export function isConfigBlocked(key: string): boolean {
  return BLOCKED_CONFIG_KEYS.has(key);
}
