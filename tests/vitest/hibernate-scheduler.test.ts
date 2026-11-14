import { describe, expect, it } from "vitest";
import {
  computeNextHibernateDelay,
  planBurst,
  resolveBurstType,
  MAX_BURST_POPUPS,
  type BurstType,
} from "../../src/features/hibernate/HibernateScheduler";

/** Deterministic rand from a fixed sequence. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Absolute tick times reconstructed from consecutive delays. */
function times(intervals: number[]): number[] {
  let t = 0;
  return intervals.map((d) => (t += d));
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
    expect(computeNextHibernateDelay(Number.NaN, 1000, () => 0)).toBe(1000);
  });

  it("floors the sleep so an all-zero range cannot storm", () => {
    expect(computeNextHibernateDelay(0, 0, () => 0)).toBe(1000);
    expect(computeNextHibernateDelay(500, 800, () => 0.9)).toBe(1000);
    expect(computeNextHibernateDelay(-10, -5, () => 0)).toBe(1000);
  });
});

describe("resolveBurstType", () => {
  it("passes concrete types through", () => {
    expect(resolveBurstType("Glitch", () => 0)).toBe("Glitch");
  });

  it("an unknown name from a hand-edited config bursts as Original", () => {
    expect(resolveBurstType("Nonsense" as BurstType, () => 0)).toBe("Original");
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
    expect(plan.durationMs).toBe(0);
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

  it("zero activity is a silent burst (legacy randint(0, 0))", () => {
    const plan = planBurst({
      type: "Original",
      wakeupActivity: 0,
      hibernateLengthMs: 15000,
      popupDelayMs: 5000,
      rand: () => 0.5,
    });
    expect(plan.intervalsMs).toHaveLength(0);
  });
});

describe("planBurst — Spaced (delay-driven inside the length window)", () => {
  it("ticks every popup delay while the window is open, ignoring wakeupActivity", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: 999, // must be ignored
      hibernateLengthMs: 10000,
      popupDelayMs: 2000,
      rand: () => 0,
    });
    expect(times(plan.intervalsMs)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(plan.durationMs).toBe(10000); // re-arm at the window close
  });

  it("keeps the tick whose time lands inside a non-multiple window (legacy ceil)", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: 5,
      hibernateLengthMs: 12000,
      popupDelayMs: 5000,
      rand: () => 0,
    });
    expect(times(plan.intervalsMs)).toEqual([0, 5000, 10000]);
  });

  it("always ticks at least once, even with a zero-length window", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: 5,
      hibernateLengthMs: 0,
      popupDelayMs: 5000,
      rand: () => 0,
    });
    expect(plan.intervalsMs).toEqual([0]);
  });
});

describe("planBurst — Glitch (legacy choice-set gaps, window-capped)", () => {
  it("rand 0 pins the legacy choice set: modifier 2, gap choice 0 (clustering)", () => {
    const plan = planBurst({
      type: "Glitch",
      wakeupActivity: 4,
      hibernateLengthMs: 12000,
      popupDelayMs: 5000,
      rand: seq([0, 0, 0, 0, 0, 0, 0]),
    });
    // base = 3000; every draw: modifier=2, choice index 0 → gap 0.
    expect(plan.intervalsMs).toEqual([0, 0, 0, 0]);
    expect(plan.durationMs).toBe(12000);
  });

  it("each legacy choice index is reachable: [0, base, base/m, base*m]", () => {
    // activity 4, length 40000 → base 10000; modifier pinned to 2 by rand 0.
    const gapFor = (choiceRand: number) =>
      planBurst({
        type: "Glitch",
        wakeupActivity: 4,
        hibernateLengthMs: 40_000,
        popupDelayMs: 5000,
        rand: seq([0, choiceRand]),
      }).intervalsMs[1];
    expect(gapFor(0)).toBe(0);
    expect(gapFor(0.25)).toBe(10_000); // base
    expect(gapFor(0.5)).toBe(5_000); // base / modifier
    expect(gapFor(0.75)).toBe(20_000); // base * modifier
  });

  it("stops ticking when the length window closes", () => {
    // rand 0.99: modifier 4, choice index 3 → gap = base*4 = 400 per tick.
    const plan = planBurst({
      type: "Glitch",
      wakeupActivity: 10,
      hibernateLengthMs: 1000,
      popupDelayMs: 5000,
      rand: seq([0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99]),
    });
    const t = times(plan.intervalsMs);
    expect(t.length).toBeLessThan(10); // window cut it short
    expect(t.every((x) => x < 1000)).toBe(true);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(800);
  });

  it("zero activity is a silent burst", () => {
    const plan = planBurst({
      type: "Glitch",
      wakeupActivity: 0,
      hibernateLengthMs: 5000,
      popupDelayMs: 1000,
      rand: () => 0,
    });
    expect(plan.intervalsMs).toHaveLength(0);
    expect(plan.durationMs).toBe(5000);
  });
});

