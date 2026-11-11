import { describe, expect, it } from "vitest";
import { isMoodEligible, setActiveMoods } from "../../electron/utils/moodState";

describe("isMoodEligible (multi-tag gating)", () => {
  setActiveMoods(["goon", "voice"]);

  it("always admits untagged files", () => {
    expect(isMoodEligible(undefined)).toBe(true);
    expect(isMoodEligible([])).toBe(true);
  });

  it("admits a file when any one of its tags is active", () => {
    expect(isMoodEligible(["locked", "goon"])).toBe(true);
    expect(isMoodEligible(["goon"])).toBe(true);
  });

  it("blocks a file only when no tag is active", () => {
    expect(isMoodEligible(["locked"])).toBe(false);
    expect(isMoodEligible(["locked", "vanilla"])).toBe(false);
  });
});
