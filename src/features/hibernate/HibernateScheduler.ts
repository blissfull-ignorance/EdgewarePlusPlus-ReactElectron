export type BurstType = "Original" | "Spaced" | "Glitch" | "Ramp" | "Pump-Scare" | "Chaos";

export interface BurstScheduleOptions {
  type: BurstType;
  numPopups: number;
  burstDuration: number;
  seed: number;
}

export interface BurstSchedule {
  intervals: number[];
  selectedType: BurstType;
  isPumpScare: boolean;
}

const CHAOS_TYPES: BurstType[] = ["Spaced", "Glitch", "Ramp", "Pump-Scare"];

/**
 * Simple deterministic random number generator (Mulberry32).
 * Returns values in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Spaced: distribute N popups evenly over burstDuration.
 * Returns array of intervals between each popup.
 */
export function computeSpacedIntervals(numPopups: number, burstDuration: number, _seed: number): number[] {
  if (numPopups === 0) return [];
  const interval = burstDuration / numPopups;
  return Array.from({ length: numPopups }, () => interval);
}

/**
 * Glitch: distribute N popups at random intervals over burstDuration.
 * Uses random break points summed to total duration.
 */
export function computeGlitchIntervals(numPopups: number, burstDuration: number, seed: number): number[] {
  if (numPopups === 0) return [];
  if (numPopups === 1) return [burstDuration];

  const rand = mulberry32(seed);
  const breakpoints: number[] = [];
  for (let i = 0; i < numPopups - 1; i++) {
    breakpoints.push(rand() * burstDuration);
  }
  breakpoints.sort((a, b) => a - b);

  const intervals: number[] = [];
  let prev = 0;
  for (const bp of breakpoints) {
    intervals.push(bp - prev);
    prev = bp;
  }
  intervals.push(burstDuration - prev);

  return intervals;
}

/**
 * Ramp: accelerating frequency — early intervals are long, later intervals are short.
 * Uses exponential decay: interval[i] proportional to (1 - i/(N-1))^2
 */
export function computeRampIntervals(numPopups: number, burstDuration: number, _seed: number): number[] {
  if (numPopups === 0) return [];
  if (numPopups === 1) return [burstDuration];

  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < numPopups; i++) {
    const progress = i / (numPopups - 1);
    const weight = Math.pow(1 - progress, 2);
    weights.push(weight);
    weightSum += weight;
  }

  return weights.map((w) => (w / weightSum) * burstDuration);
}

/**
 * Pump-Scare: very brief intervals — popup flashes on then off immediately.
 * Intervals are tiny fractions of the burst duration (simulating rapid on/off).
 */
export function computePumpScareIntervals(numPopups: number, burstDuration: number, _seed: number): number[] {
  if (numPopups === 0) return [];
  const interval = burstDuration / numPopups;
  return Array.from({ length: numPopups }, () => Math.max(50, interval * 0.05));
}

/**
 * Original: instant barrage — all popups fire at once (0ms intervals).
 */
function computeOriginalIntervals(numPopups: number): number[] {
  return Array.from({ length: numPopups }, () => 0);
}

/**
 * Select a random burst type for Chaos mode.
 */
export function selectChaosType(seed: number): BurstType {
  const idx = seed % CHAOS_TYPES.length;
  return CHAOS_TYPES[Math.abs(idx)];
}

/**
 * Compute the full burst schedule based on type.
 */
export function computeBurstSchedule({ type, numPopups, burstDuration, seed }: BurstScheduleOptions): BurstSchedule {
  let resolvedType = type;
  if (type === "Chaos") {
    resolvedType = selectChaosType(seed);
  }

  let intervals: number[];
  let isPumpScare = false;

  switch (resolvedType) {
    case "Original":
      intervals = computeOriginalIntervals(numPopups);
      break;
    case "Spaced":
      intervals = computeSpacedIntervals(numPopups, burstDuration, seed);
      break;
    case "Glitch":
      intervals = computeGlitchIntervals(numPopups, burstDuration, seed);
      break;
    case "Ramp":
      intervals = computeRampIntervals(numPopups, burstDuration, seed);
      break;
    case "Pump-Scare":
      intervals = computePumpScareIntervals(numPopups, burstDuration, seed);
      isPumpScare = true;
      break;
    default:
      intervals = computeOriginalIntervals(numPopups);
  }

  return {
    intervals,
    selectedType: resolvedType,
    isPumpScare,
  };
}

/**
 * Compute the delay (in ms) until the next hibernate burst.
 * Returns a random value between min and max (inclusive).
 */
export function computeNextHibernateDelay(min: number, max: number, seed: number): number {
  if (min === max) return min;
  const rand = mulberry32(seed);
  return Math.floor(min + rand() * (max - min));
}
