import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCorruptionMode } from "../../src/hooks/useCorruptionMode";
import { useCorruptionStore } from "../../src/stores/corruptionStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

vi.mock("../../src/stores/corruptionStore", () => ({
  useCorruptionStore: vi.fn(),
  getNextCorruptionLevel: vi.fn(),
}));

vi.mock("../../src/stores/settingsStore", () => ({
  useSettingsStore: vi.fn(),
}));

function mockCorruptionStore(state: Partial<ReturnType<typeof useCorruptionStore.getState>>) {
  (useCorruptionStore as ReturnType<typeof vi.fn>).mockImplementation((fn: (s: unknown) => unknown) =>
    fn(state)
  );
}

function mockSettingsStore(state: Partial<ReturnType<typeof useSettingsStore.getState>>) {
  (useSettingsStore as ReturnType<typeof vi.fn>).mockImplementation((fn: (s: unknown) => unknown) =>
    fn(state)
  );
}

describe("useCorruptionMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct level and moods list", () => {
    mockCorruptionStore({
      currentLevel: 2,
      activeMoods: ["dominant", "submissive"],
      nextLevelTime: Date.now() + 60000,
      driverType: "timer",
      transitionTo: vi.fn(),
      setDriverType: vi.fn(),
      setNextLevelTime: vi.fn(),
      loadCorruptionData: vi.fn(),
      reset: vi.fn(),
    });
    mockSettingsStore({ corruptionMode: 1 });

    const { result } = renderHook(() => useCorruptionMode());

    expect(result.current.level).toBe(2);
    expect(result.current.activeMoods).toEqual(["dominant", "submissive"]);
    expect(result.current.driverType).toBe("timer");
    expect(result.current.activeCorruption).toBe(true);
  });

  it("activeCorruption is false when corruptionMode is 0", () => {
    mockCorruptionStore({
      currentLevel: 0,
      activeMoods: [],
      nextLevelTime: null,
      driverType: "timer",
      transitionTo: vi.fn(),
      setDriverType: vi.fn(),
      setNextLevelTime: vi.fn(),
      loadCorruptionData: vi.fn(),
      reset: vi.fn(),
    });
    mockSettingsStore({ corruptionMode: 0 });

    const { result } = renderHook(() => useCorruptionMode());
    expect(result.current.activeCorruption).toBe(false);
  });

  it("exposes transitionTo function", () => {
    const mockTransitionTo = vi.fn().mockReturnValue({ popupMod: 50 });
    mockCorruptionStore({
      currentLevel: 0,
      activeMoods: [],
      nextLevelTime: null,
      driverType: "timer",
      transitionTo: mockTransitionTo,
      setDriverType: vi.fn(),
      setNextLevelTime: vi.fn(),
      loadCorruptionData: vi.fn(),
      reset: vi.fn(),
    });
    mockSettingsStore({ corruptionMode: 1 });

    const { result } = renderHook(() => useCorruptionMode());
    const overrides = result.current.transitionTo(1);
    expect(mockTransitionTo).toHaveBeenCalledWith(1);
    expect(overrides).toEqual({ popupMod: 50 });
  });

  it("exposes setDriverType and setNextLevelTime", () => {
    const mockSetDriverType = vi.fn();
    const mockSetNextLevelTime = vi.fn();
    mockCorruptionStore({
      currentLevel: 0,
      activeMoods: [],
      nextLevelTime: null,
      driverType: "timer",
      transitionTo: vi.fn(),
      setDriverType: mockSetDriverType,
      setNextLevelTime: mockSetNextLevelTime,
      loadCorruptionData: vi.fn(),
      reset: vi.fn(),
    });
    mockSettingsStore({ corruptionMode: 1 });

    const { result } = renderHook(() => useCorruptionMode());
    result.current.setDriverType("audio");
    expect(mockSetDriverType).toHaveBeenCalledWith("audio");

    result.current.setNextLevelTime(12345);
    expect(mockSetNextLevelTime).toHaveBeenCalledWith(12345);
  });
});
