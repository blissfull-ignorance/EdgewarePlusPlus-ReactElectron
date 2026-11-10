import { describe, expect, it } from "vitest";
import { collectSettingDangers } from "../../src/features/corruption/dangerFlags";

/**
 * Danger warnings must exist only while the dangerous value is actually set
 * (legacy Danger(DangerLevel, Schema(1)) semantics) — never merely because
 * the option exists in the config.
 */
describe("collectSettingDangers", () => {
  const safe: Record<string, unknown> = {
    fill: 0,
    replace: 0,
    panicDisabled: 0,
    timerMode: 0,
    startOnLogon: 0,
    showDiscord: 0,
    mitosisMode: 0,
    runOnSaveQuit: 0,
    delay: 5000,
    hibernateMode: 0,
    hibernateMin: 60000,
    hibernateMax: 120000,
    wakeupActivity: 10000,
  };

  it("reports nothing for a fully safe configuration", () => {
    expect(collectSettingDangers(safe)).toEqual([]);
  });

  it("reports nothing when keys are missing entirely", () => {
    expect(collectSettingDangers({})).toEqual([]);
  });

  it("reports fill drive only while it is on", () => {
    expect(collectSettingDangers({ ...safe, fill: 1 }).map((w) => w.key)).toContain("fill");
    expect(collectSettingDangers({ ...safe, fill: 0 })).toEqual([]);
  });

  it("reports replace images only while it is on", () => {
    expect(collectSettingDangers({ ...safe, replace: 1 }).map((w) => w.key)).toContain("replace");
  });

  it("reports mitosis mode only while it is on", () => {
    expect(collectSettingDangers({ ...safe, mitosisMode: 1 }).map((w) => w.key)).toContain(
      "mitosisMode"
    );
  });

  it("reports panic-disabled and lockout while armed", () => {
    const keys = collectSettingDangers({ ...safe, panicDisabled: 1, timerMode: 1, timerSetupTime: 5 })
      .map((w) => w.key);
    expect(keys).toContain("panicDisabled");
    expect(keys).toContain("timerMode");
  });

  it("reports a sub-2s popup delay", () => {
    expect(collectSettingDangers({ ...safe, delay: 1500 }).map((w) => w.key)).toContain("delay");
    expect(collectSettingDangers({ ...safe, delay: 0 })).toEqual([]);
    expect(collectSettingDangers({ ...safe, delay: 5000 })).toEqual([]);
  });

  it("reports short hibernate cooldowns only while hibernate mode is on", () => {
    expect(
      collectSettingDangers({ ...safe, hibernateMode: 1, hibernateMin: 10000 }).map((w) => w.key)
    ).toContain("hibernateMin");
    expect(collectSettingDangers({ ...safe, hibernateMode: 0, hibernateMin: 10000 })).toEqual([]);
  });

  it("keeps the legacy warning wording for enabled dangers", () => {
    const [warning] = collectSettingDangers({ ...safe, replace: 1 });
    expect(warning.message).toContain("THIS WILL DELETE FILES");
  });

  it("does not report the negated corruption cycle flags as dangers", () => {
    expect(
      collectSettingDangers({ ...safe, corruptionWallpaperCycle: 0, corruptionThemeCycle: 0 })
    ).toEqual([]);
  });
});
