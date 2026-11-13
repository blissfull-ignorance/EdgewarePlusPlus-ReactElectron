import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "../../src/stores/appStore";

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


