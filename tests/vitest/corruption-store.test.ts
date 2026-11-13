import { describe, expect, it, beforeEach } from "vitest";
import { useCorruptionStore, getNextCorruptionLevel } from "../../src/stores/corruptionStore";

beforeEach(() => {
  useCorruptionStore.getState().reset();
});

describe("useCorruptionStore", () => {
  it("starts with default state", () => {
    const state = useCorruptionStore.getState();
    expect(state.currentLevel).toBe(0);
    expect(state.activeMoods).toEqual([]);
    expect(state.nextLevelTime).toBeNull();
    expect(state.driverType).toBe("timer");
    expect(state.transitions).toEqual([]);
    expect(state.levels).toEqual({});
  });

  it("loads corruption data from raw JSON", () => {
    const raw = {
      moods: {
        "1": { add: ["submissive", "beginner"], remove: [] },
        "2": { add: ["dominant"], remove: ["submissive"] },
      },
      config: {
        "1": { popupMod: 40, audioMod: 30 },
        "2": { popupMod: 50, audioMod: 50 },
      },
    };
    useCorruptionStore.getState().loadCorruptionData(raw);

    const state = useCorruptionStore.getState();
    expect(Object.keys(state.levels)).toHaveLength(2);
    expect(state.levels[1].addMoods.has("submissive")).toBe(true);
    expect(state.levels[1].config).toEqual({ popupMod: 40, audioMod: 30 });
  });

  it("transitionTo applies mood changes", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: {
        "1": { add: ["submissive", "beginner"], remove: [] },
        "2": { add: ["dominant"], remove: ["submissive"] },
      },
    });

    useCorruptionStore.getState().transitionTo(1);
    let state = useCorruptionStore.getState();
    expect(state.currentLevel).toBe(1);
    expect(state.activeMoods).toContain("submissive");
    expect(state.activeMoods).toContain("beginner");

    useCorruptionStore.getState().transitionTo(2);
    state = useCorruptionStore.getState();
    expect(state.currentLevel).toBe(2);
    expect(state.activeMoods).not.toContain("submissive");
    expect(state.activeMoods).toContain("beginner");
    expect(state.activeMoods).toContain("dominant");
  });

  it("transitionTo returns config overrides", () => {
    useCorruptionStore.getState().loadCorruptionData({
      config: {
        "1": { popupMod: 40, audioMod: 30 },
      },
    });

    const overrides = useCorruptionStore.getState().transitionTo(1);
    expect(overrides).toEqual({ popupMod: 40, audioMod: 30 });
  });

  it("chains three levels with cumulative moods and per-level overrides", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: {
        "1": { add: ["submissive", "beginner"], remove: [] },
        "2": { add: ["dominant"], remove: ["submissive"] },
        "3": { add: ["intense"], remove: ["beginner"] },
      },
      config: {
        "1": { popupMod: 40 },
        "2": { popupMod: 50, audioMod: 50 },
        "3": { popupMod: 80 },
      },
    });

    expect(useCorruptionStore.getState().transitionTo(1)).toEqual({ popupMod: 40 });
    const o2 = useCorruptionStore.getState().transitionTo(2);
    expect(o2).toEqual({ popupMod: 50, audioMod: 50 });
    expect(useCorruptionStore.getState().activeMoods).toEqual(
      expect.arrayContaining(["beginner", "dominant"])
    );
    expect(useCorruptionStore.getState().activeMoods).not.toContain("submissive");
    expect(useCorruptionStore.getState().transitionTo(3)).toEqual({ popupMod: 80 });
    expect(useCorruptionStore.getState().activeMoods).not.toContain("beginner");
    expect(useCorruptionStore.getState().activeMoods).toContain("intense");
  });

  it("transitionTo records transitions", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: {
        "1": { add: ["a"], remove: [] },
        "2": { add: ["b"], remove: ["a"] },
      },
    });

    useCorruptionStore.getState().transitionTo(1);
    useCorruptionStore.getState().transitionTo(2);

    const state = useCorruptionStore.getState();
    expect(state.transitions).toEqual(["0→1", "1→2"]);
  });

  it("transitionTo to unknown level sets level but returns empty config", () => {
    const overrides = useCorruptionStore.getState().transitionTo(99);
    const state = useCorruptionStore.getState();
    expect(state.currentLevel).toBe(99);
    expect(overrides).toEqual({});
  });

  it("reset restores default state", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: { "1": { add: ["test"], remove: [] } },
    });
    useCorruptionStore.getState().setDriverType("script");
    useCorruptionStore.getState().setNextLevelTime(12345);
    useCorruptionStore.getState().transitionTo(1);

    useCorruptionStore.getState().reset();
    const state = useCorruptionStore.getState();
    expect(state.currentLevel).toBe(0);
    expect(state.activeMoods).toEqual([]);
    expect(state.nextLevelTime).toBeNull();
    expect(state.driverType).toBe("timer");
    expect(state.transitions).toEqual([]);
    expect(Object.keys(state.levels)).toHaveLength(0);
  });

  it("session state never persists to storage", () => {
    // The store deliberately has no persist middleware: boot must never
    // resurrect a previous run's moods or level (creator-round fix).
    // A zustand persisted store exposes a .persist api; its absence pins
    // the invariant regardless of the test environment's storage.
    expect((useCorruptionStore as unknown as { persist?: unknown }).persist).toBeUndefined();
  });

  it("getNextCorruptionLevel returns the next level", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: {
        "1": { add: ["a"], remove: [] },
        "2": { add: ["b"], remove: [] },
        "3": { add: ["c"], remove: [] },
      },
    });

    useCorruptionStore.getState().transitionTo(1);
    expect(getNextCorruptionLevel()).toBe(2);

    useCorruptionStore.getState().transitionTo(2);
    expect(getNextCorruptionLevel()).toBe(3);

    useCorruptionStore.getState().transitionTo(3);
    expect(getNextCorruptionLevel()).toBeNull();
  });
});

describe("startLevelOverride (testing aid)", () => {
  it("is 0 by default, clamps to a non-negative integer and survives reset", () => {
    useCorruptionStore.getState().setStartLevelOverride(7);
    expect(useCorruptionStore.getState().startLevelOverride).toBe(7);
    useCorruptionStore.getState().setStartLevelOverride(-3);
    expect(useCorruptionStore.getState().startLevelOverride).toBe(0);
    useCorruptionStore.getState().setStartLevelOverride(2.9);
    expect(useCorruptionStore.getState().startLevelOverride).toBe(2);
    useCorruptionStore.getState().setStartLevelOverride(5);
    useCorruptionStore.getState().reset();
    expect(useCorruptionStore.getState().startLevelOverride).toBe(5);
    useCorruptionStore.getState().setStartLevelOverride(0);
  });
});
