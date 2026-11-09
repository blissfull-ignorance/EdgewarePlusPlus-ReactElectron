import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore, DEFAULT_SETTINGS } from "../../src/stores/settingsStore";

/**
 * Persistence contract for every configuration option: each key of the
 * default settings must survive a save → load round trip unchanged, and the
 * defaults must match the shipped legacy-compatible values.
 */
describe("settings persistence (all keys)", () => {
  const api = (window as unknown as {
    api: {
      system: { saveSettings: ReturnType<typeof vi.fn>; loadSettings: ReturnType<typeof vi.fn> };
    };
  }).api;

  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, dirty: false, loaded: true });
    api.system.saveSettings.mockReset().mockResolvedValue(undefined);
    api.system.loadSettings.mockReset().mockResolvedValue(null);
  });

  const keys = Object.keys(DEFAULT_SETTINGS);

  it("covers the full legacy option registry", () => {
    expect(keys.length).toBeGreaterThanOrEqual(100);
  });

  it("saves every key with its current value", async () => {
    const probe: Record<string, unknown> = {};
    for (const key of keys) {
      const base = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
      probe[key] =
        typeof base === "number" ? (base === 0 ? 1 : 2) : typeof base === "string" ? `rt:${key}` : true;
    }
    useSettingsStore.setState(probe as never);
    await useSettingsStore.getState().save();

    expect(api.system.saveSettings).toHaveBeenCalledTimes(1);
    const written = api.system.saveSettings.mock.calls[0][0] as Record<string, unknown>;
    for (const key of keys) {
      expect(written[key], `key ${key} persisted`).toEqual(probe[key]);
    }
  });

  it("reloads exactly what was saved", async () => {
    const saved: Record<string, unknown> = {};
    for (const key of keys) {
      const base = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
      saved[key] = typeof base === "number" ? 1 : typeof base === "string" ? `v:${key}` : 0;
    }
    api.system.loadSettings.mockResolvedValue(saved);
    await useSettingsStore.getState().load();

    const state = useSettingsStore.getState() as unknown as Record<string, unknown>;
    for (const key of keys) {
      expect(state[key], `key ${key} hydrated`).toEqual(saved[key]);
    }
  });

  it("keeps store defaults in sync with the defaults object", () => {
    const state = useSettingsStore.getState() as unknown as Record<string, unknown>;
    for (const key of keys) {
      expect(state[key], `default of ${key}`).toEqual(DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]);
    }
  });
});
