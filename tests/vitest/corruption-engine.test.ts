import { describe, expect, it } from "vitest";
import {
  parseCorruptionData,
  computeActiveMoods,
  computeConfigOverrides,
  getNextLevel,
  getAvailableLevels,
  isConfigBlocked,
  type ParsedCorruptionLevel,
} from "../../src/features/corruption/corruptionEngine";
import { MoodSet } from "../../src/types/pack";

// ── parseCorruptionData ────────────────────────────────────────────────────────

describe("parseCorruptionData", () => {
  it("parses empty data", () => {
    const result = parseCorruptionData({});
    expect(result.levels).toEqual({});
  });

  it("parses moods-only format", () => {
    const raw = {
      moods: {
        "1": { add: ["submissive", "beginner"], remove: [] },
        "2": { add: ["dominant"], remove: ["submissive"] },
      },
    };
    const result = parseCorruptionData(raw);

    expect(Object.keys(result.levels)).toHaveLength(2);
    expect(result.levels[1].addMoods.has("submissive")).toBe(true);
    expect(result.levels[1].addMoods.has("beginner")).toBe(true);
    expect(result.levels[1].removeMoods.size).toBe(0);
    expect(result.levels[2].addMoods.has("dominant")).toBe(true);
    expect(result.levels[2].removeMoods.has("submissive")).toBe(true);
    expect(result.levels[1].wallpaper).toBeNull();
    expect(result.levels[1].config).toEqual({});
  });

  it("parses config-only format", () => {
    const raw = {
      config: {
        "1": { popupMod: 40, audioMod: 30 },
        "2": { popupMod: 50, audioMod: 50 },
      },
    };
    const result = parseCorruptionData(raw);

    expect(result.levels[1].config).toEqual({ popupMod: 40, audioMod: 30 });
    expect(result.levels[2].config).toEqual({ popupMod: 50, audioMod: 50 });
    expect(result.levels[1].addMoods.size).toBe(0);
    expect(result.levels[1].removeMoods.size).toBe(0);
  });

  it("parses combined moods and config format", () => {
    const raw = {
      moods: {
        "1": { add: ["mood1"], remove: [] },
        "2": { add: ["mood2"], remove: ["mood1"] },
      },
      config: {
        "1": { popupMod: 40 },
        "2": { popupMod: 50, delay: 3000 },
      },
    };
    const result = parseCorruptionData(raw);

    expect(result.levels[1].addMoods.has("mood1")).toBe(true);
    expect(result.levels[1].config).toEqual({ popupMod: 40 });
    expect(result.levels[2].addMoods.has("mood2")).toBe(true);
    expect(result.levels[2].removeMoods.has("mood1")).toBe(true);
    expect(result.levels[2].config).toEqual({ popupMod: 50, delay: 3000 });
  });

  it("includes wallpaper from mood level data", () => {
    const raw = {
      moods: {
        "1": { add: [], remove: [], wallpaper: "wallpaper.png" },
      },
    };
    const result = parseCorruptionData(raw);
    expect(result.levels[1].wallpaper).toBe("wallpaper.png");
  });

  it("filters blocked config keys", () => {
    const raw = {
      config: {
        "1": { popupMod: 40, safeMode: 1, delay: 3000 },
      },
    };
    const result = parseCorruptionData(raw);

    expect(result.levels[1].config).toEqual({ popupMod: 40, delay: 3000 });
    expect(result.levels[1].config).not.toHaveProperty("safeMode");
  });

  it("handles missing fields gracefully", () => {
    const raw = {
      moods: {
        "1": {},
      },
    };
    const result = parseCorruptionData(raw);
    expect(result.levels[1].addMoods.size).toBe(0);
    expect(result.levels[1].removeMoods.size).toBe(0);
  });

  it("skips non-numeric level keys", () => {
    const raw = {
      moods: {
        "abc": { add: ["bad"], remove: [] },
        "1": { add: ["good"], remove: [] },
      },
    };
    const result = parseCorruptionData(raw);
    expect(Object.keys(result.levels)).toHaveLength(1);
    expect(result.levels[1].addMoods.has("good")).toBe(true);
  });
});

// ── computeActiveMoods ─────────────────────────────────────────────────────────

