import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithMantine } from "./setup";
import { VideoPopup } from "../../src/features/video/VideoPopup";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("VideoPopup", () => {
  beforeEach(() => {
    useSettingsStore.setState({ videoLoopInf: 1, videoLoopCount: 1 });
  });

  it("renders video element with correct src", () => {
    const { container } = renderWithMantine(
      <VideoPopup
        videoUrl="test-video.mp4"
        onClose={() => {}}
      />
    );
    const video = container.querySelector<HTMLVideoElement>('[data-testid="video-popup-video"]');
    expect(video).not.toBeNull();
    expect(video!.src).toContain("test-video.mp4");
  });

  it("video has autoplay and loop attributes", () => {
    const { container } = renderWithMantine(
      <VideoPopup
        videoUrl="test-video.mp4"
        onClose={() => {}}
      />
    );
    const video = container.querySelector<HTMLVideoElement>('[data-testid="video-popup-video"]');
    expect(video!.hasAttribute("autoplay")).toBe(true);
    expect(video!.hasAttribute("loop")).toBe(true);
  });

  it("wraps content in PopupShell", () => {
    const { container } = renderWithMantine(
      <VideoPopup
        videoUrl="test.mp4"
        onClose={() => {}}
      />
    );
    const shell = container.querySelector('[data-testid="popup-shell"]');
    expect(shell).not.toBeNull();
  });

  it("loops natively when infinite looping is on", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <VideoPopup videoUrl="test.mp4" onClose={onClose} />
    );
    const video = container.querySelector<HTMLVideoElement>('[data-testid="video-popup-video"]');
    expect(video!.hasAttribute("loop")).toBe(true);
    video!.dispatchEvent(new Event("ended"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes after the configured play count when not looping infinitely", () => {
    useSettingsStore.setState({ videoLoopInf: 0, videoLoopCount: 2 });
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <VideoPopup videoUrl="test.mp4" onClose={onClose} />
    );
    const video = container.querySelector<HTMLVideoElement>('[data-testid="video-popup-video"]');
    expect(video!.hasAttribute("loop")).toBe(false);

    video!.dispatchEvent(new Event("ended"));
    expect(onClose).not.toHaveBeenCalled();
    video!.dispatchEvent(new Event("ended"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
