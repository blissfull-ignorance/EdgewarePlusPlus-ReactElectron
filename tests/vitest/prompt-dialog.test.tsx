import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderWithMantine } from "./setup";
import { PromptDialog } from "../../src/features/prompt/PromptDialog";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("PromptDialog", () => {
  beforeEach(() => {
    useSettingsStore.setState({ promptMistakes: 3 });
  });

  it("renders command text and input field", () => {
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type this: hello"
        expectedAnswer="hello"
        onClose={() => {}}
      />
    );
    expect(container.textContent).toContain("Type this: hello");
    expect(container.querySelector('[data-testid="prompt-input"]')).not.toBeNull();
  });

  it("accepts correct answer", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type: hello"
        expectedAnswer="hello"
        onClose={onClose}
      />
    );

    const input = container.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
    fireEvent.change(input!, { target: { value: "hello" } });
    fireEvent.click(container.querySelector('[data-testid="prompt-submit"]')!);

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("accepts a differently-cased answer", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <PromptDialog command="Type: hello" expectedAnswer="hello" onClose={onClose} />
    );
    const input = container.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
    fireEvent.change(input!, { target: { value: "HELLO" } });
    fireEvent.click(container.querySelector('[data-testid="prompt-submit"]')!);
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("accepts answer within max mistakes allowed", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type: kitten"
        expectedAnswer="kitten"
        onClose={onClose}
      />
    );

    const input = container.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
    fireEvent.change(input!, { target: { value: "kithen" } });
    fireEvent.click(container.querySelector('[data-testid="prompt-submit"]')!);

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("rejects answer exceeding max mistakes", () => {
    useSettingsStore.setState({ promptMistakes: 1 });
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type: kitten"
        expectedAnswer="kitten"
        onClose={onClose}
      />
    );

    const input = container.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
    fireEvent.change(input!, { target: { value: "sitting" } });
    fireEvent.click(container.querySelector('[data-testid="prompt-submit"]')!);

    expect(container.querySelector('[data-testid="prompt-error"]')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("rejects input shorter than minLength", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type something"
        expectedAnswer="hello"
        minLength={5}
        onClose={onClose}
      />
    );

    const input = container.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
    fireEvent.change(input!, { target: { value: "hi" } });
    fireEvent.click(container.querySelector('[data-testid="prompt-submit"]')!);

    expect(container.querySelector('[data-testid="prompt-error"]')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose with false when user dismisses via close button", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type something"
        expectedAnswer="hello"
        onClose={onClose}
      />
    );

    fireEvent.click(container.querySelector('[data-testid="close-button"]')!);
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("shows the expected phrase in its own line so it can be typed back", () => {
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type for me"
        expectedAnswer="I obey the spiral"
        onClose={() => {}}
      />
    );
    const phrase = container.querySelector('[data-testid="prompt-phrase"]');
    expect(phrase).not.toBeNull();
    expect(phrase!.textContent).toContain("I obey the spiral");
  });

  it("prefers pack-defined promptCommand/promptSubmit over props when an index is available", async () => {
    window.api.pack.loadIndex = vi.fn().mockResolvedValue({
      default: { promptCommand: "Do as I say~", promptSubmit: "I Submit <3" },
    });

    const { container } = renderWithMantine(
      <PromptDialog
        command="fallback title"
        expectedAnswer="hello"
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(container.querySelector("h3")!.textContent).toContain("Do as I say~");
    });
    const submit = container.querySelector('[data-testid="prompt-submit"]')!;
    await waitFor(() => {
      expect(submit.textContent).toContain("I Submit <3");
    });
  });

  it("falls back to the command prop when no pack index is available", async () => {
    window.api.pack.loadIndex = vi.fn().mockResolvedValue(null);
    const { container } = renderWithMantine(
      <PromptDialog
        command="Type for me, slave"
        expectedAnswer="hello"
        onClose={() => {}}
      />
    );
    await waitFor(() => {
      expect(container.textContent).toContain("Type for me, slave");
    });
    expect(container.querySelector('[data-testid="prompt-submit"]')!.textContent).toContain("Submit");
  });
});
