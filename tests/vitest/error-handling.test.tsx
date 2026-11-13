import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import { renderWithMantine } from "./setup";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";
import { ConfigSaveStatus } from "../../src/components/Config/ConfigSaveStatus";

describe("ErrorBoundary", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders children when no error occurs", () => {
    renderWithMantine(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("catches errors in nested components and shows fallback UI", () => {
    function Boom() {
      throw new Error("Test error");
    }

    renderWithMantine(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("shows custom fallback title and message", () => {
    function Boom() {
      throw new Error("Custom error");
    }

    const { container } = renderWithMantine(
      <ErrorBoundary fallbackTitle="Oops" fallbackMessage="Custom message here">
        <Boom />
      </ErrorBoundary>
    );

    const paper = container.querySelector(".mantine-Paper-root");
    expect(paper?.textContent).toContain("Oops");
    expect(paper?.textContent).toContain("Custom message here");
  });

  it("resets state on button click", () => {
    let shouldThrow = true;
    function ConditionalBoom() {
      if (shouldThrow) throw new Error("Test error");
      return <div data-testid="recovered">Recovered</div>;
    }

    const { container } = renderWithMantine(
      <ErrorBoundary>
        <ConditionalBoom />
      </ErrorBoundary>
    );

    const paper = container.querySelector(".mantine-Paper-root");
    expect(paper?.textContent).toContain("Something went wrong");

    shouldThrow = false;
    const buttons = container.querySelectorAll("button");
    fireEvent.click(buttons[0]);

    expect(screen.getByTestId("recovered")).toBeInTheDocument();
  });

  it("calls onReset callback when reset button is clicked", () => {
    const onReset = vi.fn();
    function Boom() {
      throw new Error("Test error");
    }

    const { container } = renderWithMantine(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>
    );

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("ConfigSaveStatus", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders nothing when status is idle", () => {
    const { container } = renderWithMantine(<ConfigSaveStatus status="idle" />);
    const badges = container.querySelectorAll("[data-testid^='save-status']");
    expect(badges.length).toBe(0);
  });

  it.each([
    ["saving", "save-status-saving", "Saving..."],
    ["saved", "save-status-saved", "Saved"],
    ["error", "save-status-error", "Save Failed"],
  ] as const)("shows the %s badge with its label", (status, testId, label) => {
    renderWithMantine(<ConfigSaveStatus status={status} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows error message when provided", () => {
    renderWithMantine(<ConfigSaveStatus status="error" errorMessage="Disk full" />);
    expect(screen.getByTestId("save-status-error-message")).toBeInTheDocument();
    expect(screen.getByText("Disk full")).toBeInTheDocument();
  });

  it("does not show error message when not provided", () => {
    const { container } = renderWithMantine(<ConfigSaveStatus status="error" />);
    expect(container.querySelector("[data-testid='save-status-error-message']")).toBeNull();
  });
});


