import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMockStorage } from "./setup";

describe("settingsStore — error handling", () => {
  beforeEach(() => {
    vi.resetModules();
    clearMockStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
   });

  it("save() resolves successfully and sets saveStatus to 'saved'", async () => {
    window.api.system.loadSettings = vi.fn().mockResolvedValue(null);
    window.api.system.saveSettings = vi.fn().mockResolvedValue(undefined);

    const { useSettingsStore } = await import("../../src/stores/settingsStore");
    await useSettingsStore.getState().save();

    const state = useSettingsStore.getState();
    expect(state.saveStatus).toBe("saved");
    expect(state.saveErrorMessage).toBeNull();
  });

  it("save() sets saveStatus to 'error' when saveSettings throws", async () => {
    window.api.system.loadSettings = vi.fn().mockResolvedValue(null);
    window.api.system.saveSettings = vi.fn().mockRejectedValue(new Error("Disk full"));

    const { useSettingsStore } = await import("../../src/stores/settingsStore");
    await useSettingsStore.getState().save();

    const state = useSettingsStore.getState();
    expect(state.saveStatus).toBe("error");
    expect(state.saveErrorMessage).toBe("Disk full");
  });

  it("save() sets saveStatus to 'error' when saveSettings throws non-Error", async () => {
    window.api.system.loadSettings = vi.fn().mockResolvedValue(null);
    window.api.system.saveSettings = vi.fn().mockRejectedValue("string error");

    const { useSettingsStore } = await import("../../src/stores/settingsStore");
    await useSettingsStore.getState().save();

    const state = useSettingsStore.getState();
    expect(state.saveStatus).toBe("error");
    expect(state.saveErrorMessage).toBe("Unknown save error");
  });

  it("load() returns defaults when loadSettings throws", async () => {
    window.api.system.loadSettings = vi.fn().mockRejectedValue(new Error("Network error"));
    window.api.system.saveSettings = vi.fn().mockResolvedValue(undefined);

    const { useSettingsStore } = await import("../../src/stores/settingsStore");
    const result = await useSettingsStore.getState().load();
    expect(result.themeType).toBe("Original");
    expect(result.popupMod).toBe(100);

    window.api.system.loadSettings = vi.fn().mockResolvedValue(null);
    const { useSettingsStore: again } = await import("../../src/stores/settingsStore");
    expect((await again.getState().load()).themeType).toBe("Original");
  });

  it("save() excludes saveStatus and saveErrorMessage from serialized state", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    window.api.system.loadSettings = vi.fn().mockResolvedValue(null);
    window.api.system.saveSettings = mockSave;

    const { useSettingsStore } = await import("../../src/stores/settingsStore");
    useSettingsStore.setState({ saveStatus: "error", saveErrorMessage: "test error" });
    await useSettingsStore.getState().save();

    const savedData = mockSave.mock.calls[0][0] as Record<string, unknown>;
    expect(savedData.saveStatus).toBeUndefined();
    expect(savedData.saveErrorMessage).toBeUndefined();
  });
});
