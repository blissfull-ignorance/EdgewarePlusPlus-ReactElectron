import { describe, expect, it, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCorruptionMode } from "../../src/hooks/useCorruptionMode";
import { useCorruptionStore } from "../../src/stores/corruptionStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("useCorruptionMode", () => {
  beforeEach(() => {
    useCorruptionStore.getState().reset();
    useSettingsStore.setState({ corruptionMode: 0 });
  });

  it("derives activeCorruption from the corruptionMode setting", () => {
    const { result, rerender } = renderHook(() => useCorruptionMode());
    expect(result.current.activeCorruption).toBe(false);

    useSettingsStore.setState({ corruptionMode: 1 });
    rerender(() => useCorruptionMode());
    expect(result.current.activeCorruption).toBe(true);
  });

  it("exposes nextLevel only while corruption is active", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: {
        "1": { add: ["a"], remove: [] },
        "2": { add: ["b"], remove: [] },
      },
    });
    useCorruptionStore.getState().transitionTo(1);

    // Inactive: no next level is advertised.
    const off = renderHook(() => useCorruptionMode());
    expect(off.result.current.nextLevel).toBeNull();

    useSettingsStore.setState({ corruptionMode: 1 });
    const on = renderHook(() => useCorruptionMode());
    expect(on.result.current.nextLevel).toBe(2);
    expect(on.result.current.level).toBe(1);
    expect(on.result.current.activeMoods).toContain("a");
  });

  it("transitionTo drives the real store and returns its overrides", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: { "1": { add: ["a"], remove: [] } },
      config: { "1": { popupMod: 50 } },
    });
    useSettingsStore.setState({ corruptionMode: 1 });

    const { result } = renderHook(() => useCorruptionMode());
    expect(result.current.transitionTo(1)).toEqual({ popupMod: 50 });
    expect(useCorruptionStore.getState().currentLevel).toBe(1);
    expect(useCorruptionStore.getState().activeMoods).toContain("a");
  });
});
