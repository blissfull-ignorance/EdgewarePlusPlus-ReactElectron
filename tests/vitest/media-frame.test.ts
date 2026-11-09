import { describe, expect, it } from "vitest";
import { computeContainedFrame } from "../../src/features/popup/mediaFrame";

describe("computeContainedFrame", () => {
  it("returns null when media has not decoded yet", () => {
    expect(computeContainedFrame(400, 300, 0, 0)).toBeNull();
    expect(computeContainedFrame(400, 300, -5, 60)).toBeNull();
    expect(computeContainedFrame(0, 300, 800, 600)).toBeNull();
  });

  it("fills the whole box when aspect ratios match", () => {
    // 4:3 media in a 4:3 box letterboxes nowhere
    expect(computeContainedFrame(400, 300, 800, 600)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it("centers landscape media in a portrait-tall box and computes the letterbox offsets", () => {
    // 2:1 media in a 300x300 box → visible band is 300x150 centered vertically
    expect(computeContainedFrame(300, 300, 200, 100)).toEqual({ x: 0, y: 75, width: 300, height: 150 });
  });

  it("centers portrait media in a wide box", () => {
    // 1:2 media in a 400x400 box → visible is 200x400 centered horizontally
    expect(computeContainedFrame(400, 400, 100, 200)).toEqual({ x: 100, y: 0, width: 200, height: 400 });
  });

  it("always keeps the frame inside the box and at most box-sized", () => {
    const frame = computeContainedFrame(367, 251, 8192, 4096)!;
    expect(frame.width).toBeLessThanOrEqual(367);
    expect(frame.height).toBeLessThanOrEqual(251);
    expect(Math.abs((frame.width / frame.height) - (8192 / 4096))).toBeCloseTo(0, 5);
  });
});
