import { describe, expect, it } from "vitest";
import { planAudioFades, targetVolume } from "../../src/features/audio/audioFade";
import { computeSubliminalAlpha } from "../../src/utils/leet";

/**
 * Legacy audio.py fade scheduling: the fade-out must reach zero exactly at
 * end-of-stream, and fades that together outlast the clip are scaled down
 * proportionally.
 */
describe("planAudioFades", () => {
  it("anchors the fade-out to the end of the clip", () => {
    const plan = planAudioFades(10_000, 1000, 2000);
    expect(plan.fadeInMs).toBe(1000);
    expect(plan.fadeOutMs).toBe(2000);
    expect(plan.fadeOutStartMs).toBe(8000);
  });

  it("drops the fade-out when only the fade-in is configured", () => {
    const plan = planAudioFades(10_000, 1000, 0);
    expect(plan.fadeOutMs).toBe(0);
    expect(plan.fadeOutStartMs).toBe(10_000);
  });

  it("scales both fades proportionally when they outlast the clip", () => {
    const plan = planAudioFades(1000, 3000, 1000);
    expect(plan.fadeInMs + plan.fadeOutMs).toBe(1000);
    // 3:1 ratio preserved.
    expect(plan.fadeInMs).toBe(750);
    expect(plan.fadeOutMs).toBe(250);
    expect(plan.fadeOutStartMs).toBe(750);
  });

  it("keeps only the fade-in when the duration is unknown (streaming)", () => {
    const plan = planAudioFades(Number.NaN, 500, 500);
    expect(plan.fadeInMs).toBe(500);
    expect(plan.fadeOutMs).toBe(0);
  });

  it("treats hostile negative or NaN fades as zero", () => {
    const plan = planAudioFades(5000, -100, Number.NaN);
    expect(plan.fadeInMs).toBe(0);
    expect(plan.fadeOutMs).toBe(0);
    expect(plan.fadeOutStartMs).toBe(5000);
  });
});

describe("targetVolume (audioVolume percent → element 0..1)", () => {
  it("maps the percentage range", () => {
    expect(targetVolume(100)).toBe(1);
    expect(targetVolume(40)).toBeCloseTo(0.4, 5);
    expect(targetVolume(0)).toBe(0);
  });

  it("clamps out-of-range and non-numeric values", () => {
    expect(targetVolume(150)).toBe(1);
    expect(targetVolume(-20)).toBe(0);
    expect(targetVolume(Number.NaN)).toBe(1);
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
