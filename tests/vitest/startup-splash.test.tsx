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

  it("renders the splash image", () => {
    renderWithMantine(<StartupSplash imageUrl="test.png" onFadeComplete={() => {}} />);
    expect(screen.getByTestId("splash-image")).toBeInTheDocument();
  });

  it("is fully opaque from the first frame so the app never shows through", () => {
    const { container } = renderWithMantine(
      <StartupSplash imageUrl="test.png" onFadeComplete={() => {}} />
    );
    const splash = container.querySelector("[data-testid='startup-splash']");
    expect(splash).toHaveStyle({ opacity: 1 });
    expect(splash).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" });
  });

  it("holds, then fades out and completes", () => {
    const onFadeComplete = vi.fn();
    const { container } = renderWithMantine(
      <StartupSplash imageUrl="test.png" onFadeComplete={onFadeComplete} />
    );
    const splash = container.querySelector("[data-testid='startup-splash']");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(splash).toHaveStyle({ opacity: 1 });
    expect(onFadeComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(splash).toHaveStyle({ opacity: 0 });
    expect(onFadeComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onFadeComplete).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-testid='startup-splash']")).toBeNull();
  });

  it("cancels its timers on unmount without errors", () => {
    const onFadeComplete = vi.fn();
    const { unmount } = renderWithMantine(
      <StartupSplash imageUrl="test.png" onFadeComplete={onFadeComplete} />
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onFadeComplete).not.toHaveBeenCalled();
  });
});
