import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { PopupShell } from "../../src/components/PopupShell/PopupShell";
import { useCloseLabel } from "../../src/hooks/useCloseLabel";
import { renderHook } from "@testing-library/react";

const MANTINE_WRAPPER = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe("close button label (pack-defined, lower right corner)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the pack-defined label (e.g. 'I Submit <3') instead of an X", async () => {
    window.api.pack.closeLabel = vi.fn().mockResolvedValue("I Submit <3");
    render(
      <PopupShell onClose={() => {}}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    await waitFor(() => {
      expect(screen.getByTestId("close-button")).toHaveTextContent("I Submit <3");
    });
  });

  it("falls back to 'Close' when the pack defines no label", async () => {
    window.api.pack.closeLabel = vi.fn().mockResolvedValue(null);
    render(
      <PopupShell onClose={() => {}}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    await waitFor(() => {
      expect(screen.getByTestId("close-button")).toHaveTextContent("Close");
    });
  });

  it("falls back to 'Close' when no IPC bridge exists at all", async () => {
    const original = (window as unknown as Record<string, unknown>).api;
    (window as unknown as Record<string, unknown>).api = undefined;
    try {
      const { result } = renderHook(() => useCloseLabel());
      expect(result.current).toBe("Close");
    } finally {
      (window as unknown as Record<string, unknown>).api = original;
    }
  });

  it("sits in the lower right corner of the popup", async () => {
    window.api.pack.closeLabel = vi.fn().mockResolvedValue("I Submit <3");
    render(
      <PopupShell onClose={() => {}}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    await waitFor(() => {
      expect(screen.getByTestId("close-button")).toHaveTextContent("I Submit <3");
    });
    const button = screen.getByTestId("close-button");
    expect(button).toHaveStyle({ bottom: "10px", right: "12px" });
  });

  it("still closes the popup when the label button is clicked", async () => {
    const handleClose = vi.fn();
    window.api.pack.closeLabel = vi.fn().mockResolvedValue("I Submit <3");
    render(
      <PopupShell onClose={handleClose}>
        <div>Content</div>
      </PopupShell>,
      { wrapper: MANTINE_WRAPPER }
    );

    await waitFor(() => {
      expect(screen.getByTestId("close-button")).toHaveTextContent("I Submit <3");
    });
    fireEvent.click(screen.getByTestId("close-button"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the button clickable exactly as before (single click closes)", () => {
    const original = (window as unknown as Record<string, unknown>).api;
    (window as unknown as Record<string, unknown>).api = undefined;
    const handleClose = vi.fn();
    try {
      render(
        <PopupShell onClose={handleClose}>
          <div>Content</div>
        </PopupShell>,
        { wrapper: MANTINE_WRAPPER }
      );
      fireEvent.click(screen.getByTestId("close-button"));
      expect(handleClose).toHaveBeenCalledTimes(1);
    } finally {
      (window as unknown as Record<string, unknown>).api = original;
    }
  });
});
