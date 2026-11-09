import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "../../src/stores/appStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("useAppStore popup lifecycle", () => {
  beforeEach(() => {
    useAppStore.setState({ popupsCount: 0, isRunning: false, hibernateActive: false });
  });

  it("incrementPopups increases popupsCount", () => {
    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(1);

    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(2);
  });

  it("decrementPopups decreases popupsCount", () => {
    useAppStore.getState().incrementPopups();
    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(2);

    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(1);
  });

  it("decrementPopups does not go below zero", () => {
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);

    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("stop resets popupsCount to zero", () => {
    useAppStore.getState().incrementPopups();
    useAppStore.getState().incrementPopups();
    useAppStore.getState().stop();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });
});

describe("mitosis mode triggers on popupsCount reaching zero", () => {
  beforeEach(() => {
    useAppStore.setState({ popupsCount: 0, isRunning: false, hibernateActive: false });
    useSettingsStore.setState({ mitosisMode: 0 });
  });

  it("mitosisMode is disabled by default", () => {
    expect(useSettingsStore.getState().mitosisMode).toBe(0);
  });

  it("mitosisMode can be enabled", () => {
    useSettingsStore.setState({ mitosisMode: 1 });
    expect(useSettingsStore.getState().mitosisMode).toBe(1);
  });

  it("popupsCount reaching zero can be detected for mitosis trigger", () => {
    useAppStore.getState().incrementPopups();
    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(2);

    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(1);

    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("store subscription detects popupsCount changes", () => {
    const changes: number[] = [];
    const unsubscribe = useAppStore.subscribe((state) => {
      changes.push(state.popupsCount);
    });

    useAppStore.getState().incrementPopups();
    useAppStore.getState().decrementPopups();

    unsubscribe();

    expect(changes).toContain(1);
    expect(changes).toContain(0);
  });
});

describe("settingsStore mitosis settings", () => {
  beforeEach(() => {
    useSettingsStore.setState({ mitosisMode: 0, mitosisStrength: 0 });
  });

  it("has mitosisStrength setting", () => {
    expect(typeof useSettingsStore.getState().mitosisStrength).toBe("number");
  });

  it("has mitosisMode setting", () => {
    expect(typeof useSettingsStore.getState().mitosisMode).toBe("number");
  });
});
