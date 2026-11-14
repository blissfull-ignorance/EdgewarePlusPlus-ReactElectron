/**
 * @file HibernateScheduler — pure scheduling for legacy hibernate mode
 * (legacy-python features/hibernate.py).
 *
 * Hibernate replaces the normal popup loop: sleep a random delay in
 * [hibernateMin, hibernateMax], fire a burst, repeat. A burst is a list of
 * tick delays; each tick rolls the popup targets exactly like a normal tick.
 * All randomness arrives through `rand` so the schedules are deterministic
 * under test; hostile settings are clamped so a burst can never allocate an
 * unbounded timer array.
 */

export type BurstType = "Original" | "Spaced" | "Glitch" | "Ramp" | "Pump-Scare" | "Chaos";

/** Hostile wakeupActivity guard: a burst never queues more ticks than this. */
export const MAX_BURST_POPUPS = 1000;
/** Hostile hibernateLength guard: one hour of burst at most. */
export const MAX_BURST_DURATION_MS = 3_600_000;
/** Same floor the roll loop uses for a hand-edited delay. */
export const MIN_TICK_DELAY_MS = 100;

const CHAOS_TYPES: BurstType[] = ["Original", "Spaced", "Glitch", "Ramp", "Pump-Scare"];

export interface BurstPlan {
  /** Chaos is resolved to the concrete type that will run. */
  type: BurstType;
  isPumpScare: boolean;
  /**
   * Delay before each tick; the first entry is the delay before the first
   * spawn (0 = immediate). Sum ≈ the burst's wall-clock length.
   */
  intervalsMs: number[];
}

export interface BurstPlanOptions {
  type: BurstType;
  wakeupActivity: number;
  hibernateLengthMs: number;
  popupDelayMs: number;
  rand: () => number;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Legacy `random.randint(a, b)` — inclusive on both ends. */
function randInt(rand: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rand() * (max - min + 1));
}

export function resolveBurstType(type: BurstType, rand: () => number): BurstType {
  if (type !== "Chaos") return type;
  return CHAOS_TYPES[Math.min(CHAOS_TYPES.length - 1, Math.floor(rand() * CHAOS_TYPES.length))];
}

/**
 * Delay in ms until the next burst: randint(min, max), tolerant of a hostile
 * or inverted range (min > max collapses to min).
 */
export function computeNextHibernateDelay(
  min: number,
  max: number,
  rand: () => number
): number {
  const lo = clampInt(min, 0, MAX_BURST_DURATION_MS, 0);
  const hi = clampInt(max, 0, MAX_BURST_DURATION_MS, 0);
  if (hi <= lo) return lo;
  return randInt(rand, lo, hi);
}

/**
 * Plan one burst. Tick counts and gaps follow the legacy per-type loops:
 * - Original: randint(activity/2, activity) immediate ticks.
 * - Spaced: a tick every popup delay for hibernateLength (delay-driven).
 * - Glitch: `activity` ticks; gap = choice([0, base, base/m, base*m]).
 * - Ramp: `activity` ticks accelerating from length/4 gaps toward delay*0.9.
 * - Pump-Scare: a single tick (the caller spawns one image + one audio).
 */
export function planBurst({
  type,
  wakeupActivity,
  hibernateLengthMs,
  popupDelayMs,
  rand,
}: BurstPlanOptions): BurstPlan {
  const resolved = resolveBurstType(type, rand);
  const activity = clampInt(wakeupActivity, 1, MAX_BURST_POPUPS, 20);
  const length = clampInt(hibernateLengthMs, 0, MAX_BURST_DURATION_MS, 15000);
  const delay = clampInt(popupDelayMs, MIN_TICK_DELAY_MS, MAX_BURST_DURATION_MS, 5000);

  if (resolved === "Pump-Scare") {
    return { type: resolved, isPumpScare: true, intervalsMs: [0] };
  }

  if (resolved === "Original") {
    const count = randInt(rand, Math.floor(activity / 2), activity);
    return { type: resolved, isPumpScare: false, intervalsMs: Array.from({ length: count }, () => 0) };
  }

  if (resolved === "Spaced") {
    const count = Math.max(1, Math.floor(length / delay));
    const intervals = [0];
    for (let i = 1; i < count; i++) intervals.push(delay);
    return { type: resolved, isPumpScare: false, intervalsMs: intervals };
  }

  if (resolved === "Glitch") {
    const base = Math.max(1, Math.floor(length / activity));
    const intervals = [0];
    for (let i = 1; i < activity; i++) {
      const modifier = randInt(rand, 2, 4);
      const choices = [0, base, Math.floor(base / modifier), base * modifier];
      intervals.push(choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))]);
    }
    return { type: resolved, isPumpScare: false, intervalsMs: intervals };
  }

  // Ramp: legacy loop — gap starts at length/4 and shrinks by an accelerating
  // divisor; once under 100 ms the cadence locks to delay*0.9.
  const intervals = [0];
  let delayModifier = Math.max(1, Math.floor(length / 4));
  let accelerate = 1;
  let elapsed = 0;
  let halfway = false;
  for (let i = 1; i < activity; i++) {
    if (!halfway && elapsed >= length / 2) halfway = true;
    let gap: number;
    if (delayModifier < 100) {
      gap = Math.floor(delay * 0.9);
    } else {
      accelerate *= halfway ? 1.05 : 1.1;
      delayModifier = delayModifier / accelerate;
      gap = Math.round(delay + delayModifier);
    }
    intervals.push(gap);
    elapsed += gap;
  }
  return { type: resolved, isPumpScare: false, intervalsMs: intervals };
}
