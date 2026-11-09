import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
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

  it("disables pointer events when clickthroughEnabled is true", () => {
    const { container } = render(
      <PopupShell clickthroughEnabled>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const shell = container.querySelector('[data-testid="popup-shell"]');
    expect(shell).toHaveStyle("pointer-events: none");
  });

  it("enables pointer events when clickthroughEnabled is false", () => {
    const { container } = render(
      <PopupShell clickthroughEnabled={false}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    const shell = container.querySelector('[data-testid="popup-shell"]');
    expect(shell).toHaveStyle("pointer-events: auto");
  });
});
