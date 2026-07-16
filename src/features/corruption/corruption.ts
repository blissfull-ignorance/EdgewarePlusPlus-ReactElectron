/**
 * Corruption runtime — pure functions for level progression, mood selection,
 * fade computation, and config overrides.
 *
 * All functions are pure and testable in isolation. Side effects (timer
 * management, store updates, wallpaper IPC) are handled by the corruption
 * store and App.tsx effects.
 *
 * FUTUREWORK: Port corruption danger check (warns when corruption full-perm
 * mode enables dangerous config keys — see corruption.py:corruption_danger_check).
 *
 * FUTUREWORK: Implement glitch and ramp fade types (currently only Normal
 * and Abrupt are implemented, matching the Python version).
 */

/** Per-level corruption data parsed from a pack's corruption.json. */
export interface CorruptionLevelData {
  addedMoods: string[]
  removedMoods: string[]
  wallpaper: string | null
  config: Record<string, string | number>
}

export interface PackAsset {
  path: string
  mood?: string
  type: 'image' | 'video' | 'audio' | 'hypno' | 'text'
}

/**
 * Filters media paths by active corruption moods.
 *
 * If activeMoods is empty, all media is eligible (no filtering).
 * If activeMoods has entries, only media whose mood tag is in activeMoods
 * (or has no mood tag) is included.
 *
 * @param media Array of media file paths.
 * @param activeMoods Currently active corruption moods.
 * @param moodLookup Map from file path to mood tag (from pack index).
 * @returns Filtered array of media paths eligible for spawning.
 */
export function filterMediaByMood(
  media: string[],
  activeMoods: string[],
  moodLookup: Map<string, string>,
): string[] {
  if (activeMoods.length === 0) return media
  return media.filter((p) => {
    const mood = moodLookup.get(p)
    return !mood || activeMoods.includes(mood)
  })
}

/** Config keys that corruption full-permission mode cannot override. */
export const CORRUPTION_BLOCK = new Set([
  'packPath', 'themeNoConfig', 'showLoadingFlair', 'runOnSaveQuit',
  'desktopIcons', 'safeMode', 'messageOff', 'globalPanicButton',
  'presetsDanger', 'corruptionMode', 'corruptionFullPerm', 'corruptionDevMode',
  'disabledMonitors', 'panicButton', 'panicDisabled',
  'start_on_logon', 'toggleHibSkip', 'toggleMoodSet', 'toggleInternet',
  'mpvSubprocess',
])

/**
 * Advances the corruption level based on elapsed time.
 *
 * @param level Current corruption level (0-indexed).
 * @param delta Time elapsed since last tick, in the same unit as rate.
 * @param rate Time interval for one level advance (in the same unit as delta).
 * @returns New corruption level, clamped to [level, level + 1].
 */
export function computeCorruptionTick(
  level: number,
  delta: number,
  rate: number,
): number {
  if (rate <= 0) return level
  return delta >= rate ? level + 1 : level
}

/**
 * Determines the next corruption level based on purity mode.
 *
 * In normal mode, the level increments. In purity mode, the level decrements
 * (the user starts corrupted and works toward purity).
 *
 * @param level Current level (1-indexed for Python compat).
 * @param maxLevel Maximum level index.
 * @param purity Whether purity mode is active.
 * @returns Next level, clamped to valid range.
 */
export function nextCorruptionLevel(
  level: number,
  maxLevel: number,
  purity: boolean,
): number {
  if (purity) {
    return level > 1 ? level - 1 : 1
  }
  return level < maxLevel ? level + 1 : maxLevel
}

/**
 * Computes cumulative mood changes for a given corruption level.
 *
 * Each level's add/remove lists are applied cumulatively — level 2 includes
 * both level 1 and level 2 mood changes. This matches the Python behavior
 * where pack.active_moods is progressively updated.
 *
 * @param levels Array of corruption level data, ordered by level.
 * @param level Current level (1-indexed).
 * @returns Cumulative added and removed moods.
 */
