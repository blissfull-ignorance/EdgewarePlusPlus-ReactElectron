import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "../../src/stores/appStore";
import { useCorruptionStore } from "../../src/stores/corruptionStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("Integration: Popup spawn, close, and mitosis flow", () => {
  beforeEach(() => {
    useAppStore.getState().stop();
    useCorruptionStore.getState().reset();
    useSettingsStore.setState({
      mitosisMode: 0,
      mitosisStrength: 0,
      corruptionMode: 0,
      hibernateMode: 0,
      delay: 5000,
      popupMod: 100,
      vidMod: 0,
    });
  });

  it("popup count increments on spawn and decrements on close", () => {
    expect(useAppStore.getState().popupsCount).toBe(0);
    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(1);
    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(2);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(1);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("popup count does not go below zero", () => {
    expect(useAppStore.getState().popupsCount).toBe(0);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("stop resets popup count and hibernate state", () => {
    useAppStore.getState().start();
    useAppStore.getState().incrementPopups();
    useAppStore.getState().setHibernateActive(true);
    expect(useAppStore.getState().isRunning).toBe(true);
    expect(useAppStore.getState().popupsCount).toBe(1);
    expect(useAppStore.getState().hibernateActive).toBe(true);

    useAppStore.getState().stop();
    expect(useAppStore.getState().isRunning).toBe(false);
    expect(useAppStore.getState().popupsCount).toBe(0);
    expect(useAppStore.getState().hibernateActive).toBe(false);
  });

});

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
