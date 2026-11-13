import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "../../src/stores/appStore";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { act, renderHook } from "@testing-library/react";
import {
  computeMitosisSpawn,
  useMitosis,
  weightedPopupRoll,
} from "../../src/features/mitosis/useMitosis";

describe("weightedPopupRoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'image' or 'video'", () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = weightedPopupRoll(seed);
      expect(["image", "video"]).toContain(result);
    }
  });

  it("is deterministic with same seed", () => {
    expect(weightedPopupRoll(0)).toBe(weightedPopupRoll(0));
    expect(weightedPopupRoll(42)).toBe(weightedPopupRoll(42));
  });

  it("both types appear over many iterations", () => {
    const results = [];
    for (let seed = 0; seed < 100; seed++) {
      results.push(weightedPopupRoll(seed));
    }
    const hasImage = results.includes("image");
    const hasVideo = results.includes("video");
    expect(hasImage).toBe(true);
    expect(hasVideo).toBe(true);
  });
});

describe("computeMitosisSpawn", () => {
  beforeEach(() => {
    useAppStore.setState({ popupsCount: 0, isRunning: false, hibernateActive: false });
    useSettingsStore.setState({ mitosisMode: 1, mitosisStrength: 5 });
  });

  it("returns spawn list of length equal to mitosisStrength", () => {
    const spawns = computeMitosisSpawn(5, 0);
    expect(spawns.length).toBe(5);
  });

  it("returns empty array when strength is 0", () => {
    const spawns = computeMitosisSpawn(0, 0);
    expect(spawns.length).toBe(0);
  });

  it("each spawn has valid type", () => {
    const spawns = computeMitosisSpawn(3, 42);
    for (const spawn of spawns) {
      expect(["image", "video"]).toContain(spawn.type);
    }
  });

  it("ignores popupsCount — computeMitosisSpawn is a pure function, gating is done by useMitosis hook", () => {
    useAppStore.getState().incrementPopups();
    useAppStore.getState().incrementPopups();
    const spawns = computeMitosisSpawn(3, 0);
    expect(spawns.length).toBe(3);
  });

  it("caps spawns at 10 regardless of strength", () => {
    expect(computeMitosisSpawn(10, 0)).toHaveLength(10);
    expect(computeMitosisSpawn(20, 0)).toHaveLength(10);
  });
});

describe("useMitosis hook (the real trigger)", () => {
  beforeEach(() => {
    useAppStore.setState({ popupsCount: 0, isRunning: false, hibernateActive: false });
    useSettingsStore.setState({ mitosisMode: 1, mitosisStrength: 3 });
  });

  function renderMitosis() {
    const onSpawn = vi.fn();
    const view = renderHook(() => useMitosis({ onSpawn }));
    return { onSpawn, ...view };
  }

  function transitionToZero(rerender: () => void) {
    act(() => useAppStore.setState({ popupsCount: 1 }));
    rerender();
    act(() => useAppStore.setState({ popupsCount: 0 }));
    rerender();
  }

  it("fires once with strength-many spawns on a >0→0 transition", () => {
    const { onSpawn, rerender } = renderMitosis();
    transitionToZero(rerender);
    expect(onSpawn).toHaveBeenCalledTimes(1);
    expect(onSpawn.mock.calls[0][0]).toHaveLength(3);
  });

  it("stays silent when mitosisMode is off", () => {
    useSettingsStore.setState({ mitosisMode: 0 });
    const { onSpawn, rerender } = renderMitosis();
    transitionToZero(rerender);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it("stays silent at strength 0", () => {
    useSettingsStore.setState({ mitosisStrength: 0 });
    const { onSpawn, rerender } = renderMitosis();
    transitionToZero(rerender);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it("does not fire on the initial render at zero", () => {
    const { onSpawn } = renderMitosis();
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it("fires again on a second cycle", () => {
    const { onSpawn, rerender } = renderMitosis();
    transitionToZero(rerender);
    transitionToZero(rerender);
    expect(onSpawn).toHaveBeenCalledTimes(2);
  });
});
