import { describe, expect, it } from "vitest";
import { clicksForIndex } from "../../src/hooks/useRandomClicksToClose";

describe("clicksForIndex (legacy random_clicks_to_close parity)", () => {
  it("returns 1 when no pack index is available", () => {
    expect(clicksForIndex(null)).toBe(1);
  });

  it("rolls within [1, default.maxClicks] using the default mood", () => {
    const idx = { default: { maxClicks: 4 } };
    for (let i = 0; i < 200; i++) {
      const n = clicksForIndex(idx as unknown as Record<string, unknown>, "foo.png");
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it("uses the maxClicks of the file's mapped mood", () => {
    const idx = {
      default: { maxClicks: 2 },
      mediaMoods: { "foo.png": "strict" },
      moods: [{ name: "strict", maxClicks: 7 }],
    };
    for (let i = 0; i < 300; i++) {
      const n = clicksForIndex(idx as unknown as Record<string, unknown>, "foo.png");
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(7);
    }
    // A file without a mood mapping stays inside the default range.
    for (let i = 0; i < 200; i++) {
      const n = clicksForIndex(idx as unknown as Record<string, unknown>, "bar.png");
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("clamps pathological maxClicks values", () => {
    expect(clicksForIndex({ default: { maxClicks: 0 } })).toBe(1);
    const n = clicksForIndex({ default: { maxClicks: 100000 }});
    expect(n).toBeLessThanOrEqual(100);
  });
});
