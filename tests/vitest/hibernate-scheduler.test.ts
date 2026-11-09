import { describe, expect, it } from "vitest";
import {
  computeBurstSchedule,
  computeSpacedIntervals,
  computeGlitchIntervals,
  computeRampIntervals,
  computePumpScareIntervals,
  selectChaosType,
  computeNextHibernateDelay,
} from "../../src/features/hibernate/HibernateScheduler";

describe("computeSpacedIntervals", () => {
  it("distributes popups evenly over duration", () => {
    const intervals = computeSpacedIntervals(5, 1000, 0);
    expect(intervals.length).toBe(5);
    const total = intervals.reduce((sum, val) => sum + val, 0);
    expect(total).toBe(1000);
    const expectedInterval = 1000 / 5;
    for (const interval of intervals) {
      expect(interval).toBeCloseTo(expectedInterval, -1);
    }
  });

  it("returns empty array for zero popups", () => {
    const intervals = computeSpacedIntervals(0, 1000, 0);
    expect(intervals).toEqual([]);
  });

  it("returns single interval for one popup", () => {
    const intervals = computeSpacedIntervals(1, 1000, 0);
    expect(intervals).toEqual([1000]);
  });
});

describe("computeGlitchIntervals", () => {
  it("creates popups at irregular intervals", () => {
    const intervals1 = computeGlitchIntervals(5, 1000, 0);
    const intervals2 = computeGlitchIntervals(5, 1000, 42);

    expect(intervals1.length).toBe(5);
    expect(intervals2.length).toBe(5);

    // Glitch intervals should vary between different seeds
    const total1 = intervals1.reduce((sum, val) => sum + val, 0);
    const total2 = intervals2.reduce((sum, val) => sum + val, 0);
    expect(total1).toBeCloseTo(1000, -1);
    expect(total2).toBeCloseTo(1000, -1);

    // Intervals from different seeds should differ
    const allSame = intervals1.every((val, i) => Math.abs(val - intervals2[i]) < 0.01);
    expect(allSame).toBe(false);
  });

  it("each interval is positive", () => {
    const intervals = computeGlitchIntervals(3, 500, 0);
    for (const interval of intervals) {
      expect(interval).toBeGreaterThan(0);
    }
  });
});

describe("computeRampIntervals", () => {
  it("creates popups with increasing frequency", () => {
    const intervals = computeRampIntervals(5, 1000, 0);
    expect(intervals.length).toBe(5);

    // First intervals should be longer than last intervals
    const firstHalf = intervals.slice(0, Math.floor(intervals.length / 2));
    const secondHalf = intervals.slice(Math.floor(intervals.length / 2));

    const avgFirst = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    expect(avgFirst).toBeGreaterThan(avgSecond);
  });

  it("total duration roughly matches target", () => {
    const intervals = computeRampIntervals(5, 1000, 0);
    const total = intervals.reduce((sum, val) => sum + val, 0);
    expect(total).toBeCloseTo(1000, -1);
  });

  it("returns empty array for zero popups", () => {
    const intervals = computeRampIntervals(0, 1000, 0);
    expect(intervals).toEqual([]);
  });
});

describe("computePumpScareIntervals", () => {
  it("creates very short intervals for rapid flash effect", () => {
    const intervals = computePumpScareIntervals(5, 5000, 0);
    expect(intervals.length).toBe(5);
    for (const interval of intervals) {
      expect(interval).toBeGreaterThanOrEqual(50);
      expect(interval).toBeLessThan(500);
    }
  });

  it("intervals are very short compared to burst duration", () => {
    const intervals = computePumpScareIntervals(5, 5000, 0);
    const maxInterval = Math.max(...intervals);
    expect(maxInterval).toBeLessThan(5000 / 5);
  });
});

describe("computeBurstSchedule", () => {
  it("schedules spaced burst correctly", () => {
    const schedule = computeBurstSchedule({
      type: "Spaced",
      numPopups: 4,
      burstDuration: 4000,
      seed: 0,
    });

    expect(schedule.intervals.length).toBe(4);
    const total = schedule.intervals.reduce((sum, val) => sum + val, 0);
    expect(total).toBeCloseTo(4000, -1);
  });

  it("schedules glitch burst correctly", () => {
    const schedule = computeBurstSchedule({
      type: "Glitch",
      numPopups: 4,
      burstDuration: 4000,
      seed: 42,
    });

    expect(schedule.intervals.length).toBe(4);
  });

  it("schedules ramp burst correctly", () => {
    const schedule = computeBurstSchedule({
      type: "Ramp",
      numPopups: 4,
      burstDuration: 4000,
      seed: 0,
    });

    expect(schedule.intervals.length).toBe(4);
    const firstHalf = schedule.intervals.slice(0, 2);
    const secondHalf = schedule.intervals.slice(2);
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / 2;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / 2;
    expect(avgFirst).toBeGreaterThan(avgSecond);
  });

  it("schedules pump-scare burst correctly", () => {
    const schedule = computeBurstSchedule({
      type: "Pump-Scare",
      numPopups: 4,
      burstDuration: 4000,
      seed: 0,
    });

    expect(schedule.intervals.length).toBe(4);
    expect(schedule.isPumpScare).toBe(true);
  });

  it("schedules original burst as instant barrage", () => {
    const schedule = computeBurstSchedule({
      type: "Original",
      numPopups: 4,
      burstDuration: 4000,
      seed: 0,
    });

    expect(schedule.intervals.length).toBe(4);
    for (const interval of schedule.intervals) {
      expect(interval).toBe(0);
    }
  });

  it("schedules chaos burst selecting random type", () => {
    const schedule = computeBurstSchedule({
      type: "Chaos",
      numPopups: 4,
      burstDuration: 4000,
      seed: 123,
    });

    expect(schedule.intervals.length).toBe(4);
    expect(["Spaced", "Glitch", "Ramp", "Pump-Scare"]).toContain(schedule.selectedType);
  });
});

describe("selectChaosType", () => {
  it("returns one of the valid burst types", () => {
    const validTypes = ["Spaced", "Glitch", "Ramp", "Pump-Scare"];
    for (let i = 0; i < 20; i++) {
      const selected = selectChaosType(i);
      expect(validTypes).toContain(selected);
    }
  });

  it("deterministic based on seed", () => {
    expect(selectChaosType(0)).toBe(selectChaosType(0));
    expect(selectChaosType(5)).toBe(selectChaosType(5));
  });
});

describe("computeNextHibernateDelay", () => {
  it("returns delay within min-max range", () => {
    const min = 30000;
    const max = 60000;
    for (let seed = 0; seed < 50; seed++) {
      const delay = computeNextHibernateDelay(min, max, seed);
      expect(delay).toBeGreaterThanOrEqual(min);
      expect(delay).toBeLessThanOrEqual(max);
    }
  });

  it("returns min when min equals max", () => {
    const delay = computeNextHibernateDelay(5000, 5000, 0);
    expect(delay).toBe(5000);
  });
});