describe("computeActiveMoods", () => {
  function makeLevel(add: string[], remove: string[]): ParsedCorruptionLevel {
    return {
      level: 1,
      addMoods: new MoodSet(add),
      removeMoods: new MoodSet(remove),
      wallpaper: null,
      config: {},
    };
  }

  it("adds moods to an empty set", () => {
    const result = computeActiveMoods([], makeLevel(["a", "b"], []));
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result.length).toBe(2);
  });

  it("removes moods from existing set", () => {
    const result = computeActiveMoods(["a", "b", "c"], makeLevel([], ["b"]));
    expect(result).toContain("a");
    expect(result).not.toContain("b");
    expect(result).toContain("c");
  });

  it("adds and removes in the same transition", () => {
    const result = computeActiveMoods(
      ["submissive", "beginner"],
      makeLevel(["dominant"], ["submissive"])
    );
    expect(result).not.toContain("submissive");
    expect(result).toContain("beginner");
    expect(result).toContain("dominant");
  });

  it("does not mutate the input array", () => {
    const original = ["a", "b"];
    const originalCopy = [...original];
    computeActiveMoods(original, makeLevel(["c"], ["a"]));
    expect(original).toEqual(originalCopy);
  });

  it("returns empty array when all moods removed", () => {
    const result = computeActiveMoods(["a"], makeLevel([], ["a"]));
    expect(result).toEqual([]);
  });
});

// ── computeConfigOverrides ─────────────────────────────────────────────────────

describe("computeConfigOverrides", () => {
  it("returns the config from the level data", () => {
    const level: ParsedCorruptionLevel = {
      level: 1,
      addMoods: new MoodSet(),
      removeMoods: new MoodSet(),
      wallpaper: null,
      config: { popupMod: 50, delay: 2000 },
    };
    const result = computeConfigOverrides(level);
    expect(result).toEqual({ popupMod: 50, delay: 2000 });
  });

  it("returns empty object for level with no config", () => {
    const level: ParsedCorruptionLevel = {
      level: 1,
      addMoods: new MoodSet(),
      removeMoods: new MoodSet(),
      wallpaper: null,
      config: {},
    };
    expect(computeConfigOverrides(level)).toEqual({});
  });
});

// ── getNextLevel ───────────────────────────────────────────────────────────────

describe("getNextLevel", () => {
  it("returns the next level number", () => {
    const levels = {
      1: {} as ParsedCorruptionLevel,
      2: {} as ParsedCorruptionLevel,
      3: {} as ParsedCorruptionLevel,
    };
    expect(getNextLevel(levels, 1)).toBe(2);
    expect(getNextLevel(levels, 2)).toBe(3);
  });

  it("returns null at the last level", () => {
    const levels = {
      1: {} as ParsedCorruptionLevel,
      2: {} as ParsedCorruptionLevel,
    };
    expect(getNextLevel(levels, 2)).toBeNull();
  });

  it("returns null for empty levels", () => {
    expect(getNextLevel({}, 0)).toBeNull();
  });

  it("returns null for unknown current level", () => {
    const levels = {
      1: {} as ParsedCorruptionLevel,
    };
    expect(getNextLevel(levels, 5)).toBeNull();
  });

  it("handles non-sequential levels", () => {
    const levels = {
      1: {} as ParsedCorruptionLevel,
      3: {} as ParsedCorruptionLevel,
      7: {} as ParsedCorruptionLevel,
    };
    expect(getNextLevel(levels, 1)).toBe(3);
    expect(getNextLevel(levels, 3)).toBe(7);
    expect(getNextLevel(levels, 7)).toBeNull();
  });
});

// ── getAvailableLevels ─────────────────────────────────────────────────────────

describe("getAvailableLevels", () => {
  it("returns levels in ascending order", () => {
    const levels = {
      3: {} as ParsedCorruptionLevel,
      1: {} as ParsedCorruptionLevel,
      2: {} as ParsedCorruptionLevel,
    };
    expect(getAvailableLevels(levels)).toEqual([1, 2, 3]);
  });

  it("returns empty array for no levels", () => {
    expect(getAvailableLevels({})).toEqual([]);
  });
});

// ── isConfigBlocked ────────────────────────────────────────────────────────────

describe("isConfigBlocked", () => {
  it("returns true for blocked keys", () => {
    expect(isConfigBlocked("safeMode")).toBe(true);
    expect(isConfigBlocked("drivePath")).toBe(true);
    expect(isConfigBlocked("panicDisabled")).toBe(true);
  });

  it("returns false for unblocked keys", () => {
    expect(isConfigBlocked("popupMod")).toBe(false);
    expect(isConfigBlocked("audioMod")).toBe(false);
    expect(isConfigBlocked("delay")).toBe(false);
  });
});
