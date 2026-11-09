import { describe, expect, it } from "vitest";
import { collectCorruptionDangers, DANGER_REGISTRY } from "../../src/features/corruption/danger";

describe("collectCorruptionDangers", () => {
  it("returns zero for no levels", () => {
    expect(collectCorruptionDangers([])).toEqual({ count: 0, groups: [] });
  });

  it("ignores keys without danger rules and safe values", () => {
    const report = collectCorruptionDangers([
      { popupMod: 100, delay: 5000, unknownKey: 1 },
      null,
      undefined,
    ]);
    expect(report.count).toBe(0);
  });

  it("flags a dangerous value with its level and warning", () => {
    const report = collectCorruptionDangers([{ panicDisabled: 1 }]);
    expect(report.count).toBe(1);
    expect(report.groups[0].level).toBe("MINOR");
    expect(report.groups[0].warnings[0]).toContain("Panic Hotkey is disabled");
  });

  it("orders groups EXTREME → MINOR", () => {
    const report = collectCorruptionDangers([
      { panicDisabled: 1, timerMode: 1, replace: 1, fill: 1 },
    ]);
    expect(report.groups.map((g) => g.level)).toEqual(["EXTREME", "MAJOR", "MEDIUM", "MINOR"]);
    expect(report.count).toBe(4);
  });

  it("dedupes the same warning across levels", () => {
    const report = collectCorruptionDangers([{ replace: 1 }, { replace: 1 }, { replace: 1 }]);
    expect(report.count).toBe(1);
  });

  it("applies threshold rules, not just on/off", () => {
    expect(collectCorruptionDangers([{ delay: 500 }]).count).toBe(1);
    expect(collectCorruptionDangers([{ delay: 5000 }]).count).toBe(0);
    expect(collectCorruptionDangers([{ hibernateMin: 10 }]).count).toBe(1);
    expect(collectCorruptionDangers([{ hibernateMin: 60 }]).count).toBe(0);
    expect(collectCorruptionDangers([{ wakeupActivity: 40 }]).count).toBe(1);
    expect(collectCorruptionDangers([{ wakeupActivity: 1 }]).count).toBe(0);
  });

  it("falls back to the key name when a rule has no warning text", () => {
    const report = collectCorruptionDangers([{ delay: 100 }]);
    expect(report.groups[0].warnings[0]).toBe("delay");
  });

  it("covers the twelve legacy danger registry entries", () => {
    expect(Object.keys(DANGER_REGISTRY)).toHaveLength(12);
  });
});
