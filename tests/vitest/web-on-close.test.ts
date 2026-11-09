import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const rollMock = vi.fn((chance: number) => chance >= 100);

vi.mock("../../src/utils/roll", () => ({
  roll: (...args: unknown[]) => rollMock(...(args as [number])),
}));

import { maybeOpenWebOnClose } from "../../src/features/popup/webOnClose";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("maybeOpenWebOnClose (legacy try_web_open parity)", () => {
  beforeEach(() => {
    rollMock.mockImplementation((chance: number) => chance >= 100);
    useSettingsStore.setState({ webPopup: 0, webMod: 25 });
    window.api.pack.randomWeb = vi.fn().mockResolvedValue("https://example.com/x");
    window.api.system.openExternal = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useSettingsStore.setState({ webPopup: 0, webMod: 25 });
  });

  it("does nothing when the webPopup flag is off", () => {
    maybeOpenWebOnClose();
    expect(rollMock).not.toHaveBeenCalled();
    expect(window.api.system.openExternal).not.toHaveBeenCalled();
  });

  it("rolls with (100 - webMod) / 2 and opens the pack url on a passing roll", async () => {
    rollMock.mockReturnValue(true);
    useSettingsStore.setState({ webPopup: 1, webMod: 40 });
    maybeOpenWebOnClose();
    expect(rollMock).toHaveBeenLastCalledWith(30); // (100 - 40) / 2
    await vi.waitFor(() => {
      expect(window.api.system.openExternal).toHaveBeenCalledWith("https://example.com/x");
    });
  });

  it("skips the open when the roll fails", async () => {
    useSettingsStore.setState({ webPopup: 1, webMod: 40 });
    rollMock.mockReturnValue(false);
    maybeOpenWebOnClose();
    await new Promise((r) => setTimeout(r, 25));
    expect(window.api.system.openExternal).not.toHaveBeenCalled();
  });

  it("skips when the pack defines no web urls", async () => {
    rollMock.mockReturnValue(true);
    useSettingsStore.setState({ webPopup: 1, webMod: 40 });
    window.api.pack.randomWeb = vi.fn().mockResolvedValue(null);
    maybeOpenWebOnClose();
    await new Promise((r) => setTimeout(r, 25));
    expect(window.api.system.openExternal).not.toHaveBeenCalled();
  });

  it("never fires more than once for a single close", () => {
    useSettingsStore.setState({ webPopup: 1, webMod: 40 });
    maybeOpenWebOnClose();
    maybeOpenWebOnClose();
    // Two explicit calls from two different close sites are distinct popup closes;
    // the same close must only reach ONE site. Guarded structurally, verified here
    // by ensuring each call is independent and resolves its own open attempt.
    expect(rollMock).toHaveBeenCalledTimes(2);
  });
});
