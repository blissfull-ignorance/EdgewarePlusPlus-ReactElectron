import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMockStorage } from "./setup";

describe("corruptionStore — error handling", () => {
  beforeEach(() => {
    vi.resetModules();
    clearMockStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadCorruptionData sets error when data is null", async () => {
    const { useCorruptionStore } = await import("../../src/stores/corruptionStore");
    useCorruptionStore.getState().loadCorruptionData(null as unknown as Record<string, unknown>);

    const state = useCorruptionStore.getState();
    expect(state.corruptionError).toContain("missing or invalid");
  });

  it("loadCorruptionData sets error when data is not an object", async () => {
    const { useCorruptionStore } = await import("../../src/stores/corruptionStore");
    useCorruptionStore.getState().loadCorruptionData("not an object" as unknown as Record<string, unknown>);

    const state = useCorruptionStore.getState();
    expect(state.corruptionError).toContain("missing or invalid");
  });

  it("loadCorruptionData sets error when no levels found", async () => {
    const { useCorruptionStore } = await import("../../src/stores/corruptionStore");
    useCorruptionStore.getState().loadCorruptionData({
      moods: { "1": { add: ["stale"], remove: [] } },
    });
    useCorruptionStore.getState().loadCorruptionData({});

    const state = useCorruptionStore.getState();
    expect(state.corruptionError).toContain("No corruption levels found");
    expect(Object.keys(state.levels)).toHaveLength(0);
  });

  it("loadCorruptionData clears error on successful load", async () => {
    const { useCorruptionStore } = await import("../../src/stores/corruptionStore");
    useCorruptionStore.getState().loadCorruptionData({
      moods: {
        "1": {
          add: ["mood1"],
          remove: [],
        },
      },
    });

    const state = useCorruptionStore.getState();
    expect(state.corruptionError).toBeNull();
    expect(Object.keys(state.levels)).toContain("1");
  });

  it("reset clears corruptionError", async () => {
    const { useCorruptionStore } = await import("../../src/stores/corruptionStore");
    useCorruptionStore.getState().loadCorruptionData(null as unknown as Record<string, unknown>);
    useCorruptionStore.getState().reset();

    const state = useCorruptionStore.getState();
    expect(state.corruptionError).toBeNull();
    expect(state.currentLevel).toBe(0);
    expect(state.activeMoods).toEqual([]);
  });

});
