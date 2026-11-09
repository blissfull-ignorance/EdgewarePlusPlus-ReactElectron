import { describe, expect, it } from "vitest";
import { lowkeyPosition } from "../../src/features/popup/lowkeyPosition";
import { toKeyboardCode } from "../../electron/utils/panicKeys";

const BOUNDS = { x: 0, y: 0, width: 1920, height: 1080 };

describe("lowkeyPosition", () => {
  it("maps the legacy corner indices", () => {
    expect(lowkeyPosition(0, BOUNDS, 400, 300)).toEqual({ x: 1520, y: 0 });
    expect(lowkeyPosition(1, BOUNDS, 400, 300)).toEqual({ x: 0, y: 0 });
    expect(lowkeyPosition(2, BOUNDS, 400, 300)).toEqual({ x: 0, y: 780 });
    expect(lowkeyPosition(3, BOUNDS, 400, 300)).toEqual({ x: 1520, y: 780 });
  });

  it("picks one of the four corners for the random setting", () => {
    const corners = new Set([0, 1, 2, 3].map((c) => JSON.stringify(lowkeyPosition(c, BOUNDS, 400, 300))));
    for (const r of [0, 0.24, 0.5, 0.74, 0.99]) {
      const pos = JSON.stringify(lowkeyPosition(4, BOUNDS, 400, 300, () => r));
      expect(corners.has(pos)).toBe(true);
    }
  });

  it("honours monitor offsets", () => {
    const bounds = { x: 1920, y: 0, width: 1920, height: 1080 };
    expect(lowkeyPosition(1, bounds, 400, 300)).toEqual({ x: 1920, y: 0 });
  });

  it("returns null for out-of-range corners", () => {
    expect(lowkeyPosition(5, BOUNDS, 400, 300)).toBeNull();
    expect(lowkeyPosition(-1, BOUNDS, 400, 300)).toBeNull();
  });
});

describe("toKeyboardCode", () => {
  it("maps legacy pynput names to DOM event codes", () => {
    expect(toKeyboardCode("Key.esc")).toBe("Escape");
    expect(toKeyboardCode("Key.f9")).toBe("F9");
    expect(toKeyboardCode("Key.space")).toBe("Space");
    expect(toKeyboardCode("Key.e")).toBe("KeyE");
    expect(toKeyboardCode("e")).toBe("KeyE");
    expect(toKeyboardCode("5")).toBe("Digit5");
  });

  it("returns null for empty or unusable values", () => {
    expect(toKeyboardCode("")).toBeNull();
    expect(toKeyboardCode("Key.")).toBeNull();
    expect(toKeyboardCode("Key.unknownthing")).toBeNull();
  });
});
