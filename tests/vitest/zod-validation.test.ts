import { describe, expect, it } from "vitest";
import { validateSettings } from "../../src/utils/zodValidation";

describe("validateSettings", () => {
  it("returns empty array for valid settings", () => {
    const issues = validateSettings({
      popupMod: 50,
      audioMod: 100,
      vidMod: 0,
      themeType: "Original",
      hibernateType: "Spaced",
      corruptionTrigger: "Timed",
      corruptionFadeType: "Normal",
    });
    expect(issues).toHaveLength(0);
  });

  it("reports nothing for safe values of danger-flagged options", () => {
    // These options carry legacy danger annotations; the schema must stay
    // silent while the dangerous value is not actually set.
    const issues = validateSettings({
      fill: 0,
      replace: 0,
      mitosisMode: 0,
      panicDisabled: 0,
      corruptionWallpaperCycle: 0,
      corruptionThemeCycle: 0,
      showDiscord: 0,
      startOnLogon: 0,
      runOnSaveQuit: 0,
      timerMode: 0,
      delay: 5000,
    });
    expect(issues).toHaveLength(0);
  });

  it("catches percentage out of range (too low)", () => {
    const issues = validateSettings({
      popupMod: -5,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe("popupMod");
    expect(issues[0].message).toContain("popupMod");
  });

  it("catches percentage out of range (too high)", () => {
    const issues = validateSettings({
      popupMod: 150,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe("popupMod");
  });

  it("catches invalid enum value", () => {
    const issues = validateSettings({
      themeType: "InvalidTheme",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe("themeType");
    expect(issues[0].message).toContain("Original");
  });

  it("catches negative value on non-negative field", () => {
    const issues = validateSettings({
      delay: -100,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe("delay");
  });

  it("catches non-boolean value on boolean field", () => {
    const issues = validateSettings({
      showCaptions: "yes",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe("showCaptions");
    expect(issues[0].message).toContain("number");
  });

  it("does not flag null or undefined values as errors", () => {
    const issues = validateSettings({
      popupMod: null,
      audioMod: undefined,
    });
    expect(issues).toHaveLength(0);
  });

  it("returns multiple issues for multiple invalid fields", () => {
    const issues = validateSettings({
      popupMod: 200,
      themeType: "BadTheme",
      delay: -10,
    });
    expect(issues).toHaveLength(3);
  });

  it("handles empty settings object", () => {
    const issues = validateSettings({});
    expect(issues).toHaveLength(0);
  });

  it("does not flag valid boolean values", () => {
    const issues = validateSettings({
      showCaptions: 0,
      denialChance: 0,
      singleMode: 1,
    });
    expect(issues).toHaveLength(0);
  });

  it("catches boolean out of range", () => {
    const issues = validateSettings({
      showCaptions: 5,
    });
    expect(issues).toHaveLength(1);
  });
});
