import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { screen, cleanup, act } from "@testing-library/react";
import { SubliminalOverlay } from "../../src/features/subliminal/SubliminalOverlay";
import { renderWithMantine } from "./setup";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("SubliminalOverlay (text popup)", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    useSettingsStore.setState({ capPopOpacity: 50, capPopTimer: 300 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the pack text", () => {
    renderWithMantine(<SubliminalOverlay text="obey" />);
    expect(screen.getByTestId("subliminal-text").textContent).toBe("obey");
  });

  it("applies capPopOpacity as direct alpha (50 → 0.5)", () => {
    renderWithMantine(<SubliminalOverlay text="obey" />);
    const el = screen.getByTestId("subliminal-overlay");
    expect(el.style.opacity).toBe("0.5");
  });

  it("auto-closes after capPopTimer and reports onClose", async () => {
    const onClose = vi.fn();
    renderWithMantine(<SubliminalOverlay text="obey" onClose={onClose} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(screen.queryByTestId("subliminal-overlay")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(screen.queryByTestId("subliminal-overlay")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the timeoutMs prop overrides the configured timer", async () => {
    const onClose = vi.fn();
    renderWithMantine(<SubliminalOverlay text="obey" timeoutMs={100} onClose={onClose} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for empty text", () => {
    renderWithMantine(<SubliminalOverlay text="" />);
    expect(screen.queryByTestId("subliminal-overlay")).toBeNull();
  });
});
