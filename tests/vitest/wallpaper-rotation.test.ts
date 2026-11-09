import { describe, expect, it } from "vitest";
import {
  parseWallpaperDat,
  nextWallpaperPick,
  rotationDelay,
} from "../../src/features/wallpaper/rotation";

describe("parseWallpaperDat", () => {
  it("reads JSON object values", () => {
    expect(parseWallpaperDat('{"a":"one.jpg","b":"two.png"}')).toEqual(["one.jpg", "two.png"]);
  });

  it("accepts the legacy Python-literal spelling with single quotes", () => {
    expect(parseWallpaperDat("{'a': 'one.jpg'}")).toEqual(["one.jpg"]);
  });

  it("returns empty for blank, malformed or non-object input", () => {
    expect(parseWallpaperDat("")).toEqual([]);
    expect(parseWallpaperDat("not json")).toEqual([]);
    expect(parseWallpaperDat("[1,2]")).toEqual([]);
    expect(parseWallpaperDat('{"a": 3}')).toEqual([]);
  });

  it("drops blank filenames", () => {
    expect(parseWallpaperDat('{"a":"one.jpg","b":"  "}')).toEqual(["one.jpg"]);
  });
});

describe("nextWallpaperPick", () => {
  it("returns null for an empty list", () => {
    expect(nextWallpaperPick([], null)).toBeNull();
  });

  it("never repeats the previous wallpaper while others exist", () => {
    for (let i = 0; i < 50; i++) {
      expect(nextWallpaperPick(["a", "b", "c"], "b", Math.random)).not.toBe("b");
    }
  });

  it("repeats when only one candidate exists", () => {
    expect(nextWallpaperPick(["only"], "only")).toBe("only");
  });

  it("spreads across candidates", () => {
    expect(nextWallpaperPick(["a", "b"], null, () => 0.99)).toBe("b");
  });
});

describe("rotationDelay", () => {
  it("applies jitter within +/- variance", () => {
    expect(rotationDelay(10000, 1000, () => 0)).toBe(9000);
    expect(rotationDelay(10000, 1000, () => 1)).toBe(11000);
    expect(rotationDelay(10000, 0, () => 0.5)).toBe(10000);
  });

  it("floors at one second", () => {
    expect(rotationDelay(0, 0, () => 0.5)).toBe(1000);
  });
});
