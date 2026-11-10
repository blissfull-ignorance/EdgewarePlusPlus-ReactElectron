import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore, DEFAULT_SETTINGS } from "../../src/stores/settingsStore";

/**
 * The panic hotkey defaults to Escape. The shipped early default "e" held the
 * letter hostage system-wide via the global shortcut, so loading a config that
 * still carries it migrates it once.
 */
describe("panic button defaults and migration", () => {
  const api = (window as unknown as {
    api: { system: { saveSettings: ReturnType<typeof vi.fn>; loadSettings: ReturnType<typeof vi.fn> } };
  }).api;

  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, dirty: false, loaded: true });
    api.system.saveSettings.mockReset().mockResolvedValue(undefined);
    api.system.loadSettings.mockReset().mockResolvedValue(null);
  });

  it("defaults both panic keys to Escape", () => {
    expect(DEFAULT_SETTINGS.globalPanicButton).toBe("Key.esc");
    expect(DEFAULT_SETTINGS.panicButton).toBe("Key.esc");
  });

  it("migrates a stored global panic key of \"e\" to Escape on load", async () => {
    api.system.loadSettings.mockResolvedValue({ globalPanicButton: "e", panicButton: "e" });
    const values = await useSettingsStore.getState().load();
    expect(values.globalPanicButton).toBe("Key.esc");
    expect(values.panicButton).toBe("Key.esc");
    expect(useSettingsStore.getState().globalPanicButton).toBe("Key.esc");
    expect(api.system.saveSettings).toHaveBeenCalledTimes(1);
    const written = api.system.saveSettings.mock.calls[0][0] as Record<string, unknown>;
    expect(written.globalPanicButton).toBe("Key.esc");
    expect(written.panicButton).toBe("Key.esc");
  });

  it("keeps a deliberately chosen panic key", async () => {
    api.system.loadSettings.mockResolvedValue({ globalPanicButton: "F7" });
    const values = await useSettingsStore.getState().load();
    expect(values.globalPanicButton).toBe("F7");
    expect(api.system.saveSettings).not.toHaveBeenCalled();
  });
});
