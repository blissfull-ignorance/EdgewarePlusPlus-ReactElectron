import { describe, expect, it } from "vitest";
import { legacyPopupSize } from "../../src/features/popup/legacySize";

/**
 * Legacy popup sizing (features/popup.py): the media's longest side spans a
 * random 30–70% of the monitor's shortest side (20–50% lowkey), preserving
 * the media aspect ratio exactly.
 */
describe("legacyPopupSize", () => {
  const shortSide = 1000;

  it("maps the longest side into 30–70% of the monitor short side", () => {
    for (const r of [0, 0.5, 0.999]) {
      const { width, height } = legacyPopupSize(800, 600, shortSide, () => r);
      const longest = Math.max(width, height);
      expect(longest).toBeGreaterThanOrEqual(300 * 0.99);
      expect(longest).toBeLessThanOrEqual(700 * 1.01);
    }
  });

  it("maps into 20–50% in lowkey mode", () => {
    const { width, height } = legacyPopupSize(800, 600, shortSide, () => 0, true);
    expect(Math.max(width, height)).toBeCloseTo(200, 0);
  });

  it("preserves the aspect ratio for landscape and portrait media", () => {
    const land = legacyPopupSize(1600, 900, shortSide, () => 0.5);
    expect(land.width / land.height).toBeCloseTo(1600 / 900, 1);
    const port = legacyPopupSize(900, 1600, shortSide, () => 0.5);
    expect(port.height / port.width).toBeCloseTo(1600 / 900, 1);
    expect(port.height).toBeGreaterThan(port.width);
  });

  it("scales portrait art so the tall side hits the target fraction", () => {
    const { width, height } = legacyPopupSize(1155, 1400, shortSide, () => 1);
    expect(height).toBeCloseTo(700, 0);
    expect(width / height).toBeCloseTo(1155 / 1400, 2);
  });

  it("falls back to a sane frame for degenerate inputs", () => {
    expect(legacyPopupSize(0, 0, shortSide)).toEqual({ width: 400, height: 300 });
    expect(legacyPopupSize(800, 600, 0)).toEqual({ width: 400, height: 300 });
    expect(legacyPopupSize(-5, 600, shortSide)).toEqual({ width: 400, height: 300 });
  });
});