describe("planBurst — Ramp (accelerating, locked ticks counted)", () => {
  it("gaps shrink over the burst and the window caps it", () => {
    const plan = planBurst({
      type: "Ramp",
      wakeupActivity: 30,
      hibernateLengthMs: 20000,
      popupDelayMs: 1000,
      rand: () => 0,
    });
    const t = times(plan.intervalsMs);
    expect(t[0]).toBe(0);
    expect(t.every((x) => x < 20000)).toBe(true);
    const gaps = plan.intervalsMs.slice(1);
    expect(gaps[0]).toBeGreaterThan(gaps[gaps.length - 1]);
    expect(plan.durationMs).toBe(20000);
  });

  it("zero activity is a silent burst", () => {
    const plan = planBurst({
      type: "Ramp",
      wakeupActivity: 0,
      hibernateLengthMs: 5000,
      popupDelayMs: 1000,
      rand: () => 0,
    });
    expect(plan.intervalsMs).toHaveLength(0);
  });

  it("only locked-phase ticks count toward activity (legacy ramp)", () => {
    // length 400 → divisor starts at 100: one accelerating tick (uncounted),
    // then two locked ticks at delay*0.9 = 90ms each.
    const plan = planBurst({
      type: "Ramp",
      wakeupActivity: 2,
      hibernateLengthMs: 400,
      popupDelayMs: 100,
      rand: () => 0,
    });
    // t=0 (accelerate: modifier 100→90.9, gap 100+90=190), t=190 (locked 1,
    // gap 90), t=280 (locked 2 → budget spent).
    expect(times(plan.intervalsMs)).toEqual([0, 190, 280]);
    expect(plan.durationMs).toBe(400);
  });

  it("a zero-length window locks immediately and counts one tick", () => {
    // length 0 → divisor starts under the 100ms lock → the locked branch
    // (the only one that counts toward activity) fires once.
    const plan = planBurst({
      type: "Ramp",
      wakeupActivity: 1,
      hibernateLengthMs: 0,
      popupDelayMs: 100,
      rand: () => 0,
    });
    expect(plan.intervalsMs).toEqual([0]);
  });
});

describe("planBurst — roll-delay floor", () => {
  it("a zero popup delay still spaces Spaced ticks at the 100ms floor", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: 20,
      hibernateLengthMs: 250,
      popupDelayMs: 0,
      rand: () => 0,
    });
    expect(times(plan.intervalsMs)).toEqual([0, 100, 200]);
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
    expect(plan.durationMs).toBe(0);
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

  it("caps a runaway burst length for windowed types", () => {
    const plan = planBurst({
      type: "Spaced",
      wakeupActivity: 20,
      hibernateLengthMs: 1e12,
      popupDelayMs: 100,
      rand: () => 0,
    });
    expect(plan.durationMs).toBeLessThanOrEqual(3_600_000);
    expect(plan.intervalsMs.length).toBeLessThanOrEqual(36_001);
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
