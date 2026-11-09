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

  it("setDriverType updates driver", () => {
    useCorruptionStore.getState().setDriverType("audio");
    expect(useCorruptionStore.getState().driverType).toBe("audio");
  });

  it("setNextLevelTime updates next level time", () => {
    const time = Date.now() + 60000;
    useCorruptionStore.getState().setNextLevelTime(time);
    expect(useCorruptionStore.getState().nextLevelTime).toBe(time);
  });

  it("reset restores default state", () => {
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
