import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, fireEvent, cleanup, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { PopupShell } from "../../src/components/PopupShell/PopupShell";

const MANTINE_WRAPPER = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

beforeEach(() => {
  cleanup();
});

describe("PopupShell", () => {
  it("renders with transparent background and no border", () => {
    const { container } = render(
      <PopupShell>
        <div>Popup content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const shell = container.querySelector('[data-testid="popup-shell"]');
    expect(shell).toBeTruthy();
    expect(shell?.style.borderStyle).toBe("none");
    expect(shell?.style.backgroundColor).toBe("transparent");
  });

  it("renders with correct default opacity of 1", () => {
    const { container } = render(
      <PopupShell>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const shell = container.querySelector('[data-testid="popup-shell"]');
    expect(shell).toHaveStyle("opacity: 1");
  });

  it("renders with custom opacity", () => {
    const { container } = render(
      <PopupShell opacity={0.5}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const shell = container.querySelector('[data-testid="popup-shell"]');
    expect(shell).toHaveStyle("opacity: 0.5");
  });

  it("renders close button when buttonless is false and clicksToClose is 0", () => {
    render(
      <PopupShell>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const closeButton = screen.getByTestId("close-button");
    expect(closeButton).toBeTruthy();
  });

  it("hides close button when buttonless is true", () => {
    render(
      <PopupShell buttonless>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const closeButton = screen.queryByTestId("close-button");
    expect(closeButton).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <PopupShell onClose={handleClose}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const closeButton = screen.getByTestId("close-button");
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when container is clicked (default single-click close)", () => {
    const handleClose = vi.fn();
    const { container } = render(
      <PopupShell onClose={handleClose}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const shell = container.querySelector('[data-testid="popup-shell"]');
    fireEvent.click(shell!);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("supports multi-click close with countdown display", () => {
    const handleClose = vi.fn();
    render(
      <PopupShell onClose={handleClose} clicksToClose={3}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const clicksRemaining = screen.getByTestId("clicks-remaining");
    expect(clicksRemaining).toHaveTextContent("3 clicks to close");
  });

  it("decrements click counter on each click and closes at zero", () => {
    const handleClose = vi.fn();
    const { container } = render(
      <PopupShell onClose={handleClose} clicksToClose={2}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const shell = container.querySelector('[data-testid="popup-shell"]');
    fireEvent.click(shell!);
    expect(screen.getByTestId("clicks-remaining")).toHaveTextContent("1 click to close");

    fireEvent.click(shell!);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("toggles pointer events with clickthroughEnabled", () => {
    const { container, unmount } = render(
      <PopupShell clickthroughEnabled>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.querySelector('[data-testid="popup-shell"]')).toHaveStyle("pointer-events: none");
    unmount();

    const { container: off } = render(
      <PopupShell clickthroughEnabled={false}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(off.querySelector('[data-testid="popup-shell"]')).toHaveStyle("pointer-events: auto");
  });
});

describe("PopupShell auto-close (timeoutMs)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("closes exactly once when the timeout elapses", () => {
    const onClose = vi.fn();
    render(
      <PopupShell onClose={onClose} timeoutMs={1000}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    act(() => void vi.advanceTimersByTime(500));
    expect(onClose).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1200));
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(2000));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("never auto-closes with timeoutMs 0", () => {
    const onClose = vi.fn();
    render(
      <PopupShell onClose={onClose} timeoutMs={0}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );
    act(() => void vi.advanceTimersByTime(10_000));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when unmounted before the deadline", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <PopupShell onClose={onClose} timeoutMs={1000}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );
    unmount();
    act(() => void vi.advanceTimersByTime(5000));
    expect(onClose).not.toHaveBeenCalled();
  });
});
