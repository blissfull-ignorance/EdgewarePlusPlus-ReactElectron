import { describe, expect, it, beforeEach } from "vitest";
import { useSettingsStore } from "../../src/stores/settingsStore";


describe("Integration: Settings persistence round-trip", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      mitosisMode: 0,
      mitosisStrength: 0,
      corruptionMode: 0,
      hibernateMode: 0,
      delay: 5000,
      popupMod: 100,
      vidMod: 100,
      packPath: null,
    });
  });

  it("setRaw updates settings and they are readable via getState", () => {
    useSettingsStore.getState().setRaw({
      popupMod: 75,
      vidMod: 25,
      delay: 2000,
      mitosisMode: 1,
      mitosisStrength: 5,
      corruptionMode: 1,
    });

    const state = useSettingsStore.getState();
    expect(state.popupMod).toBe(75);
    expect(state.vidMod).toBe(25);
    expect(state.delay).toBe(2000);
    expect(state.mitosisMode).toBe(1);
    expect(state.mitosisStrength).toBe(5);
    expect(state.corruptionMode).toBe(1);
  });

});
