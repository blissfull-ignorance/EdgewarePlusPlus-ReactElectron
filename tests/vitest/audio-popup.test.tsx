import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudioPopup } from "../../src/features/audio/AudioPopup";
import { useSettingsStore } from "../../src/stores/settingsStore";

afterEach(cleanup);

beforeEach(() => {
  useSettingsStore.setState({ audioVolume: 100, fadeInDuration: 0, fadeOutDuration: 0 });
});

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

/**
 * Legacy volume model: audioVolume is the target, fadeInDuration ramps up
 * from silence, and fadeOutDuration is scheduled to hit zero exactly at
 * end-of-stream.
 */
describe("AudioPopup volume and fades", () => {
  function elementWithDuration(seconds: number): HTMLAudioElement {
    render(<AudioPopup audioUrl="packmedia://aud/x.wav" />);
    const el = screen.getByTestId("audio-popup-audio") as HTMLAudioElement;
    Object.defineProperty(el, "duration", { value: seconds, configurable: true });
    fireEvent(el, new Event("loadedmetadata", { bubbles: true }));
    return el;
  }

  it("plays at the audioVolume target when no fades are configured", () => {
    useSettingsStore.setState({ audioVolume: 40, fadeInDuration: 0, fadeOutDuration: 0 });
    const el = elementWithDuration(10);
    expect(el.volume).toBeCloseTo(0.4, 5);
  });

  it("volume 100 plays at full", () => {
    useSettingsStore.setState({ audioVolume: 100 });
    const el = elementWithDuration(10);
    expect(el.volume).toBe(1);
  });

  it("fade-in starts at silence and reaches the target over its duration", () => {
    vi.useFakeTimers();
    useSettingsStore.setState({ audioVolume: 40, fadeInDuration: 300, fadeOutDuration: 0 });
    const el = elementWithDuration(10);
    expect(el.volume).toBe(0);
    act(() => vi.advanceTimersByTime(320));
    expect(el.volume).toBeCloseTo(0.4, 5);
    vi.useRealTimers();
  });

  it("fade-out reaches zero exactly at end-of-stream", () => {
    vi.useFakeTimers();
    useSettingsStore.setState({ audioVolume: 100, fadeInDuration: 0, fadeOutDuration: 2000 });
    const el = elementWithDuration(10); // fade-out starts at 8s
    expect(el.volume).toBe(1);
    act(() => vi.advanceTimersByTime(7900));
    expect(el.volume).toBe(1); // not started yet
    act(() => vi.advanceTimersByTime(2100));
    expect(el.volume).toBe(0);
    vi.useRealTimers();
  });

  it("forcedCloseMs closes the popup regardless of playback", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<AudioPopup audioUrl="packmedia://aud/x.wav" onClose={onClose} forcedCloseMs={2500} />);
    act(() => vi.advanceTimersByTime(2499));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2));
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