export function computeMoodChanges(
  levels: CorruptionLevelData[],
  level: number,
): { added: string[]; removed: string[] } {
  const added = new Set<string>()
  const removed = new Set<string>()
  for (let i = 0; i < Math.min(level, levels.length); i++) {
    for (const m of levels[i].addedMoods) added.add(m)
    for (const m of levels[i].removedMoods) removed.add(m)
  }
  return { added: [...added], removed: [...removed] }
}

/**
 * Resolves active moods by applying cumulative mood changes to a base set.
 *
 * @param baseMoods Initial mood set (e.g., from pack default moods).
 * @param levels Array of corruption level data.
 * @param level Current corruption level (1-indexed).
 * @returns Resolved active moods after applying all level changes.
 */
export function resolveActiveMoods(
  baseMoods: string[],
  levels: CorruptionLevelData[],
  level: number,
): string[] {
  const { added, removed } = computeMoodChanges(levels, level)
  const moodSet = new Set([...baseMoods, ...added])
  for (const m of removed) moodSet.delete(m)
  return [...moodSet]
}

/**
 * Computes a fade preview of moods from the next corruption level.
 *
 * If fadeType is "Abrupt", returns the current moods unchanged (no preview).
 * If fadeType is "Normal", merges next-level moods into current moods
 * (caller should use the returned set probabilistically based on fadeProgress).
 *
 * @param fadeType "Normal" or "Abrupt".
 * @param currentMoods Active moods at the current level.
 * @param nextLevelData Moods from the next corruption level.
 * @returns Moods including next-level additions (for Normal) or current moods only (for Abrupt).
 */
export function computeFadeMoods(
  fadeType: string,
  currentMoods: string[],
  nextLevelData: CorruptionLevelData | null,
): string[] {
  if (fadeType !== 'Normal' || !nextLevelData) return currentMoods
  const merged = new Set(currentMoods)
  for (const m of nextLevelData.addedMoods) merged.add(m)
  for (const m of nextLevelData.removedMoods) merged.delete(m)
  return [...merged]
}

/**
 * Returns the config overrides for a given corruption level.
 *
 * Merges config from all levels up to and including the target level,
 * respecting the CORRUPTION_BLOCK set.
 *
 * @param levels Array of corruption level data.
 * @param level Current corruption level (1-indexed).
 * @returns Merged config overrides (only non-blocked keys).
 */
export function getConfigOverrides(
  levels: CorruptionLevelData[],
  level: number,
): Record<string, string | number> {
  const overrides: Record<string, string | number> = {}
  for (let i = 0; i < Math.min(level, levels.length); i++) {
    for (const [key, value] of Object.entries(levels[i].config)) {
      if (!CORRUPTION_BLOCK.has(key)) {
        overrides[key] = value
      }
    }
  }
  return overrides
}

/**
 * Computes 0.0–1.0 progress toward the next corruption level.
 *
 * Formula varies by trigger type, matching the Python implementation.
 *
 * @param trigger "Timed", "Popup", "Launch", or "Script".
 * @param now Current timestamp in ms.
 * @param timeStart Timestamp when the current level started (ms, for Timed).
 * @param interval Time interval for one advance in ms (for Timed).
 * @param popupCount Closed popup count since last advance (for Popup).
 * @param popupThreshold Popup threshold for one advance (for Popup).
 * @param launchCount Launch count (for Launch).
 * @param launchThreshold Launch threshold per level (for Launch).
 * @param level Current corruption level (1-indexed, for Launch).
 * @returns Progress from 0.0 to 1.0 (clamped).
 */
export function computeCorruptionProgress(
  trigger: string,
  now: number,
  timeStart: number,
  interval: number,
  popupCount: number,
  popupThreshold: number,
  launchCount: number,
  launchThreshold: number,
  level: number,
): number {
  let progress = 0
  switch (trigger) {
    case 'Timed':
      progress = interval > 0 ? (now - timeStart) / interval : 0
      break
    case 'Popup':
      progress = popupThreshold > 0 ? popupCount / popupThreshold : 0
      break
    case 'Launch':
      progress = launchThreshold > 0
        ? launchCount / (launchThreshold * Math.max(1, level))
        : 0
      break
    case 'Script':
      progress = 0
      break
  }
  return Math.max(0, Math.min(1, progress))
}
