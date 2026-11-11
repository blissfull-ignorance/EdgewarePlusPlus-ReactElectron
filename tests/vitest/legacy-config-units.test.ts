import { describe, expect, it } from "vitest";
import { normalizePackConfigValues } from "../../src/features/corruption/legacyConfig";

/**
 * Pack-supplied values (config.json presets, corruption level configs) use
 * the legacy unit convention: corruptionTime is stored in seconds and the
 * legacy app multiplied by 1000 at settings load. The port stores ms, so
 * pack values must be converted on apply.
 */
describe("normalizePackConfigValues", () => {
  it("converts legacy seconds to ms for corruptionTime", () => {
    expect(normalizePackConfigValues({ corruptionTime: 30 })).toEqual({ corruptionTime: 30000 });
  });

  it("leaves other keys untouched", () => {
    expect(normalizePackConfigValues({ delay: 500, corruptionMode: 1 })).toEqual({
      delay: 500,
      corruptionMode: 1,
    });
  });

  it("ignores non-numeric corruptionTime", () => {
    expect(normalizePackConfigValues({ corruptionTime: "soon" })).toEqual({
      corruptionTime: "soon",
    });
  });

  it("passes an empty object through", () => {
    expect(normalizePackConfigValues({})).toEqual({});
  });
});
