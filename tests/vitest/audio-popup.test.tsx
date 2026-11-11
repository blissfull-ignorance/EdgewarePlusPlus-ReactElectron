import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudioPopup } from "../../src/features/audio/AudioPopup";

afterEach(cleanup);

/**
 * Legacy audio semantics: a pack audio file plays exactly once (one queued
 * source, stop at end-of-stream) — the popup closing on "ended" is what
 * releases scripted on_stop chains, so looping here would deadlock them.
 */
describe("AudioPopup one-shot playback", () => {
  it("does not loop", () => {
    render(<AudioPopup audioUrl="packmedia://aud/x.wav" />);
    const el = screen.getByTestId("audio-popup-audio") as HTMLAudioElement;
    expect(el.hasAttribute("loop")).toBe(false);
    expect(el.loop).toBe(false);
  });

  it("closes the popup when playback ends", () => {
    const onClose = vi.fn();
    render(<AudioPopup audioUrl="packmedia://aud/x.wav" onClose={onClose} />);
    fireEvent(screen.getByTestId("audio-popup-audio"), new Event("ended", { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes the popup when the source fails", () => {
    const onClose = vi.fn();
    render(<AudioPopup audioUrl="packmedia://aud/bad.wav" onClose={onClose} />);
    fireEvent(screen.getByTestId("audio-popup-audio"), new Event("error", { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
