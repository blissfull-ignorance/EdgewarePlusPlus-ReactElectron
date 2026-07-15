/**
 * Wallpaper rotation — pure functions for timer-based wallpaper cycling.
 *
 * Provides next-index computation and interval scheduling with random variance.
 * All functions are pure and side-effect-free for testability.
 */

export interface RotationState {
  currentIndex: number
  enabled: boolean
  interval: number
  variance: number
}

export interface RotationSchedule {
  nextIndex: number
  intervalMs: number
}

/**
 * Returns the next wallpaper index, wrapping around the list length.
 *
 * @param currentIndex Current position in the wallpaper list (0-indexed).
 * @param listLength Total number of wallpapers in the pack.
 * @returns The next index, wrapping to 0 at the end.
 */
export function nextWallpaperIndex(currentIndex: number, listLength: number): number {
  if (listLength <= 0) return 0
  return (currentIndex + 1) % listLength
}

/**
 * Computes a random interval in milliseconds based on the base interval
 * and variance. The result is clamped to a minimum of 1000ms.
 *
 * @param interval Base interval in seconds.
 * @param variance Random variance in seconds (±variance applied to interval).
 * @returns Interval in milliseconds.
 */
export function computeInterval(interval: number, variance: number): number {
  const safeBase = Math.max(1, interval)
  const safeVariance = Math.max(0, variance)
  const offset = safeVariance > 0
    ? (Math.random() * 2 - 1) * safeVariance
    : 0
  const result = Math.round((safeBase + offset) * 1000)
  return Math.max(1000, result)
}

/**
 * Determines whether wallpaper rotation should be active.
 *
 * @param enabled The rotateWallpaper config toggle.
 * @param wallpaperCount Number of wallpapers in the pack.
 * @returns True if rotation should run.
 */
export function shouldRotate(enabled: boolean, wallpaperCount: number): boolean {
  return enabled && wallpaperCount > 1
}

/**
 * Computes the next rotation schedule given the current state.
 *
 * @param state Current rotation state.
 * @param wallpaperCount Number of wallpapers in the pack.
 * @returns The next index and interval in milliseconds, or null if rotation is disabled.
 */
export function computeRotation(
  state: RotationState,
  wallpaperCount: number,
): RotationSchedule | null {
  if (!shouldRotate(state.enabled, wallpaperCount)) return null
  return {
    nextIndex: nextWallpaperIndex(state.currentIndex, wallpaperCount),
    intervalMs: computeInterval(state.interval, state.variance),
  }
}
