import { describe, expect, it } from "vitest";
import { roll } from "../../src/utils/roll";

describe("roll", () => {
  it("roll(0) always returns false", () => {
    for (let i = 0; i < 1000; i++) {
      expect(roll(0)).toBe(false);
    }
  });

  it("roll(100) always returns true", () => {
    for (let i = 0; i < 1000; i++) {
      expect(roll(100)).toBe(true);
    }
  });

  it("roll(50) returns true approximately 50% of the time", () => {
    let trueCount = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      if (roll(50)) trueCount++;
    }
    const ratio = trueCount / iterations;
    expect(ratio).toBeGreaterThan(0.44);
    expect(ratio).toBeLessThan(0.56);
  });

  it("roll(1) returns true approximately 1% of the time", () => {
    let trueCount = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      if (roll(1)) trueCount++;
    }
    const ratio = trueCount / iterations;
    expect(ratio).toBeGreaterThan(0.003);
    expect(ratio).toBeLessThan(0.02);
  });

  it("roll(99) returns true approximately 99% of the time", () => {
    let trueCount = 0;
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      if (roll(99)) trueCount++;
    }
    const ratio = trueCount / iterations;
    expect(ratio).toBeGreaterThan(0.98);
    expect(ratio).toBeLessThan(0.997);
  });

  it("roll returns boolean values", () => {
    expect(typeof roll(50)).toBe("boolean");
  });
});
