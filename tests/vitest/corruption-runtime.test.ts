import { describe, expect, it } from "vitest";
import {
  nextLevelFor,
  startLevelFor,
  computeLaunchLevel,
  gateOverrides,
} from "../../src/features/corruption/runtime";

describe("nextLevelFor", () => {
  it("walks up and clamps at the highest level", () => {
    expect(nextLevelFor(1, 3, false)).toBe(2);
    expect(nextLevelFor(3, 3, false)).toBe(3);
  });

  it("eases down in purity mode and clamps at 1", () => {
    expect(nextLevelFor(3, 3, true)).toBe(2);
    expect(nextLevelFor(1, 3, true)).toBe(1);
  });
});

describe("startLevelFor", () => {
  it("starts at 1 normally and at the max in purity mode", () => {
    expect(startLevelFor(4, false)).toBe(1);
    expect(startLevelFor(4, true)).toBe(4);
  });
});

describe("computeLaunchLevel", () => {
  it("replays the legacy loop: first launch (count 1) reaches level 2", () => {
    // Legacy quirk kept: the i=0 comparison (1 >= 0) always advances once.
    expect(computeLaunchLevel(1, 2, 4)).toBe(2);
  });

  it("advances one more level per full launches threshold", () => {
    expect(computeLaunchLevel(2, 2, 4)).toBe(3);
    expect(computeLaunchLevel(4, 2, 4)).toBe(4);
  });

  it("clamps at the highest level", () => {
    expect(computeLaunchLevel(100, 2, 3)).toBe(3);
  });
});

describe("gateOverrides", () => {
  it("drops everything without full permission", () => {
    expect(gateOverrides({ delay: 500 }, { fullPerm: false, themeCycle: true })).toEqual({});
  });

  it("passes overrides with full permission", () => {
    expect(gateOverrides({ delay: 500 }, { fullPerm: true, themeCycle: false })).toEqual({
      delay: 500,
    });
  });

  it("gates themeType behind the theme cycle grant", () => {
    expect(gateOverrides({ themeType: "x" }, { fullPerm: true, themeCycle: false })).toEqual({});
    expect(gateOverrides({ themeType: "x" }, { fullPerm: true, themeCycle: true })).toEqual({
      themeType: "x",
    });
  });
});
