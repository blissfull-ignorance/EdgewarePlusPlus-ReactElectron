/**
 * @file schedule — Pure timing for the in-app session scheduler.
 *
 * The legacy app registered the schedule with the OS task scheduler
 * (Windows only; the macOS/Linux ports left it inert). This port keeps the
 * same settings but runs the timer inside the app: after `scheduleTime`
 * (timeType units) plus an optional random delay up to `varianceTime`
 * (varianceType units), the runtime starts; with `repeatSchedule` on it
 * re-arms every `repeatTime` (repeatType units) while the app runs.
 */

export type TimeUnit = "Minutes" | "Hours" | "Days";

const UNIT_MS: Record<TimeUnit, number> = {
  Minutes: 60_000,
  Hours: 3_600_000,
  Days: 86_400_000,
};

export function unitToMs(value: number, unit: string): number {
  const ms = UNIT_MS[unit as TimeUnit];
  return (Number.isFinite(ms) ? ms : UNIT_MS.Minutes) * Math.max(0, value);
}

/** First fire: base delay plus jitter in [0, variance] (legacy: delay only). */
export function firstFireAt(
  now: number,
  scheduleTime: number,
  timeType: string,
  varianceTime: number,
  varianceType: string,
  rand: () => number = Math.random
): number {
  const base = unitToMs(scheduleTime, timeType);
  const jitter = unitToMs(varianceTime, varianceType) * rand();
  return now + Math.max(1000, Math.round(base + jitter));
}

/** Repeat interval; zero/negative disables repeating. */
export function repeatIntervalMs(
  repeatSchedule: number,
  repeatTime: number,
  repeatType: string
): number | null {
  if (repeatSchedule !== 1) return null;
  const ms = unitToMs(repeatTime, repeatType);
  return ms > 0 ? ms : null;
}
