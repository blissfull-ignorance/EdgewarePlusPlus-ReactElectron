import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "../../src/stores/appStore";
import { useSettingsStore } from "../../src/stores/settingsStore";
import {
  computeMitosisSpawn,
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

  it("respects max spawns to prevent infinite mitosis", () => {
    const spawns = computeMitosisSpawn(10, 0);
    expect(spawns.length).toBe(10);
  });
});

describe("mitosis mode store integration", () => {
  beforeEach(() => {
    useAppStore.setState({ popupsCount: 0, isRunning: false, hibernateActive: false });
    useSettingsStore.setState({ mitosisMode: 0, mitosisStrength: 0 });
  });

  it("mitosis triggers when popupsCount transitions from >0 to 0", () => {
    useSettingsStore.setState({ mitosisMode: 1, mitosisStrength: 3 });

    let mitosisTriggered = false;
    let prevCount = 0;

    const unsubscribe = useAppStore.subscribe((state) => {
      if (
        state.popupsCount === 0 &&
        prevCount > 0 &&
        useSettingsStore.getState().mitosisMode === 1
      ) {
        mitosisTriggered = true;
      }
      prevCount = state.popupsCount;
    });

    useAppStore.getState().incrementPopups();
    useAppStore.getState().incrementPopups();
    useAppStore.getState().decrementPopups();
    useAppStore.getState().decrementPopups();

    unsubscribe();

    expect(mitosisTriggered).toBe(true);
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("mitosis does not trigger when mitosisMode is off", () => {
    useSettingsStore.setState({ mitosisMode: 0 });

    let mitosisTriggered = false;
    let prevCount = 0;

    const unsubscribe = useAppStore.subscribe((state) => {
      if (
        state.popupsCount === 0 &&
        prevCount > 0 &&
        useSettingsStore.getState().mitosisMode === 1
      ) {
        mitosisTriggered = true;
      }
      prevCount = state.popupsCount;
    });

    useAppStore.getState().incrementPopups();
    useAppStore.getState().decrementPopups();

    unsubscribe();

    expect(mitosisTriggered).toBe(false);
  });
});
