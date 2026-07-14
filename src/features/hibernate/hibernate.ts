/**
 * Hibernate runtime — pure functions for delay computation, activity scheduling,
 * type-specific spawn patterns, and wallpaper reset logic.
 */

/** All supported hibernate activity types. */
export type HibernateType = 'Original' | 'Spaced' | 'Glitch' | 'Ramp' | 'Pump-Scare' | 'Chaos'

/** A single scheduled spawn tick within a hibernate activity window. */
export interface ActivityTick {
  /** Milliseconds after activity start when this tick fires. */
  delay: number
  /** Number of popups to spawn at this tick. */
  count: number
}

/**
 * Returns a random integer between min and max (inclusive).
 * Used as a local utility to keep hibernate.ts self-contained.
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Picks a random element from an array.
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Computes a random sleep duration in milliseconds between hibernateMin
 * and hibernateMax seconds (converted to ms).
 *
 * @param min Minimum sleep duration in seconds.
 * @param max Maximum sleep duration in seconds.
 * @returns Sleep duration in milliseconds.
 */
export function hibernateDelay(min: number, max: number): number {
  const safeMin = Math.max(0, min)
  const safeMax = Math.max(safeMin, max)
  return randInt(safeMin, safeMax) * 1000
}

/**
 * Generates a schedule of activity ticks for a given hibernate type.
 *
 * Each tick specifies a delay (ms from activity start) and a spawn count.
 * The caller (App.tsx) schedules setTimeout calls based on these ticks.
 *
 * @param type The hibernate activity type.
 * @param hibernateLength Duration of the hibernate activity window in seconds.
 * @param wakeupActivity Number of "wakeup" items — exact meaning depends on type.
 * @returns Array of scheduled activity ticks.
 *
 * Type behaviors:
 *   - Original: Burst of random(wakeupActivity/2, wakeupActivity) rapid spawns,
 *     all within the first 3 seconds.
 *   - Spaced: Spawn at fixed intervals for hibernateLength seconds.
 *   - Glitch: Spawn at randomized intervals (0, base, base/modifier, base*modifier).
 *   - Ramp: Accelerating frequency — slow start ramping up past halfway.
 *   - Pump-Scare: Single tick at delay 0 with count 1 (handled by caller as
 *     image+audio pair). After this tick, no more activity.
 *   - Chaos: Randomly selects one of the other 5 types and delegates to it.
 *
 * FUTUREWORK: The Python version uses roll_targets() to randomly select which
 * popup windows to target (e.g., only popups in certain screen regions).
 * Current TS version spawns popups at random positions without targeting.
 *
 * FUTUREWORK: The Python Spaced type uses a frequency parameter that controls
 * the interval between spawns differently. Current TS implementation divides
 * hibernateLength by wakeupActivity to compute interval, which may not match
 * the original behavior for all parameter combinations.
 *
 * FUTUREWORK: The Python version uses OS-level sleep() for delays. This TS
 * version schedules ticks via setTimeout, which is non-blocking and allows
 * the UI to remain responsive during hibernate activity.
 */
export function planActivity(
  type: HibernateType,
  hibernateLength: number,
  wakeupActivity: number,
): ActivityTick[] {
  switch (type) {
    case 'Original': {
      const totalSpawns = randInt(Math.max(1, Math.floor(wakeupActivity / 2)), Math.max(1, wakeupActivity))
      return [...Array(totalSpawns)].map(() => ({
        delay: randInt(0, 3000),
        count: 1,
      }))
    }

    case 'Spaced': {
      const intervalMs = Math.max(50, (hibernateLength * 1000) / Math.max(1, wakeupActivity))
      const ticks: ActivityTick[] = []
      for (let i = 0; i < wakeupActivity; i++) {
        ticks.push({ delay: Math.round(i * intervalMs), count: 1 })
      }
      return ticks
    }

    case 'Glitch': {
      const baseMs = Math.max(100, (hibernateLength * 1000) / Math.max(1, wakeupActivity))
      const modifier = 0.5 + Math.random() * 1.5
      const variants = [0, baseMs, Math.round(baseMs / modifier), Math.round(baseMs * modifier)]
      const ticks: ActivityTick[] = []
      let elapsed = 0
      const limit = hibernateLength * 1000
      while (elapsed < limit && ticks.length < wakeupActivity * 2) {
        const delay = Math.round(pick(variants))
        ticks.push({ delay, count: 1 })
        elapsed += delay
      }
      return ticks
    }

    case 'Ramp': {
      const totalMs = hibernateLength * 1000
      const totalSpawns = wakeupActivity
      const ticks: ActivityTick[] = []
      for (let i = 0; i < totalSpawns; i++) {
        const progress = i / Math.max(1, totalSpawns - 1)
        const eased = progress * progress
        const delay = Math.round(eased * totalMs)
        ticks.push({ delay, count: 1 })
      }
      return ticks
    }

    case 'Pump-Scare': {
      return [{ delay: 0, count: 1 }]
    }

    case 'Chaos': {
      const subTypes: HibernateType[] = ['Original', 'Spaced', 'Glitch', 'Ramp', 'Pump-Scare']
      return planActivity(pick(subTypes), hibernateLength, wakeupActivity)
    }
  }
}

/**
 * Returns true if hibernate mode is enabled.
 *
 * @param hibernateMode The config value for hibernateMode.
 */
export function isHibernating(hibernateMode: boolean): boolean {
  return hibernateMode
}

/**
 * Determines whether the wallpaper should be restored after hibernate ends.
 *
 * @param fixWallpaper Config value — if false, never reset.
 * @param popupCount Number of active popups (0 = all closed).
 * @param active Whether hibernate mode is currently active.
 * @returns True if wallpaper should be restored.
 */
export function shouldResetWallpaper(
  fixWallpaper: boolean,
  popupCount: number,
  active: boolean,
): boolean {
  if (!fixWallpaper) return false
  if (active) return false
  return popupCount === 0
}
