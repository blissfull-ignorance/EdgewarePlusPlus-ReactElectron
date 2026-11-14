import { describe, expect, it } from "vitest";
import { collectSpawnBlockers } from "../../src/features/popup/spawnWarning";
import { DEFAULT_SETTINGS, useSettingsStore } from "../../src/stores/settingsStore";

function settings(over: Record<string, unknown> = {}) {
  return { ...DEFAULT_SETTINGS, ...over } as ReturnType<typeof useSettingsStore.getState>;
}

const allZero = {
  popupMod: 0,
  vidMod: 0,
  audioMod: 0,
  promptMod: 0,
  capPopChance: 0,
  webMod: 0,
  notificationChance: 0,
};

describe("collectSpawnBlockers", () => {
  it("passes a normal setup", () => {
    expect(collectSpawnBlockers(settings(), false)).toEqual([]);
  });

  it("flags every popup chance at zero on a scriptless pack", () => {
    const issues = collectSpawnBlockers(settings(allZero), false);
    expect(issues.join(" ")).toContain("Every popup chance is 0%");
  });

  it("stays quiet on all-zero chances when the pack script drives popups", () => {
    expect(collectSpawnBlockers(settings(allZero), true)).toEqual([]);
  });

  it("passes when any single type can still spawn", () => {
    expect(collectSpawnBlockers(settings({ popupMod: 0, vidMod: 40 }), false)).toEqual([]);
  });

  it("flags a huge spawn delay (the leftover-from-pack case)", () => {
    const issues = collectSpawnBlockers(settings({ delay: 12500 }), false);
    expect(issues.join(" ")).toContain("Spawn Delay");
    expect(issues.join(" ")).toContain("12.5s");
  });

  it("does not flag the delay when no chance can fire anyway", () => {
    const issues = collectSpawnBlockers(settings({ ...allZero, delay: 30000 }), false);
    expect(issues.join(" ")).not.toContain("Spawn Delay");
  });

  it("flags an instant auto-close", () => {
    const issues = collectSpawnBlockers(settings({ timeoutPopups: 1, popupTimeout: 100 }), false);
    expect(issues.join(" ")).toContain("auto-close");
  });

  it("ignores the auto-close timeout while the feature is off", () => {
    expect(collectSpawnBlockers(settings({ timeoutPopups: 0, popupTimeout: 100 }), false)).toEqual([]);
  });
});

describe("collectSpawnBlockers with hibernate mode", () => {
  it("does not flag a slow roll delay — bursts replace the roll loop", () => {
    expect(
      collectSpawnBlockers(settings({ delay: 60000, hibernateMode: 1, popupMod: 100 }), false)
    ).toEqual([]);
  });

  it("still flags all-zero chances — bursts roll the same chances", () => {
    const issues = collectSpawnBlockers(settings({ ...allZero, hibernateMode: 1 }), false);
    expect(issues.join(" ")).toContain("Every popup chance is 0%");
  });
});
