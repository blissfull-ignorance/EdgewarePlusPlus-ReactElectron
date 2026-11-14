import { describe, expect, it } from "vitest";
import {
  computeNextHibernateDelay,
  planBurst,
  resolveBurstType,
  MAX_BURST_POPUPS,
} from "../../src/features/hibernate/HibernateScheduler";

/** Deterministic rand from a fixed sequence. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("computeNextHibernateDelay (legacy randint(min, max))", () => {
  it("is inclusive on both ends", () => {
    expect(computeNextHibernateDelay(1000, 2000, () => 0)).toBe(1000);
    expect(computeNextHibernateDelay(1000, 2000, () => 0.999999)).toBe(2000);
    expect(computeNextHibernateDelay(1000, 2000, () => 0.5)).toBe(1500);
  });

  it("collapses an inverted or equal range to the minimum", () => {
    expect(computeNextHibernateDelay(5000, 1000, () => 0.7)).toBe(5000);
    expect(computeNextHibernateDelay(3000, 3000, () => 0.1)).toBe(3000);
  });

  it("clamps hostile ranges to the burst-duration ceiling", () => {
    expect(computeNextHibernateDelay(0, 1e12, () => 0.5)).toBeLessThanOrEqual(3_600_000);
    expect(computeNextHibernateDelay(Number.NaN, 1000, () => 0)).toBe(0);
  });
});

describe("resolveBurstType", () => {
  it("passes concrete types through", () => {
    expect(resolveBurstType("Glitch", () => 0)).toBe("Glitch");
  });

  it("Chaos picks among the five real types — Original included (legacy)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) seen.add(resolveBurstType("Chaos", seq([i / 5])));
    expect(seen.has("Original")).toBe(true);
    expect(seen.has("Spaced")).toBe(true);
    expect(seen.has("Glitch")).toBe(true);
    expect(seen.has("Ramp")).toBe(true);
    expect(seen.has("Pump-Scare")).toBe(true);
    expect(seen.has("Chaos")).toBe(false);
  });
});

describe("planBurst — Original (instant barrage)", () => {
  it("spawns randint(activity/2, activity) immediate ticks", () => {
    const plan = planBurst({
      type: "Original",
      wakeupActivity: 20,
      hibernateLengthMs: 15000,
      popupDelayMs: 5000,
      rand: seq([0]),
    });
    expect(plan.intervalsMs).toHaveLength(10); // randint(10, 20) with rand 0 → 10
    expect(plan.intervalsMs.every((i) => i === 0)).toBe(true);
  });

  it("upper end of the range with rand near 1", () => {
    const plan = planBurst({
      type: "Original",
      wakeupActivity: 20,
      hibernateLengthMs: 15000,
      popupDelayMs: 5000,
      rand: () => 0.999999,
    });
    expect(plan.intervalsMs).toHaveLength(20);
  });
});

describe("planBurst — Spaced (delay-driven, legacy)", () => {
  it("ticks every popup delay for the burst length, not by wakeupActivity", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: 999, // must be ignored
      hibernateLengthMs: 10000,
      popupDelayMs: 2000,
      rand: () => 0,
    });
    expect(plan.intervalsMs).toEqual([0, 2000, 2000, 2000, 2000]); // floor(10000/2000) ticks
  });

  it("always ticks at least once", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: 5,
      hibernateLengthMs: 100,
      popupDelayMs: 5000,
      rand: () => 0,
    });
    expect(plan.intervalsMs).toEqual([0]);
  });
});

describe("planBurst — Glitch (legacy choice-set gaps)", () => {
  it("produces activity ticks whose gaps come from [0, base, base/m, base*m]", () => {
    const plan = planBurst({
      type: "Glitch",
      wakeupActivity: 4,
      hibernateLengthMs: 12000,
      popupDelayMs: 5000,
      rand: seq([0, 0, 0, 0, 0, 0, 0]),
    });
    expect(plan.intervalsMs).toHaveLength(4);
    expect(plan.intervalsMs[0]).toBe(0);
    // base = 12000/4 = 3000; with rand 0: modifier=2, choice index 0 → gap 0.
    expect(plan.intervalsMs.slice(1).every((g) => [0, 3000, 1500, 750, 6000, 12000].includes(g))).toBe(
      true
    );
  });

  it("sums to a plausible burst window", () => {
    const plan = planBurst({
      type: "Glitch",
      wakeupActivity: 10,
      hibernateLengthMs: 10000,
      popupDelayMs: 5000,
      rand: seq([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
    });
    const total = plan.intervalsMs.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(10 * (10000 / 10) * 4);
  });
});

describe("planBurst — Ramp (accelerating)", () => {
  it("gaps shrink over the burst and lock to delay*0.9 below the floor", () => {
    const plan = planBurst({
      type: "Ramp",
      wakeupActivity: 30,
      hibernateLengthMs: 20000,
      popupDelayMs: 1000,
      rand: () => 0,
    });
    expect(plan.intervalsMs[0]).toBe(0);
    const gaps = plan.intervalsMs.slice(1);
    // Early gaps are large (length/4 territory), later gaps hit the 0.9*delay floor.
    expect(gaps[0]).toBeGreaterThan(gaps[gaps.length - 1]);
    expect(gaps[gaps.length - 1]).toBe(900);
    // Monotonic non-increasing overall trend: first half average > second half.
    const half = Math.floor(gaps.length / 2);
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(gaps.slice(0, half))).toBeGreaterThan(avg(gaps.slice(half)));
  });
});

describe("planBurst — Pump-Scare", () => {
  it("is a single tick flagged pump-scare (caller spawns image+audio)", () => {
    const plan = planBurst({
      type: "Pump-Scare",
      wakeupActivity: 20,
      hibernateLengthMs: 15000,
      popupDelayMs: 5000,
      rand: () => 0,
    });
    expect(plan.isPumpScare).toBe(true);
    expect(plan.intervalsMs).toEqual([0]);
  });
});

describe("planBurst — hostile settings clamps", () => {
  it("caps a runaway wakeupActivity so no unbounded array is allocated", () => {
    const plan = planBurst({
      type: "Original",
      wakeupActivity: 1e9,
      hibernateLengthMs: 15000,
      popupDelayMs: 5000,
      rand: () => 0.5,
    });
    expect(plan.intervalsMs.length).toBeLessThanOrEqual(MAX_BURST_POPUPS);
    expect(plan.intervalsMs.length).toBeGreaterThan(0);
  });

  it("survives NaN settings with sane defaults", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: Number.NaN,
      hibernateLengthMs: Number.NaN,
      popupDelayMs: Number.NaN,
      rand: () => 0,
    });
    expect(plan.intervalsMs.length).toBeGreaterThanOrEqual(1);
    expect(plan.intervalsMs.every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
  });
});
