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
  it("passes the level config through, empty when absent", () => {
    const base = { level: 1, addMoods: new MoodSet(), removeMoods: new MoodSet(), wallpaper: null };
    expect(computeConfigOverrides({ ...base, config: { popupMod: 50, delay: 2000 } })).toEqual({
      popupMod: 50,
      delay: 2000,
    });
    expect(computeConfigOverrides({ ...base, config: {} })).toEqual({});
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
  it("returns levels in ascending order; empty for none", () => {
    const levels = {
      3: {} as ParsedCorruptionLevel,
      1: {} as ParsedCorruptionLevel,
      2: {} as ParsedCorruptionLevel,
    };
    expect(getAvailableLevels(levels)).toEqual([1, 2, 3]);
    expect(getAvailableLevels({})).toEqual([]);
  });
});

// ── isConfigBlocked ────────────────────────────────────────────────────────────

describe("isConfigBlocked", () => {
  it("returns true for blocked keys", () => {
    expect(isConfigBlocked("safeMode")).toBe(true);
    expect(isConfigBlocked("drivePath")).toBe(true);
    expect(isConfigBlocked("timerMode")).toBe(true);
    expect(isConfigBlocked("safeword")).toBe(true);
    expect(isConfigBlocked("startOnLogon")).toBe(true);
    expect(isConfigBlocked("start_on_logon")).toBe(true);
  });

  it("returns false for unblocked keys", () => {
    expect(isConfigBlocked("popupMod")).toBe(false);
    expect(isConfigBlocked("audioMod")).toBe(false);
    expect(isConfigBlocked("panicDisabled")).toBe(false);
    expect(isConfigBlocked("fill")).toBe(false);
    expect(isConfigBlocked("delay")).toBe(false);
  });
});

describe("legacy wallpapers map (pack/load.py shape)", () => {
  const raw = {
    moods: {
      "1": { add: ["a"], remove: [] },
      "2": { add: [], remove: [] },
      "4": { add: [], remove: [], wallpaper: "own.png" },
    },
    wallpapers: { "1": "w1.png", "2": "w2.png", "4": "ignored.png", "14": "w14.png", default: "d.png" },
    config: { "13": { panicDisabled: 1 } },
  };
  const parsed = parseCorruptionData(raw);

  it("reads level wallpapers from the top-level map", () => {
    expect(parsed.levels[2].wallpaper).toBe("w2.png");
    expect(parsed.levels[14].wallpaper).toBe("w14.png");
  });

  it("prefers the level's own wallpaper entry over the map", () => {
    expect(parsed.levels[4].wallpaper).toBe("own.png");
  });

  it("applies the default wallpaper at level 1 only when the level has none", () => {
    expect(parsed.levels[1].wallpaper).toBe("w1.png");
    const noOwn = parseCorruptionData({
      moods: { "1": { add: [], remove: [] } },
      wallpapers: { default: "d.png" },
      config: {},
    });
    expect(noOwn.levels[1].wallpaper).toBe("d.png");
  });

  it("config-only levels still receive their wallpaper", () => {
    const onlyConfig = parseCorruptionData({
      moods: {},
      wallpapers: { "3": "w3.png" },
      config: { "3": { popupMod: 50 } },
    });
    expect(onlyConfig.levels[3].wallpaper).toBe("w3.png");
  });
});
