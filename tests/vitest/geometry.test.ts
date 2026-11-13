import { describe, expect, it } from "vitest";
import {
  computePopupGeometry,
  calculatePopupDimensions,
  computeWeightedPosition,
  computeCornerPosition,
  parseDisabledMonitors,
  selectMonitor,
  computeCellWeight,
  selectWeightedCell,
  LOWKEY_CORNERS,
} from "../../src/utils/geometry";

describe("geometry.computePopupGeometry", () => {
  it("returns valid coordinates within monitor bounds", () => {
    const result = computePopupGeometry({
      mediaWidth: 640,
      mediaHeight: 480,
      monitors: [{ x: 0, y: 0, width: 1920, height: 1080 }],
      existingPopups: [],
      isLowkey: false,
    });

    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.x + result.width).toBeLessThanOrEqual(1920);
    expect(result.y + result.height).toBeLessThanOrEqual(1080);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

});

describe("geometry avoids overlapping existing popups", () => {

  it("with 1 existing popup, uses finite weighted placement that prefers non-overlapping positions", () => {
    const existingPopups = [
      { x: 100, y: 100, width: 200, height: 150 },
    ];

    let overlapsFound = 0;
    const iterations = 200;

    for (let i = 0; i < iterations; i++) {
      const result = computePopupGeometry({
        mediaWidth: 640,
        mediaHeight: 480,
        monitors: [{ x: 0, y: 0, width: 1920, height: 1080 }],
        existingPopups,
        isLowkey: false,
      });

      if (
        result.x < existingPopups[0].x + existingPopups[0].width &&
        result.x + result.width > existingPopups[0].x &&
        result.y < existingPopups[0].y + existingPopups[0].height &&
        result.y + result.height > existingPopups[0].y
      ) {
        overlapsFound++;
      }
    }

    const overlapRate = overlapsFound / iterations;
    expect(overlapRate).toBeLessThan(0.15);
  });
});

describe("geometry respects disabled monitors", () => {
  it("selects from available monitors only", () => {
    const monitors = [
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 1920, y: 0, width: 1920, height: 1080 },
    ];

    let onDisabled = 0;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const result = computePopupGeometry({
        mediaWidth: 640,
        mediaHeight: 480,
        monitors,
        existingPopups: [],
        isLowkey: false,
        disabledMonitors: JSON.stringify([0]),
      });

      if (result.x < 1920) {
        onDisabled++;
      }
    }

    expect(onDisabled).toBe(0);
  });

  it("falls back to first monitor when all disabled", () => {
    const result = computePopupGeometry({
      mediaWidth: 640,
      mediaHeight: 480,
      monitors: [{ x: 0, y: 0, width: 1920, height: 1080 }],
      existingPopups: [],
      isLowkey: false,
      disabledMonitors: JSON.stringify([0]),
    });

    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x + result.width).toBeLessThanOrEqual(1920);
  });
});

describe("geometry with lowkey mode", () => {
  it("lowkey=0 (Top-Right) produces popup in top-right corner", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    const result = computePopupGeometry({
      mediaWidth: 640,
      mediaHeight: 480,
      monitors: [monitor],
      existingPopups: [],
      isLowkey: true,
      cornerIndex: 0,
      lowkeyScaling: 50,
    });

    expect(result.x).toBeGreaterThan(1000);
    expect(result.y).toBeLessThan(200);
  });

  it("lowkey=1 (Top-Left) produces popup in top-left corner", () => {
    const result = computePopupGeometry({
      mediaWidth: 640,
      mediaHeight: 480,
      monitors: [{ x: 0, y: 0, width: 1920, height: 1080 }],
      existingPopups: [],
      isLowkey: true,
      cornerIndex: 1,
      lowkeyScaling: 50,
    });

    expect(result.x).toBeLessThan(200);
    expect(result.y).toBeLessThan(200);
  });

  it("lowkey=2 (Bottom-Left) produces popup in bottom-left corner", () => {
    const result = computePopupGeometry({
      mediaWidth: 640,
      mediaHeight: 480,
      monitors: [{ x: 0, y: 0, width: 1920, height: 1080 }],
      existingPopups: [],
      isLowkey: true,
      cornerIndex: 2,
      lowkeyScaling: 50,
    });

    expect(result.x).toBeLessThan(200);
    expect(result.y).toBeGreaterThan(600);
  });

  it("lowkey=3 (Bottom-Right) produces popup in bottom-right corner", () => {
    const result = computePopupGeometry({
      mediaWidth: 640,
      mediaHeight: 480,
      monitors: [{ x: 0, y: 0, width: 1920, height: 1080 }],
      existingPopups: [],
      isLowkey: true,
      cornerIndex: 3,
      lowkeyScaling: 50,
    });

    expect(result.x).toBeGreaterThan(1000);
    expect(result.y).toBeGreaterThan(600);
  });

  it("lowkey=4 (Random) actually varies the corner", () => {
    const corners = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const result = computePopupGeometry({
        mediaWidth: 640,
        mediaHeight: 480,
        monitors: [{ x: 0, y: 0, width: 1920, height: 1080 }],
        existingPopups: [],
        isLowkey: true,
        cornerIndex: 4,
        lowkeyScaling: 50,
      });
      corners.add(`${result.x > 960 ? "R" : "L"}${result.y > 540 ? "B" : "T"}`);
    }
    expect(corners.size).toBeGreaterThanOrEqual(2);
  });
});

