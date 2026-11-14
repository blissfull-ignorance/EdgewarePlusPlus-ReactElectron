/**
 * @file HibernateScheduler — pure scheduling for legacy hibernate mode
 * (legacy-python features/hibernate.py).
 *
 * Hibernate replaces the normal popup loop: sleep a random delay in
 * [hibernateMin, hibernateMax], fire a burst, repeat. A burst is a list of
 * tick times; each tick rolls the popup targets exactly like a normal tick.
 * Spaced, Glitch and Ramp run inside the legacy `activity_loop` window: the
 * burst lasts exactly `hibernateLength` ms and ticks stop when the window
 * closes, however many or few they managed to fire. All randomness arrives
 * through `rand` so schedules are deterministic under test; hostile settings
 * are clamped so a burst can never allocate an unbounded timer array.
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
   * spawn (0 = immediate).
   */
  intervalsMs: number[];
  /**
   * When the burst ends and the next sleep re-arms: the activity-loop window
   * for Spaced/Glitch/Ramp, the last tick for instant bursts.
   */
  durationMs: number;
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

/** Convert absolute tick times into consecutive delays. */
function toIntervals(times: number[]): number[] {
  return times.map((t, i) => (i === 0 ? t : Math.max(0, t - times[i - 1])));
}

/**
 * Plan one burst. Tick times follow the legacy per-type loops:
 * - Original: randint(activity/2, activity) immediate ticks.
 * - Spaced: a tick every popup delay while inside the window (delay-driven,
 *   wakeupActivity is ignored — legacy `spaced`).
 * - Glitch: up to `activity` ticks; gap = choice([0, base, base/m, base*m]).
 * - Ramp: up to `activity` LOCKED-phase ticks (the accelerating phase is
 *   uncounted, legacy `ramp`); gaps shrink from length/4 toward the
 *   delay*0.9 cadence.
 * - Pump-Scare: a single tick (the caller spawns one image + one audio).
 * Spaced/Glitch/Ramp stop when the length window closes.
 */
export function planBurst({
  type,
  wakeupActivity,
  hibernateLengthMs,
  popupDelayMs,
  rand,
}: BurstPlanOptions): BurstPlan {
  const resolved = resolveBurstType(type, rand);
  const activity = clampInt(wakeupActivity, 0, MAX_BURST_POPUPS, 20);
  const length = clampInt(hibernateLengthMs, 0, MAX_BURST_DURATION_MS, 15000);
  const delay = clampInt(popupDelayMs, MIN_TICK_DELAY_MS, MAX_BURST_DURATION_MS, 5000);

  if (resolved === "Pump-Scare") {
    return { type: resolved, isPumpScare: true, intervalsMs: [0], durationMs: 0 };
  }

  if (resolved === "Original") {
    const count = randInt(rand, Math.floor(activity / 2), activity);
    return {
      type: resolved,
      isPumpScare: false,
      intervalsMs: Array.from({ length: count }, () => 0),
      durationMs: 0,
    };
  }

  if (resolved === "Spaced") {
    // Legacy rolls the first tick immediately, then every `delay` while the
    // window is open; the window close (at `length`) ends the burst.
    const times = [0];
    for (let t = delay; t < length; t += delay) times.push(t);
    return {
      type: resolved,
      isPumpScare: false,
      intervalsMs: toIntervals(times),
      durationMs: length,
    };
  }

  if (resolved === "Glitch") {
    const times: number[] = [];
    let t = 0;
    for (let n = 0; n < activity && (times.length === 0 || t < length); n++) {
      times.push(t);
      const base = Math.max(1, Math.floor(length / activity));
      const modifier = randInt(rand, 2, 4);
      const choices = [0, base, Math.floor(base / modifier), base * modifier];
      t += choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
    }
    return {
      type: resolved,
      isPumpScare: false,
      intervalsMs: toIntervals(times),
      durationMs: length,
    };
  }

  // Ramp: the gap starts at length/4 and an accelerating divisor shrinks it;
  // once under 100 ms the cadence locks to delay*0.9 and only those locked
  // ticks count toward the activity budget (legacy increments n solely in
  // the locked branch).
  const times: number[] = [];
  let t = 0;
  let locked = 0;
  let modifier = Math.floor(length / 4);
  let accelerate = 1;
  while (locked < activity && (times.length === 0 || t < length)) {
    times.push(t);
    if (modifier < 100) {
      locked += 1;
      t += Math.floor(delay * 0.9);
    } else {
      accelerate *= t >= length / 2 ? 1.05 : 1.1;
      modifier = modifier / accelerate;
      t += Math.floor(delay + modifier);
    }
  }
  return {
    type: resolved,
    isPumpScare: false,
    intervalsMs: toIntervals(times),
    durationMs: length,
  };
}
