import { describe, expect, it } from "vitest";
import { initialMoveState, stepMove } from "../../src/features/popup/windowMovement";

/**
 * Legacy window motion (features/popup.py try_move): random velocity of up to
 * ±movingSpeed px per tick, never fully stationary, bouncing off display edges.
 */
describe("initialMoveState", () => {
  it("picks a velocity within ±speed and never both zero", () => {
    const seq = [0.5, 0.5, 0.5, 0.0, 0.25, 0.75];
    let i = 0;
    const rand = () => seq[i++ % seq.length];
    for (let trial = 0; trial < 40; trial++) {
      const s = initialMoveState(100, 100, 5, rand);
      expect(Math.abs(s.vx)).toBeLessThanOrEqual(5);
      expect(Math.abs(s.vy)).toBeLessThanOrEqual(5);
      expect(s.vx === 0 && s.vy === 0).toBe(false);
    }
  });

  it("re-rolls until the velocity is not stationary", () => {
    // 0.5 maps to exactly 0 for both axes; the loop must roll again and land
    // on the non-zero draw instead of spawning a frozen popup.
    const draws = [0.5, 0.5, 0.5, 0.9];
    let i = 0;
    const rand = () => {
      const v = draws[Math.min(i, draws.length - 1)];
      i += 1;
      return v;
    };
    const s = initialMoveState(0, 0, 1, rand);
    expect(s.vx === 0 && s.vy === 0).toBe(false);
    expect(i).toBeGreaterThan(2);
  });

  it("treats a zero or negative speed as at least 1 px/tick", () => {
    const s = initialMoveState(0, 0, 0, () => 0.9);
    expect(Math.abs(s.vx) + Math.abs(s.vy)).toBeGreaterThanOrEqual(1);
  });
});

describe("stepMove", () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 800 };

  it("advances by the velocity", () => {
    const next = stepMove({ x: 100, y: 100, vx: 3, vy: -2 }, bounds, 200, 150);
    expect(next.x).toBe(103);
    expect(next.y).toBe(98);
  });

  it("bounces horizontally at the right edge and stays inside", () => {
    let s = { x: 795, y: 100, vx: 5, vy: 0 };
    s = stepMove(s, bounds, 200, 150);
    expect(s.x).toBe(800);
    expect(s.vx).toBe(-5);
    s = stepMove(s, bounds, 200, 150);
    expect(s.x).toBe(795);
  });

  it("bounces vertically at the top edge", () => {
    const s = stepMove({ x: 100, y: 4, vx: 0, vy: -5 }, bounds, 200, 150);
    expect(s.y).toBe(0);
    expect(s.vy).toBe(5);
  });

  it("keeps moving inside a display offset from the origin", () => {
    const multi = { x: 1920, y: 0, width: 1920, height: 1080 };
    let s = { x: 1920, y: 500, vx: -4, vy: 0 };
    s = stepMove(s, multi, 300, 200);
    expect(s.x).toBe(1920);
    expect(s.vx).toBe(4);
  });

  it("never leaves the bounds over a long run", () => {
    let s = initialMoveState(500, 400, 7, () => 0.8);
    for (let i = 0; i < 2000; i++) {
      s = stepMove(s, bounds, 200, 150);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(800);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(650);
    }
  });
});