describe("calculatePopupDimensions", () => {
  it("uses 30-70% range for fullscreen mode on every draw", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    // Longest side = short monitor side × scale ∈ [0.3,0.7] × min(aspect,2).
    // 640x480 → aspect 4/3, so width ∈ [432, 1008] and height = width/aspect.
    for (let i = 0; i < 100; i++) {
      const { width, height } = calculatePopupDimensions(640, 480, monitor, false, 50);
      expect(width).toBeGreaterThanOrEqual(431);
      expect(width).toBeLessThanOrEqual(1008);
      expect(Math.abs(height - width / (640 / 480))).toBeLessThanOrEqual(2);
    }
  });

  it("uses 20-50% range for lowkey mode on every draw", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    // 640x480 → width ∈ [1080×0.2×4/3, 1080×0.5×4/3] = [288, 720].
    for (let i = 0; i < 100; i++) {
      const { width, height } = calculatePopupDimensions(640, 480, monitor, true, 100);
      expect(width).toBeGreaterThanOrEqual(287);
      expect(width).toBeLessThanOrEqual(720);
      expect(Math.abs(height - width / (640 / 480))).toBeLessThanOrEqual(2);
    }
  });

  it("respects minimum dimension of 100", () => {
    const { width, height } = calculatePopupDimensions(1, 1, {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    }, false, 50);

    expect(width).toBeGreaterThanOrEqual(100);
    expect(height).toBeGreaterThanOrEqual(100);
  });
});

describe("computeWeightedPosition", () => {
  it("returns position within bounds when no existing popups", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    const pos = computeWeightedPosition(monitor, 200, 150, []);

    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(pos.x + 200).toBeLessThanOrEqual(1920);
    expect(pos.y + 150).toBeLessThanOrEqual(1080);
  });

  it("computes cell weight against existing popups", () => {
    const existingPopups = [
      { x: 100, y: 100, width: 200, height: 150 },
      { x: 500, y: 500, width: 200, height: 150 },
    ];

    const weight = computeCellWeight(0, 0, 200, 150, existingPopups);
    expect(weight).toBe(Number.POSITIVE_INFINITY);
  });

  it("computes finite weight when single popup exists", () => {
    const existingPopups = [{ x: 100, y: 100, width: 200, height: 150 }];
    const weight = computeCellWeight(500, 500, 200, 150, existingPopups);

    expect(weight).toBeGreaterThan(0);
    expect(Number.isFinite(weight)).toBe(true);
  });
});

describe("computeCornerPosition", () => {
  it("Top-Right corner is near the right edge and top", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    const pos = computeCornerPosition(monitor, 200, 150, 0);
    expect(pos.x).toBeGreaterThan(1500);
    expect(pos.y).toBeLessThan(100);
  });

  it("Top-Left corner is near the left edge and top", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    const pos = computeCornerPosition(monitor, 200, 150, 1);
    expect(pos.x).toBeLessThan(100);
    expect(pos.y).toBeLessThan(100);
  });
});

describe("parseDisabledMonitors", () => {
  it("parses valid JSON array", () => {
    expect(parseDisabledMonitors('[0, 2]')).toEqual([0, 2]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseDisabledMonitors("not-json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseDisabledMonitors('"not-an-array"')).toEqual([]);
  });

  it("filters non-number values", () => {
    expect(parseDisabledMonitors('[0, "two", 3]')).toEqual([0, 3]);
  });
});

describe("selectMonitor", () => {
  it("excludes disabled monitors", () => {
    const monitors = [
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 1920, y: 0, width: 1920, height: 1080 },
    ];
    const result = selectMonitor(monitors, JSON.stringify([0]));
    expect(result).toBe(monitors[1]);
    expect(monitors).toContain(selectMonitor(monitors, "[]"));
  });

  it("falls back to first monitor when all disabled", () => {
    const monitors = [
      { x: 0, y: 0, width: 1920, height: 1080 },
    ];
    const result = selectMonitor(monitors, JSON.stringify([0]));
    expect(result).toBe(monitors[0]);
  });
});

describe("LOWKEY_CORNERS", () => {
  it("corner names match legacy values", () => {
    expect(LOWKEY_CORNERS).toHaveLength(5);
    expect(LOWKEY_CORNERS[0].name).toBe("Top-Right");
    expect(LOWKEY_CORNERS[1].name).toBe("Top-Left");
    expect(LOWKEY_CORNERS[2].name).toBe("Bottom-Left");
    expect(LOWKEY_CORNERS[3].name).toBe("Bottom-Right");
    expect(LOWKEY_CORNERS[4].name).toBe("Random");
  });
});

describe("selectWeightedCell", () => {
  it("returns a valid index within bounds", () => {
    const weights = [1, 2, 3, 4, 5];
    for (let i = 0; i < 100; i++) {
      const idx = selectWeightedCell(weights, weights.length);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(weights.length);
    }
  });

  it("returns random index when all weights are infinity", () => {
    const weights = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    for (let i = 0; i < 10; i++) {
      const idx = selectWeightedCell(weights, weights.length);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(weights.length);
    }
  });
});
