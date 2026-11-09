import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithMantine } from "./setup";
import { StartupSplash } from "../../src/features/startup/StartupSplash";

describe("StartupSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders splash image initially", () => {
    renderWithMantine(
      <StartupSplash
        imageUrl="test.png"
        onFadeComplete={() => {}}
      />
    );
    const img = screen.getByTestId("splash-image");
    expect(img).toBeInTheDocument();
  });

  it("fades in over 2 seconds", () => {
    const { container } = renderWithMantine(
      <StartupSplash
        imageUrl="test.png"
        onFadeComplete={() => {}}
      />
    );
    const splash = container.querySelector("[data-testid='startup-splash']");
    expect(splash).toHaveStyle({ opacity: 0 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const midOpacity = parseFloat(splash!.getAttribute("style")?.match(/opacity:\s*([\d.]+)/)?.[1] || "0");
    expect(midOpacity).toBeGreaterThan(0.3);
    expect(midOpacity).toBeLessThan(0.7);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(splash).toHaveStyle({ opacity: 1 });
  });

  it("fades out after holding for 2 seconds and calls onFadeComplete", () => {
    const onFadeComplete = vi.fn();
    const { container } = renderWithMantine(
      <StartupSplash
        imageUrl="test.png"
        onFadeComplete={onFadeComplete}
      />
    );
    const splash = container.querySelector("[data-testid='startup-splash']");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(splash).toHaveStyle({ opacity: 1 });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onFadeComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onFadeComplete).toHaveBeenCalledTimes(1);
  });

  it("unmounts gracefully without errors", () => {
    const { unmount } = renderWithMantine(
      <StartupSplash
        imageUrl="test.png"
        onFadeComplete={() => {}}
      />
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(() => unmount()).not.toThrow();
  });
});
