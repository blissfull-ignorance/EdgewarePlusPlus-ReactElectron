import { describe, expect, it } from "vitest";
import { computeFadeInSteps, computeFadeOutSteps, computeSubliminalAlpha } from "../../src/utils/leet";

describe("computeFadeInSteps", () => {
  it("returns correct number of steps at 60 ticks per second", () => {
    // 600ms at 60 ticks/s = 36 intervals + the initial step.
    expect(computeFadeInSteps(600, 0.5).length).toBe(37);
  });

  it("volume ramps from 0 to target volume", () => {
    const steps = computeFadeInSteps(500, 0.8);
    expect(steps[0]).toBeCloseTo(0, 2);
    expect(steps[steps.length - 1]).toBeCloseTo(0.8, 1);
  });

  it("volume increases monotonically", () => {
    const steps = computeFadeInSteps(1000, 0.5);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    }
  });

  it("handles zero duration", () => {
    const steps = computeFadeInSteps(0, 0.5);
    expect(steps).toEqual([0.5]);
  });
});

describe("computeFadeOutSteps", () => {
  it("volume ramps from current to 0", () => {
    const steps = computeFadeOutSteps(500, 0.8);
    expect(steps[0]).toBeCloseTo(0.8, 2);
    expect(steps[steps.length - 1]).toBeCloseTo(0, 2);
  });

  it("volume decreases monotonically", () => {
    const steps = computeFadeOutSteps(1000, 0.5);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]);
    }
  });

  it("handles zero duration", () => {
    const steps = computeFadeOutSteps(0, 0.5);
    expect(steps).toEqual([0]);
  });
});

describe("computeSubliminalAlpha", () => {
  it("uses inverted alpha formula: int((1 - opacity) * 255)", () => {
    expect(computeSubliminalAlpha(0)).toBe(255);
    expect(computeSubliminalAlpha(1)).toBe(0);
    expect(computeSubliminalAlpha(0.5)).toBe(127);
  });

  it("maps quarter and three-quarter opacity", () => {
    expect(computeSubliminalAlpha(0.25)).toBe(191);
    expect(computeSubliminalAlpha(0.75)).toBe(63);
  });
});
